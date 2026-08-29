/**
 * Errors the UI is expected to branch on.
 *
 * There is deliberately no SQLite-error-code mapper. The three adapters surface
 * constraint failures differently — `node:sqlite` sets `err.code`, the Capacitor
 * plugin returns a message string, sql.js throws its own shape — so anything
 * built on those codes would be tested against one engine and shipped on
 * another. Repositories pre-check instead, and whatever still escapes is
 * wrapped opaquely.
 *
 * Branch with `instanceof`, never on `name`. Each name is spelled out below
 * rather than taken from `new.target.name`, which in a production build yields
 * the *minified* class name — the device probe for M05 logged `H`.
 */

export class RepositoryError extends Error {
  constructor(message: string, name = 'RepositoryError') {
    super(message);
    this.name = name;
  }
}

export type EntityKind = 'note' | 'notebook' | 'label' | 'image';

export class EntityNotFoundError extends RepositoryError {
  constructor(
    readonly kind: EntityKind,
    readonly id: string,
  ) {
    super(`No ${kind} with id ${id}`, 'EntityNotFoundError');
  }
}

/**
 * A constraint the repository did not pre-check. `cause` carries the adapter's
 * own error; `operation` names what was being attempted, since the message
 * itself is engine-specific and not worth showing to a user.
 */
export class ConstraintViolationError extends RepositoryError {
  constructor(
    readonly operation: string,
    // Narrows `Error.cause`, which is optional on the base type: the adapter's
    // own error is the only diagnostic this carries, so it is never absent.
    override readonly cause: unknown,
  ) {
    super(`Constraint violation during ${operation}`, 'ConstraintViolationError');
  }
}

/**
 * The queue never advanced. Raised by `RepositoryContext`'s watchdog, and in
 * practice always the same bug: a `read`/`write` callback re-entered the context,
 * so its own operation is queued behind itself and neither can ever run.
 *
 * It carries both operation names because that pair is the whole diagnosis —
 * `blocked` is what re-entered and `running` is what it re-entered from.
 */
export class RepositoryDeadlockError extends RepositoryError {
  constructor(
    readonly blocked: string,
    readonly running: string,
  ) {
    super(
      `Operation ${blocked} waited behind ${running} without the queue advancing. ` +
        'A read or write callback most likely re-entered RepositoryContext; ' +
        'bulk work must compose the *-writes.ts primitives inside one write() instead.',
      'RepositoryDeadlockError',
    );
  }
}

export class NotebookNotEmptyError extends RepositoryError {
  constructor(
    readonly notebookId: string,
    readonly noteCount: number,
  ) {
    super(`Notebook ${notebookId} still holds ${noteCount} notes`, 'NotebookNotEmptyError');
  }
}

export class DefaultNotebookError extends RepositoryError {
  constructor(readonly notebookId: string) {
    super(
      `Notebook ${notebookId} is the default notebook and cannot be deleted`,
      'DefaultNotebookError',
    );
  }
}
