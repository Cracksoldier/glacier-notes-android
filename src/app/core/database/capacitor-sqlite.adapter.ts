import {
  CapacitorSQLite,
  type SQLiteDBConnection,
  SQLiteConnection,
} from '@capacitor-community/sqlite';

import type { DatabaseAdapter } from './database-adapter';
import type { SqlRow, SqlValue } from './sql-value';

export const DATABASE_NAME = 'glacier';

/**
 * The on-device backend, over `@capacitor-community/sqlite`.
 *
 * Two things about this plugin are worth knowing before editing:
 *
 * - It always opens through SQLCipher (`Database.java:276` calls
 *   `net.zetetic.database.sqlcipher.SQLiteDatabase.openOrCreateDatabase`). We
 *   pass `encrypted: false` and no passphrase, so the file is a plain SQLite
 *   database — encryption stays off, per the fixed v1 constraints.
 * - It keeps a connection registry that outlives a WebView reload, so a second
 *   `createConnection` for a database it already knows about throws.
 *   `checkConnectionsConsistency` reconciles that registry with what is really
 *   open, and must run before anything else.
 */
export class CapacitorSqliteAdapter implements DatabaseAdapter {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;

  constructor(private readonly database = DATABASE_NAME) {}

  async open(): Promise<void> {
    if (this.db) {
      return;
    }

    await this.sqlite.checkConnectionsConsistency();
    const existing = await this.sqlite.isConnection(this.database, false);
    this.db = existing.result
      ? await this.sqlite.retrieveConnection(this.database, false)
      : await this.sqlite.createConnection(this.database, false, 'no-encryption', 1, false);

    const isOpen = await this.db.isDBOpen();
    if (!isOpen.result) {
      await this.db.open();
    }

    // Must be outside any transaction, where SQLite ignores it silently.
    await this.db.execute('PRAGMA foreign_keys = ON', false);
  }

  async close(): Promise<void> {
    if (!this.db) {
      return;
    }
    await this.sqlite.closeConnection(this.database, false);
    this.db = null;
  }

  async execute(statements: readonly string[]): Promise<void> {
    const db = this.require();
    for (const statement of statements) {
      // One statement per call: the plugin splits batched SQL on `";\n"`
      // (`UtilsSQLite.java:47`), which can apply a prefix of a batch and report
      // success. Passing `false` keeps its own transaction wrapper out of ours.
      await db.execute(statement, false);
    }
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    await this.require().run(sql, [...params], false, 'no');
  }

  async query<TRow extends SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<TRow[]> {
    const result = await this.require().query(sql, [...params]);
    return (result.values ?? []) as TRow[];
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

  private require(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error('Database is not open');
    }
    return this.db;
  }
}
