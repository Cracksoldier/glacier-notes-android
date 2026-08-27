import { DatabaseSync } from 'node:sqlite';

import type { DatabaseAdapter } from './database-adapter';
import type { SqlRow, SqlValue } from './sql-value';

/**
 * Spec-only backend over Node's built-in SQLite.
 *
 * Specs run against a real engine on purpose: foreign keys, `CHECK` constraints
 * and `ON DELETE` behaviour are the things most likely to be wrong, and a
 * hand-written fake would only assert what we already believe about SQLite.
 *
 * This file is never reachable from `src/main.ts`, so it is neither bundled nor
 * shipped. It must stay that way — importing it from application code would put
 * `node:sqlite` in the browser graph.
 */
export class NodeSqliteAdapter implements DatabaseAdapter {
  private db: DatabaseSync | null = null;

  constructor(private readonly location = ':memory:') {}

  async open(): Promise<void> {
    if (!this.db) {
      this.db = new DatabaseSync(this.location);
      // Off by default in SQLite, and a no-op if issued inside a transaction.
      this.db.exec('PRAGMA foreign_keys = ON');
    }
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  async execute(statements: readonly string[]): Promise<void> {
    const db = this.require();
    for (const statement of statements) {
      db.exec(statement);
    }
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    this.require()
      .prepare(sql)
      .run(...params);
  }

  async query<TRow extends SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<TRow[]> {
    return this.require()
      .prepare(sql)
      .all(...params) as TRow[];
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

  private require(): DatabaseSync {
    if (!this.db) {
      throw new Error('Database is not open');
    }
    return this.db;
  }
}
