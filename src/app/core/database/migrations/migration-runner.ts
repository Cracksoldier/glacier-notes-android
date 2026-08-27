import type { DatabaseAdapter } from '../database-adapter';
import { withTransaction } from '../transaction';
import { MIGRATIONS } from './index';
import type { Migration } from './migration';

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * The ledger has to exist before we can ask what has been applied, so it is
 * created outside any migration. `IF NOT EXISTS` makes that idempotent.
 */
const LEDGER = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT`;

/**
 * Brings the database up to the newest defined version, or refuses to touch it.
 *
 * Every check happens **before** a single statement is issued. A database this
 * build does not understand is left exactly as it was found — the alternative,
 * recreating it, is the destructive recovery the milestone rules out.
 *
 * Each migration runs in its own transaction covering its statements, its seed,
 * its ledger row and `user_version`. A failure part-way therefore rolls back
 * whole, and a corrected build can retry against the same file.
 */
export async function runMigrations(
  adapter: DatabaseAdapter,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<void> {
  assertWellFormed(migrations);
  await adapter.execute([LEDGER]);

  const applied = await appliedVersions(adapter);
  assertCompatible(applied, migrations);

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }
    await apply(adapter, migration);
  }
}

export async function appliedVersions(adapter: DatabaseAdapter): Promise<Set<number>> {
  const rows = await adapter.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  return new Set(rows.map((row) => row.version));
}

function assertWellFormed(migrations: readonly Migration[]): void {
  let previous = 0;
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new MigrationError(`Migration version must be a positive integer: ${migration.name}`);
    }
    if (migration.version <= previous) {
      throw new MigrationError(
        `Migrations are out of order at version ${migration.version} (${migration.name})`,
      );
    }
    previous = migration.version;
  }
}

function assertCompatible(applied: ReadonlySet<number>, migrations: readonly Migration[]): void {
  const known = new Set(migrations.map((migration) => migration.version));

  for (const version of applied) {
    if (!known.has(version)) {
      throw new MigrationError(
        `The database has schema version ${version}, which this build does not know about. ` +
          'It was most likely written by a newer version of the app. Refusing to modify it.',
      );
    }
  }

  // A gap means a migration was skipped or the ledger was tampered with. Later
  // steps assume their predecessors ran, so continuing would corrupt the schema.
  for (const migration of migrations) {
    if (
      applied.size > 0 &&
      !applied.has(migration.version) &&
      hasHigherApplied(applied, migration)
    ) {
      throw new MigrationError(
        `Schema version ${migration.version} was never applied but a later one was. ` +
          'Refusing to modify the database.',
      );
    }
  }
}

function hasHigherApplied(applied: ReadonlySet<number>, migration: Migration): boolean {
  for (const version of applied) {
    if (version > migration.version) {
      return true;
    }
  }
  return false;
}

async function apply(adapter: DatabaseAdapter, migration: Migration): Promise<void> {
  await withTransaction(adapter, async () => {
    await adapter.execute(migration.statements);
    await migration.seed?.(adapter);
    await adapter.run(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [migration.version, migration.name, new Date().toISOString()],
    );
    // `user_version` cannot be parameterized, so the value is interpolated —
    // `assertWellFormed` has already established it is a positive integer.
    await adapter.execute([`PRAGMA user_version = ${migration.version}`]);
  });
}
