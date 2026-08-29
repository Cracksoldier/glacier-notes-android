import { Injectable, inject } from '@angular/core';

import { DATABASE_ADAPTER, type DatabaseAdapter } from '../database/database-adapter';
import { NestedTransactionError, withTransaction } from '../database/transaction';
import {
  ConstraintViolationError,
  RepositoryDeadlockError,
  RepositoryError,
} from './repository-errors';

/**
 * How long a queued operation may wait without the queue advancing before it is
 * declared deadlocked.
 *
 * Generous on purpose. It has to clear the slowest *legitimate* single operation
 * — M12's import composes its primitives inside one `write()`, by design — and a
 * false positive fails a caller that did nothing wrong. Erring long is safe:
 * a real deadlock is permanent, so it will trip this no matter how high it is.
 */
export const QUEUE_STALL_TIMEOUT_MS = 30_000;

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
 *
 * The one thing a queue cannot survive is re-entrancy: a `work` callback that
 * calls back into `read`/`write` queues behind itself and neither half can ever
 * run. That is why bulk work must compose the `*-writes.ts` primitives inside a
 * single `write()` — see `docs/repositories.md`. A WebView has no
 * `AsyncLocalStorage`, so a re-entrant call cannot be told apart from a
 * legitimate concurrent one at the call site; the watchdog below therefore
 * detects the *stall* instead of the call, which is enough to turn a silent hang
 * into a named error.
 */
@Injectable({ providedIn: 'root' })
export class RepositoryContext {
  readonly adapter = inject(DATABASE_ADAPTER);
  private tail: Promise<unknown> = Promise.resolve();
  private running: string | null = null;

  /** Serialized, but no transaction — nothing here writes. */
  read<T>(operation: string, work: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    return this.enqueue(operation, () => work(this.adapter));
  }

  /** Serialized and wrapped in a single transaction. */
  write<T>(operation: string, work: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    return this.enqueue(operation, () => withTransaction(this.adapter, () => work(this.adapter)));
  }

  private enqueue<T>(operation: string, work: () => Promise<T>): Promise<T> {
    const blockedBy = this.running;
    const previous = this.tail;
    let abandoned = false;

    const run = new Promise<T>((resolve, reject) => {
      // Armed only behind something already running: an idle queue cannot stall,
      // and the common case must not pay for a timer.
      const watchdog =
        blockedBy === null
          ? null
          : setTimeout(() => {
              abandoned = true;
              reject(new RepositoryDeadlockError(operation, blockedBy));
            }, QUEUE_STALL_TIMEOUT_MS);

      void previous.then(() => {
        if (watchdog !== null) {
          clearTimeout(watchdog);
        }
        // The caller has already been told this did not happen, so it must not
        // then happen — a watchdog rejection has to mean nothing was written.
        if (abandoned) {
          return;
        }
        this.running = operation;
        void translate(operation, work).then(
          (value) => {
            this.running = null;
            resolve(value);
          },
          (error: unknown) => {
            this.running = null;
            reject(error);
          },
        );
      });
    });

    // Chained off `previous` rather than off `run`, and swallowing both
    // outcomes: the queue must survive a failed operation, and a watchdog
    // rejection must not let the next operation start alongside one that turned
    // out to be merely slow.
    this.tail = previous.then(() => run.then(settled, settled));
    return run;
  }
}

function settled(): undefined {
  return undefined;
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
