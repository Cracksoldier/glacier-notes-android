import { beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseAdapter } from './database-adapter';
import { NodeSqliteAdapter } from './node-sqlite.adapter';
import { NestedTransactionError, withTransaction } from './transaction';

describe('withTransaction', () => {
  let adapter: DatabaseAdapter;

  beforeEach(async () => {
    adapter = new NodeSqliteAdapter();
    await adapter.open();
    await adapter.execute(['CREATE TABLE t (id TEXT PRIMARY KEY) STRICT']);
  });

  async function ids(): Promise<string[]> {
    const rows = await adapter.query<{ id: string }>('SELECT id FROM t ORDER BY id');
    return rows.map((row) => row.id);
  }

  it('commits work that completes', async () => {
    await withTransaction(adapter, async () => {
      await adapter.run('INSERT INTO t VALUES (?)', ['a']);
    });

    expect(await ids()).toEqual(['a']);
  });

  it('rolls back every write when the work throws', async () => {
    const failure = new Error('boom');

    await expect(
      withTransaction(adapter, async () => {
        await adapter.run('INSERT INTO t VALUES (?)', ['a']);
        await adapter.run('INSERT INTO t VALUES (?)', ['b']);
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await ids()).toEqual([]);
  });

  it('rolls back on a constraint violation from SQLite itself', async () => {
    await adapter.run('INSERT INTO t VALUES (?)', ['a']);

    await expect(
      withTransaction(adapter, async () => {
        await adapter.run('INSERT INTO t VALUES (?)', ['b']);
        await adapter.run('INSERT INTO t VALUES (?)', ['a']);
      }),
    ).rejects.toThrow();

    expect(await ids()).toEqual(['a']);
  });

  it('returns the value the work produced', async () => {
    expect(await withTransaction(adapter, async () => 42)).toBe(42);
  });

  it('rejects a nested transaction instead of flattening it', async () => {
    await expect(
      withTransaction(adapter, async () => {
        await withTransaction(adapter, async () => undefined);
      }),
    ).rejects.toBeInstanceOf(NestedTransactionError);
  });

  it('releases the connection so a later transaction can start', async () => {
    await expect(
      withTransaction(adapter, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await withTransaction(adapter, async () => {
      await adapter.run('INSERT INTO t VALUES (?)', ['a']);
    });

    expect(await ids()).toEqual(['a']);
  });

  it('releases the connection when BEGIN itself fails, and does not roll back', async () => {
    let rollbacks = 0;
    let begins = 0;
    // Delegating rather than spreading: `adapter` is a class instance, so its
    // methods live on the prototype and a spread would drop them.
    const flaky: DatabaseAdapter = {
      open: () => adapter.open(),
      close: () => adapter.close(),
      execute: (statements) => adapter.execute(statements),
      query: (sql, params) => adapter.query(sql, params),
      run: (sql, params) => adapter.run(sql, params),
      beginTransaction: () =>
        begins++ === 0 ? Promise.reject(new Error('begin failed')) : adapter.beginTransaction(),
      commitTransaction: () => adapter.commitTransaction(),
      rollbackTransaction: () => {
        rollbacks++;
        return adapter.rollbackTransaction();
      },
    };

    await expect(withTransaction(flaky, async () => undefined)).rejects.toThrow('begin failed');
    expect(rollbacks).toBe(0);

    await withTransaction(flaky, async () => {
      await adapter.run('INSERT INTO t VALUES (?)', ['a']);
    });

    expect(await ids()).toEqual(['a']);
  });

  it('surfaces the original error even if the rollback also fails', async () => {
    const broken: DatabaseAdapter = {
      ...adapter,
      beginTransaction: () => Promise.resolve(),
      commitTransaction: () => Promise.resolve(),
      rollbackTransaction: () => Promise.reject(new Error('rollback failed')),
    };

    await expect(
      withTransaction(broken, () => Promise.reject(new Error('original'))),
    ).rejects.toThrow('original');
  });
});
