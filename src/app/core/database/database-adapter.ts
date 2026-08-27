import { InjectionToken } from '@angular/core';

import type { SqlRow, SqlValue } from './sql-value';

/**
 * The whole surface the rest of the app is allowed to see of SQLite. Three
 * implementations exist — Capacitor on device, `node:sqlite` in specs, sql.js on
 * the dev server — and nothing above `core/database` may reach past this
 * interface to a plugin.
 */
export interface DatabaseAdapter {
  open(): Promise<void>;
  close(): Promise<void>;

  /**
   * Runs statements in order, one at a time, without parameters. Intended for
   * DDL. Implementations must issue each statement separately rather than
   * concatenating them: the Capacitor plugin splits batched SQL on `";\n"`
   * (`UtilsSQLite.java:47`), which can silently apply a prefix of a batch.
   */
  execute(statements: readonly string[]): Promise<void>;

  /** Runs one parameterized statement that returns no rows. */
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;

  query<TRow extends SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<TRow[]>;

  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

export const DATABASE_ADAPTER = new InjectionToken<DatabaseAdapter>('DatabaseAdapter');
