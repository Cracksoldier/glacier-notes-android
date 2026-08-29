import type { DatabaseAdapter } from './database-adapter';

export class NestedTransactionError extends Error {
  constructor() {
    super('A transaction is already open on this connection');
    this.name = 'NestedTransactionError';
  }
}

const open = new WeakSet<DatabaseAdapter>();

/**
 * Runs `work` inside `BEGIN` / `COMMIT`, rolling back on any throw.
 *
 * Nesting throws rather than flattening. SQLite has no nested transactions, so
 * an inner `COMMIT` would end the outer one and a later failure would leave the
 * outer work half-applied — the exact "a failure destroys existing user data"
 * case the milestone forbids. Callers that need composition should pass work
 * down, not open a second transaction.
 *
 * A rollback failure does not mask the original error: the original is what the
 * caller needs to see, and the connection is discarded either way.
 */
export async function withTransaction<T>(
  adapter: DatabaseAdapter,
  work: () => Promise<T>,
): Promise<T> {
  if (open.has(adapter)) {
    throw new NestedTransactionError();
  }

  open.add(adapter);
  try {
    // Inside the outer `try` so a BEGIN that rejects still releases the WeakSet
    // entry. Leaking it would make every later write on this connection throw
    // NestedTransactionError until the app restarts.
    await adapter.beginTransaction();
    try {
      const result = await work();
      await adapter.commitTransaction();
      return result;
    } catch (error) {
      try {
        await adapter.rollbackTransaction();
      } catch {
        // Swallowed deliberately — see above.
      }
      throw error;
    }
  } finally {
    open.delete(adapter);
  }
}
