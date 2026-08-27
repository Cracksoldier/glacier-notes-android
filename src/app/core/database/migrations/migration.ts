import type { DatabaseAdapter } from '../database-adapter';

/**
 * One versioned, **additive** schema step.
 *
 * Migrations may create tables, add columns and create indexes. They may not
 * drop or rename anything: a migration that destroys a column destroys user
 * data on every device that runs it, and there is no backup to fall back on.
 * `migration-runner.spec.ts` enforces that statically over every statement in
 * `MIGRATIONS`.
 *
 * Each entry of `statements` must be exactly one SQL statement with no interior
 * `;`. The Capacitor plugin splits batched SQL on `";\n"`, so a batch handed to
 * it as one string can be applied in part and still report success.
 */
export interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
  /** Runs inside the same transaction as `statements`, after them. */
  seed?: (adapter: DatabaseAdapter) => Promise<void>;
}
