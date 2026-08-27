import type { SqlJsDatabase } from 'sql.js/dist/sql-asm.js';

import type { DatabaseAdapter } from './database-adapter';
import type { SqlRow, SqlValue } from './sql-value';

/**
 * Dev-server backend: a real SQLite engine, held **in memory only**.
 *
 * It resets on every reload, and that is the point. The Capacitor plugin's own
 * web implementation delegates to the `jeep-sqlite` element, which persists to
 * IndexedDB — close enough to production to be mistaken for it, and different
 * enough to mislead. An in-memory database cannot be mistaken for storage.
 *
 * The `sql-asm.js` build is used rather than the WebAssembly one so there is no
 * `.wasm` asset to serve and no `loader` entry in `angular.json` — adding one
 * makes the build resolve `node:sqlite` under `platform: 'browser'` and breaks
 * the spec build.
 *
 * This file is reachable only from `environment.ts`, which `fileReplacements`
 * swaps out for production, so sql.js never reaches the APK.
 */

export class SqlJsAdapter implements DatabaseAdapter {
  private db: SqlJsDatabase | null = null;

  async open(): Promise<void> {
    if (this.db) {
      return;
    }
    const { default: initSqlJs } = await import('sql.js/dist/sql-asm.js');
    const SQL = await initSqlJs();
    this.db = new SQL.Database();
    this.db.run('PRAGMA foreign_keys = ON');
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  async execute(statements: readonly string[]): Promise<void> {
    const db = this.require();
    for (const statement of statements) {
      db.run(statement);
    }
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    this.require().run(sql, params);
  }

  async query<TRow extends SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<TRow[]> {
    const [result] = this.require().exec(sql, params);
    if (!result) {
      return [];
    }
    return result.values.map((values) =>
      Object.fromEntries(result.columns.map((column, index) => [column, values[index] ?? null])),
    ) as TRow[];
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

  private require(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('Database is not open');
    }
    return this.db;
  }
}
