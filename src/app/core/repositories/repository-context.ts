import { Injectable, inject } from '@angular/core';

import { DATABASE_ADAPTER, type DatabaseAdapter } from '../database/database-adapter';
import { NestedTransactionError, withTransaction } from '../database/transaction';
import { ConstraintViolationError, RepositoryError } from './repository-errors';

/**
 * The single point at which repository work reaches the database.
 *
 * Every operation is queued, so exactly one runs at a time. That buys two
 * things a bare `withTransaction` cannot:
 *
 * 1. **Overlapping callers no longer collide.** `withTransaction` guards
 *    nesting per *adapter*, not per call stack, so two independent operations
 *    that merely interleave their `await`s — M06's debounced autosave landing
 *    while a list refresh is in flight — would throw `NestedTransactionError`
 *    at a caller that did nothing wrong. Queueing makes that impossible, which
 *    restores the error to meaning what it says: a genuine re-entrant call.
 * 2. **Multi-statement reads see a stable database.** Assembling a page of
 *    notes takes four statements; a write landing between them would return
 *    junction rows that do not match the page. Mutual exclusion is enough for
 *    that, so reads pay for a queue slot rather than for `BEGIN`/`COMMIT`.
 *
 * A single SQLite connection serializes anyway. The queue only makes the order
 * explicit and the failure modes sane.
 */
@Injectable({ providedIn: 'root' })
export class RepositoryContext {
  readonly adapter = inject(DATABASE_ADAPTER);
  private tail: Promise<unknown> = Promise.resolve();

  /** Serialized, but no transaction — nothing here writes. */
  read<T>(operation: string, work: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    return this.enqueue(operation, () => work(this.adapter));
  }

  /** Serialized and wrapped in a single transaction. */
  write<T>(operation: string, work: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    return this.enqueue(operation, () => withTransaction(this.adapter, () => work(this.adapter)));
  }

  private enqueue<T>(operation: string, work: () => Promise<T>): Promise<T> {
    // The queue must survive a failed operation, so the tail is chained off a
    // settled promise rather than off `run` itself.
    const run = this.tail.then(() => translate(operation, work));
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

/**
 * Repository-authored errors pass through untouched; anything else is the
 * adapter's, and the caller has no engine-independent way to read it.
 *
 * `NestedTransactionError` is exempt because the queue is supposed to make it
 * unreachable — if it ever surfaces it is a bug in this file, and burying it
 * inside a `ConstraintViolationError` would send the next reader to the schema.
 */
async function translate<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RepositoryError || error instanceof NestedTransactionError) {
      throw error;
    }
    throw new ConstraintViolationError(operation, error);
  }
}
