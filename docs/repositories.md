# The repository layer (M05)

`src/app/core/repositories/` is the only place above `core/database` that is
allowed to know SQL exists. Everything from M06 onwards reads and writes notes
through the four services here, and never by injecting `DATABASE_ADAPTER`.

Unlike the schema, most of this layer is a **transcription**. The desktop's
`electron/storage/*-repo.ts` already decides what a note repository does, down to
which operations deliberately leave `updatedAt` alone. The parts the desktop has
no answer for — windowed queries, deterministic tie-breaking, typed errors,
atomic notebook deletion — are the parts documented below, because they are the
only parts a reader cannot recover by reading the desktop.

## The layering

```
NoteRepository / NotebookRepository / LabelRepository / ImageAssetRepository
        │  own the transaction boundary, nothing else
        ▼
RepositoryContext.read() / .write()      ← one FIFO queue, one BEGIN
        │
        ▼
note-queries.ts · note-writes.ts · notebook-writes.ts
        │  plain functions over an adapter; open no transaction
        ▼
core/database (DatabaseAdapter, withTransaction, row-mapper)
```

The split between "repository" and "primitive" exists for one reason:
`withTransaction` refuses to nest. A primitive that opened its own transaction
could never be composed, so `NotebookRepository.delete()` could not purge a
notebook's notes by calling `NoteRepository.purge()` in a loop — it would throw
on the second call, and each note would be its own transaction anyway.

Instead every mutation lives in a transaction-agnostic function taking
`(adapter, …)`, and the repository method is a thin wrapper that picks the
boundary. `NotebookRepository.delete()` opens one `write()` and calls the same
`purgeNote()` primitive `NoteRepository.purge()` uses.

**M12's bulk import must do the same.** One `write()` around a loop over these
primitives — never a loop over repository methods, which would give each note its
own transaction and leave a half-imported database behind on failure.

## Why every operation is queued

`RepositoryContext` serializes every read and write through a single promise
chain. This is not about SQLite's own locking, which a single connection handles
already. It buys two things `withTransaction` alone cannot:

**Overlapping callers no longer collide.** `withTransaction` guards nesting with
a `WeakSet` keyed on the *adapter*, not on the call stack. Two independent root
operations that merely interleave their `await`s — M06's debounced autosave
landing while a list refresh is in flight — would both see the flag set and one
would throw `NestedTransactionError` at a caller that did nothing wrong. Queueing
makes that impossible, which restores the error to meaning what it says: a
genuine re-entrant call, and a bug in this layer.

**Multi-statement reads see a stable database.** Assembling a page of notes takes
four statements (below). A write landing between them would return junction rows
belonging to a different set of notes. Mutual exclusion is enough to prevent
that, so reads pay for a queue slot rather than for `BEGIN`/`COMMIT`.

`core/database/transaction.ts` was **not** modified to achieve this. The queue
sits above it.

The cost is a throughput ceiling: no read runs while a write is in flight. That
is the correct default for one connection, but if M11's search makes it hurt,
measure before adding read concurrency.

### The stall watchdog

The queue's failure mode is that a `read`/`write` callback which itself calls
`context.read()` or `context.write()` queues behind the operation it is inside.
It waits for itself, forever, with no error and no rejected promise — the app
simply stops responding to anything that touches the database.

A WebView has no `AsyncLocalStorage`, so re-entrancy cannot be detected at the
call site: a nested call and a legitimately concurrent one look identical. The
guard therefore watches for the *stall* rather than the call. An operation
enqueued behind a running one arms a timer; if the queue has not advanced within
`QUEUE_STALL_TIMEOUT_MS`, it rejects with `RepositoryDeadlockError`, naming both
the blocked operation and the one holding the queue. An idle queue arms nothing,
so the common path is free.

Two properties the implementation depends on: an abandoned operation must never
run afterwards (the caller has already been told it did not happen), and the
tail must chain off the *previous* operation rather than off the abandoned one,
or a merely-slow operation would end up running alongside its successor.

M12's import is the case most likely to meet the timeout legitimately. It should
raise the constant rather than trip it — but note that a bulk import which
composes the `*-writes.ts` primitives inside one `write()`, as it must anyway,
is a single operation and never queues behind itself.

## The read path: four statements, one window

`assembleNotes` needs a page of notes plus the checklist, image and label rows
**for that same page**. The obvious implementation — run the note query, collect
the ids, interpolate `IN (?,?,…)` — builds SQL whose parameter count grows with
the result set, and an unwindowed list of a few thousand notes would cross
`SQLITE_MAX_VARIABLE_NUMBER` (999 on older builds).

So each of the four statements repeats an identical `page` CTE at fixed arity and
re-binds the same parameters:

```sql
WITH page AS (
  SELECT n.id FROM notes n
  WHERE n.deleted_at IS NULL AND n.archived = ?
  ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC
  LIMIT ? OFFSET ?)
SELECT n.* FROM notes n JOIN page p ON p.id = n.id
ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC;
```

The trade is evaluating the window predicate four times — an index range scan of
`offset + limit` rows — in exchange for no string-built SQL and no parameter
limit. `LIMIT -1` is the unwindowed case, so the arity never changes.

### The total-order requirement

**The `page` CTE's `ORDER BY` must be a total order.** Four separate executions
only agree on which rows they cover if the ordering has no ties left to break
arbitrarily. That is what the trailing `n.id DESC` is for, and it is not
optional: without it, two notes sharing an `updated_at` can land in the page in
one execution and outside it in the next, and the assembled note comes back with
another note's checklist.

If a future milestone adds a sort order — M11's alternatives, or search
relevance — it must append a unique tiebreaker. `note-ordering.spec.ts` is the
guard.

The rule is not confined to the windowed query. `LabelRepository.list` sorts by
name alone, and label names are explicitly non-unique, so two same-named labels
could swap places between reads; the M01–M10 review added the same `id`
tiebreaker there. `LabelsStore` shares that comparator by importing
`compareLabels` rather than restating it, because the two encodings had already
drifted once.

`notes.id` is `TEXT` and not a rowid alias, so the tiebreaker costs an
index-ordered scan rather than being free. Accepted for v1; whether to append
`, id` to `idx_notes_active` and `idx_notes_notebook` in a migration 002 is
M11's call.

### Views and their orders

| View | Rows | Order |
| --- | --- | --- |
| `active` | not trashed, not archived | `pinned DESC, updated_at DESC, id DESC` |
| `archived` | not trashed, archived | same |
| `notebook` | active notes in one notebook | same |
| `label` | active notes carrying one label | same |
| `trashed` | trashed, any notebook | `pinned DESC, deleted_at DESC, id DESC` |

`notebook` and `label` are **active-only**, which is not obvious: both desktop
grids read `active()` (`note-grid.ts:42,44`), so an archived note disappears from
its notebook's list rather than staying with a badge.

Pinned-above-unpinned holds in *every* view, including trash, because the desktop
partitions unconditionally (`note-grid.ts:52-53`) rather than per view.

### The trash order is a deliberate deviation

The desktop orders trash by `updatedAt`, like everything else, because its
repository has exactly one sort. But `trash()` does not bump `updatedAt`, so that
order places a note wherever its last *edit* put it — a note deleted today sits
below one edited yesterday. Ordering by `deleted_at DESC` is what the view is
actually for, and `idx_notes_trashed` was built for it in M04.

## The `updatedAt` matrix

This is a contract, not an implementation detail: `updatedAt` drives the default
sort, so any operation that bumps it moves the note to the top of every list.
It is also the field a future synchronization layer would have to reason about,
which is why it is written down here rather than left to be read off the code.

| Operation | `updatedAt` | Source |
| --- | --- | --- |
| `create` | set | `note-repo.ts:64-90` |
| `update` (incl. `setPinned`, `setArchived`, `setLabels`) | **bumped** | `note-store.ts:54,59` route both through `update()` |
| `move` | **bumped** | `note-repo.ts:126-132` |
| `restore` | **bumped**, and `deletedAt` deleted | `note-repo.ts:108-114` |
| `trash` | **untouched** | `note-repo.ts:101-106` |
| deleting a label, which strips it from notes | **untouched** | `stripLabel`, `note-repo.ts:165-172` |
| notebook `delete` with `moveTo` | **bumped** on every note moved | it is a `move` |

`note-timestamps.spec.ts` asserts each row.

## Patch semantics

`update(id, patch)` builds its `SET` list from the keys present in the patch. For
every field but one, "present" means "not `undefined`" — passing `undefined` for
a `title` is a caller bug, not a request to blank it.

`color` is the exception, and is tested with `'color' in patch`. `null` is banned
from the domain models (optional fields are absent keys), so
`{ color: undefined }` is the only way to say "clear the colour", and it has to
stay distinguishable from an absent key. Do not widen `color` to
`string | null` to make this simpler — that would put `null` back into the
`.glacier.json` contract.

Two consequences worth knowing:

- **Patching `type` to `'text'` deletes the note's `checklist_items` rows.**
  `noteFromRow` merely *hides* a text note's checklist, so rows left behind would
  silently resurface if the type ever flipped back.
- **Junctions are reconciled by delete-all-then-reinsert**, not by diffing.
  `UNIQUE (note_id, sort_order)` makes an in-place reorder collide with itself
  halfway through. Checklist item ids are reinserted unchanged, so they stay
  stable across a reorder; `sort_order` is re-derived from array position, which
  makes the array the single source of truth.

Because of that renumbering, every mutation re-reads the note before returning
it. The object a caller gets back is the one that was stored, not the one it
asked for.

## Deleting a notebook

`notes.notebook_id` is `ON DELETE RESTRICT` and a note without a notebook is not
representable, so deleting a non-empty notebook needs an answer to "what happens
to the notes". The desktop asks in a dialog — "Delete the notes too" or "Move
them to:" (`sidebar.ts:83-97`) — and then answers it with two separate IPC calls,
so a failure between them leaves the notes moved and the notebook still there.

Here the answer is an argument, and the whole thing is one transaction:

```ts
notebooks.delete(id);                                      // throws if non-empty
notebooks.delete(id, { notes: 'purge' });                  // → image ids
notebooks.delete(id, { notes: 'moveTo', targetId: other }); 
```

It refuses: the default notebook (`DefaultNotebookError`), a non-empty notebook
with no disposition (`NotebookNotEmptyError`), `targetId === id`, and a target
that does not exist (`EntityNotFoundError`).

The disposition applies to **archived and trashed notes too**. All three hold the
foreign key that blocks the delete, and `moveAllFromNotebook`
(`note-store.ts:91-99`) spans all three lists.

## Errors

```
RepositoryError
├── EntityNotFoundError      kind + id
├── ConstraintViolationError operation + cause
├── NotebookNotEmptyError    notebookId + noteCount
├── DefaultNotebookError     notebookId
└── RepositoryDeadlockError  blocked + running
```

**Branch with `instanceof`, never on `error.name`.** Each class sets its name
from a string literal because `new.target.name` returns the *minified* class name
in a production build — the M05 device probe logged an error called `H`. No spec
can catch that regression, since specs run unminified.

Repositories **pre-check inside the transaction** — a missing note, a missing
notebook on `create`/`move`, a missing `moveTo` target — and throw the specific
error. Whatever still escapes is wrapped opaquely.

**There is deliberately no SQLite-error-code mapper.** The three adapters surface
constraint failures in three different shapes: `node:sqlite` sets `err.code`, the
Capacitor plugin returns a message string, sql.js throws its own. Anything built
on those codes would be tested against one engine in specs and shipped on
another, which is the worst possible place for that class of bug. So
`ConstraintViolationError` carries the operation name and the adapter's original
error as `cause`, and nothing that looks like a portable code.

If M06 genuinely needs to tell a foreign-key failure from a `UNIQUE` failure in
the UI, that needs a per-adapter mapper and three sets of fixtures. Do it then.

`NestedTransactionError` and `RepositoryDeadlockError` are exempt from wrapping.
Both mean a bug in this layer rather than anything the database refused, so
burying either inside a `ConstraintViolationError` would send the next reader to
the schema instead. The queue is supposed to make `NestedTransactionError`
unreachable — and since the M01–M10 review it genuinely is: `withTransaction`
used to leak the adapter into its `WeakSet` whenever `BEGIN` itself failed, which
turned one transient failure into a connection that threw on every later write
until the app restarted.

## What has no repository, and why

**Checklist items and note–label associations.** Both are properties of a note on
the desktop — the checklist is a field inside the note's own JSON — so they are
persisted through `NoteRepository` (`update`'s `checklist` and `labels` keys,
plus `setLabels`). M09 may add item-level operations if the checklist UI needs
them; inventing them now would be scope M09 has not defined.

**Image bytes.** `ImageAssetRepository` holds metadata only. `purge()` returns
candidate image ids and stops there — deleting files, and deciding whether an id
is still referenced, is M10's.

Those candidates are the **union** of the note's declared `imageIds` and the
`glacier-img://<id>` references in its Markdown body. Returning only the declared
ids would leave an image that was merely embedded with nothing pointing at it and
no way to find its file again.

## Notes for M12 (import/export)

- **Label array order is not round-trip stable.** `note_labels` has no ordering
  column, so labels come back sorted by `label_id`, not in the order they were
  written. Compare labels as *sets*. Adding a `sort_order` there would be an
  invented field: the desktop's `labels` is a plain array with no ordering
  semantics.
- **Checklist `sortOrder` is renumbered** to `0..n-1` on write, so an imported
  note whose items carry sparse or duplicate values comes back renumbered. The
  array order is preserved; the numbers are not.
- **Compose primitives, not repository methods** — see the layering section.

## What the specs cannot cover

The specs run on `node:sqlite`; the device runs the Capacitor plugin. Nothing
here proves the plugin's `run`/`query` behave identically under the same SQL,
only that the SQL is correct against a real SQLite. M04's on-device verification
covers the adapter; M05's covers the repositories driving it.

Concurrency is likewise only tested as *interleaving*, since JavaScript gives us
one thread. The queue is what makes that the only kind of concurrency there is.
