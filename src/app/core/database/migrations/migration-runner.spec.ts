import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseAdapter } from '../database-adapter';
import { NodeSqliteAdapter } from '../node-sqlite.adapter';
import type { SqlRow, SqlValue } from '../sql-value';
import { initialSchema } from './001-initial-schema';
import { LATEST_VERSION, MIGRATIONS } from './index';
import type { Migration } from './migration';
import { MigrationError, runMigrations } from './migration-runner';

/** Delegates everything, remembering the SQL it was asked to issue. */
class RecordingAdapter implements DatabaseAdapter {
  readonly sql: string[] = [];

  constructor(private readonly inner: DatabaseAdapter) {}

  open(): Promise<void> {
    return this.inner.open();
  }

  close(): Promise<void> {
    return this.inner.close();
  }

  execute(statements: readonly string[]): Promise<void> {
    this.sql.push(...statements);
    return this.inner.execute(statements);
  }

  run(sql: string, params?: readonly SqlValue[]): Promise<void> {
    this.sql.push(sql);
    return this.inner.run(sql, params);
  }

  query<TRow extends SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<TRow[]> {
    return this.inner.query<TRow>(sql, params);
  }

  beginTransaction(): Promise<void> {
    return this.execute(['BEGIN']);
  }

  commitTransaction(): Promise<void> {
    return this.execute(['COMMIT']);
  }

  rollbackTransaction(): Promise<void> {
    return this.execute(['ROLLBACK']);
  }
}

async function userVersion(adapter: DatabaseAdapter): Promise<number> {
  const [row] = await adapter.query<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? -1;
}

async function tableNames(adapter: DatabaseAdapter): Promise<string[]> {
  const rows = await adapter.query<{ name: string }>(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((row) => row.name);
}

describe('a fresh database', () => {
  let adapter: DatabaseAdapter;

  beforeEach(async () => {
    adapter = new NodeSqliteAdapter();
    await adapter.open();
    await runMigrations(adapter);
  });

  it('is seeded with exactly one notebook, named as the desktop names it', async () => {
    const notebooks = await adapter.query<{ name: string; sort_order: number }>(
      'SELECT name, sort_order FROM notebooks',
    );

    expect(notebooks).toEqual([{ name: 'Notes', sort_order: 0 }]);
  });

  it('points app_state at that notebook, so a note can be created immediately', async () => {
    const [state] = await adapter.query<{ default_notebook_id: string }>(
      'SELECT default_notebook_id FROM app_state WHERE id = 1',
    );
    const [notebook] = await adapter.query<{ id: string }>('SELECT id FROM notebooks');

    expect(state?.default_notebook_id).toBe(notebook?.id);
  });

  it('records the migration and mirrors it into user_version', async () => {
    const rows = await adapter.query<{ version: number; name: string }>(
      'SELECT version, name FROM schema_migrations',
    );

    expect(rows).toEqual(
      MIGRATIONS.map((migration) => ({ version: migration.version, name: migration.name })),
    );
    expect(await userVersion(adapter)).toBe(LATEST_VERSION);
  });

  it('is a no-op when run again, rather than re-seeding', async () => {
    await runMigrations(adapter);

    const [row] = await adapter.query<{ n: number }>('SELECT count(*) AS n FROM notebooks');
    expect(row?.n).toBe(1);
    expect(await userVersion(adapter)).toBe(LATEST_VERSION);
  });
});

describe('upgrading an existing database', () => {
  const addColumn: Migration = {
    version: 2,
    name: 'add-note-reminder',
    statements: ['ALTER TABLE notes ADD COLUMN reminder_at TEXT'],
  };

  let adapter: DatabaseAdapter;

  beforeEach(async () => {
    adapter = new NodeSqliteAdapter();
    await adapter.open();
    await runMigrations(adapter, [initialSchema]);
  });

  async function insertNote(): Promise<void> {
    const [notebook] = await adapter.query<{ id: string }>('SELECT id FROM notebooks');
    await adapter.run(
      'INSERT INTO notes (id, notebook_id, type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        '3f2504e0-4f89-41d3-9a0c-0305e82c3320',
        notebook?.id ?? '',
        'text',
        'Kept',
        'Body',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      ],
    );
  }

  it('applies only the pending step and preserves existing rows', async () => {
    await insertNote();

    await runMigrations(adapter, [initialSchema, addColumn]);

    const notes = await adapter.query<{ title: string }>('SELECT title FROM notes');
    expect(notes).toEqual([{ title: 'Kept' }]);
    expect(await userVersion(adapter)).toBe(2);
  });

  it('refuses a database written by a newer build, leaving it untouched', async () => {
    await adapter.run(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [99, 'from-the-future', '2027-01-01T00:00:00.000Z'],
    );
    const before = await tableNames(adapter);
    const recording = new RecordingAdapter(adapter);

    await expect(runMigrations(recording, [initialSchema, addColumn])).rejects.toBeInstanceOf(
      MigrationError,
    );

    expect(await tableNames(adapter)).toEqual(before);
    expect(recording.sql.filter((sql) => addColumn.statements.includes(sql))).toEqual([]);
    expect(recording.sql).not.toContain('BEGIN');
  });

  it('refuses a ledger with a gap rather than assuming the skipped step ran', async () => {
    await adapter.run(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [3, 'later', '2027-01-01T00:00:00.000Z'],
    );

    await expect(
      runMigrations(adapter, [initialSchema, addColumn, { ...addColumn, version: 3 }]),
    ).rejects.toBeInstanceOf(MigrationError);
  });

  it('rejects migrations defined out of order before touching the database', async () => {
    const recording = new RecordingAdapter(adapter);

    await expect(runMigrations(recording, [addColumn, initialSchema])).rejects.toBeInstanceOf(
      MigrationError,
    );

    expect(recording.sql).toEqual([]);
  });
});

describe('a migration that fails part-way', () => {
  let directory: string;
  let file: string;

  const broken: Migration = {
    version: 2,
    name: 'add-note-reminder',
    statements: [
      'ALTER TABLE notes ADD COLUMN reminder_at TEXT',
      'ALTER TABLE notes ADD COLUMN reminder_at TEXT', // fails: duplicate column
    ],
  };
  const corrected: Migration = {
    version: 2,
    name: 'add-note-reminder',
    statements: ['ALTER TABLE notes ADD COLUMN reminder_at TEXT'],
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'glacier-migrations-'));
    file = join(directory, 'glacier.db');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  async function withDatabase<T>(work: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    const adapter = new NodeSqliteAdapter(file);
    await adapter.open();
    try {
      return await work(adapter);
    } finally {
      await adapter.close();
    }
  }

  it('leaves the data and the version untouched, and a fixed build then applies', async () => {
    await withDatabase(async (adapter) => {
      await runMigrations(adapter, [initialSchema]);
      const [notebook] = await adapter.query<{ id: string }>('SELECT id FROM notebooks');
      await adapter.run(
        'INSERT INTO notes (id, notebook_id, type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          '3f2504e0-4f89-41d3-9a0c-0305e82c3320',
          notebook?.id ?? '',
          'text',
          'Precious',
          'Body',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
        ],
      );
    });

    // The bad build ships and runs against the user's real database.
    await withDatabase(async (adapter) => {
      await expect(runMigrations(adapter, [initialSchema, broken])).rejects.toThrow();

      const notes = await adapter.query<{ title: string }>('SELECT title FROM notes');
      const versions = await adapter.query<{ version: number }>(
        'SELECT version FROM schema_migrations',
      );
      const columns = await adapter.query<{ name: string }>('PRAGMA table_info(notes)');

      expect(notes).toEqual([{ title: 'Precious' }]);
      expect(versions).toEqual([{ version: 1 }]);
      expect(await userVersion(adapter)).toBe(1);
      expect(columns.map((column) => column.name)).not.toContain('reminder_at');
    });

    // The fix ships and runs against the same file.
    await withDatabase(async (adapter) => {
      await runMigrations(adapter, [initialSchema, corrected]);

      const notes = await adapter.query<{ title: string }>('SELECT title FROM notes');
      const columns = await adapter.query<{ name: string }>('PRAGMA table_info(notes)');

      expect(notes).toEqual([{ title: 'Precious' }]);
      expect(columns.map((column) => column.name)).toContain('reminder_at');
      expect(await userVersion(adapter)).toBe(2);
    });
  });
});

describe('every shipped migration', () => {
  const statements = MIGRATIONS.flatMap((migration) => migration.statements);

  it('is additive — nothing drops, truncates or renames', () => {
    for (const statement of statements) {
      expect(statement).not.toMatch(/\b(DROP|TRUNCATE)\b/i);
      expect(statement).not.toMatch(/\bRENAME\s+TO\b/i);
    }
  });

  it('is exactly one statement, with no interior semicolon', () => {
    // The Capacitor plugin splits batched SQL on `";\n"`, so a statement
    // containing one can be applied in part and still report success.
    for (const statement of statements) {
      expect(statement).not.toContain(';');
    }
  });

  it("uses no SQL line comments, which the plugin's splitter would misread", () => {
    for (const statement of statements) {
      expect(statement).not.toContain('--');
    }
  });

  it('has strictly increasing versions starting at 1', () => {
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual(
      MIGRATIONS.map((_, index) => index + 1),
    );
  });
});
