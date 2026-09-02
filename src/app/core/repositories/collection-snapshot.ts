import { Injectable, inject } from '@angular/core';

import type { DatabaseAdapter } from '../database/database-adapter';
import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';
import { selectLabels } from './label-queries';
import { queryNotes } from './note-queries';
import { selectNotebooks } from './notebook-queries';
import { readDefaultNotebookId } from './notebook-writes';
import { RepositoryContext } from './repository-context';
import { RepositoryError } from './repository-errors';

/**
 * Everything an export needs, read in one turn of the repository queue.
 *
 * Reading it through four repository calls instead would take four turns, and a
 * write landing between any two of them yields a torn export — a note pointing
 * at a notebook that the notebooks array was read too early to contain. So this
 * composes the query primitives inside a single `read()`, which is the same rule
 * `docs/repositories.md` states for bulk writes, applied to a bulk read.
 */
export interface CollectionSnapshot {
  notebooks: Notebook[];
  /** Active, archived and trashed — the desktop's `allNotes()`. */
  notes: Note[];
  labels: Label[];
  defaultNotebookId: string;
}

/**
 * Must be called with an adapter from an open `read()`/`write()` turn and must
 * never re-enter the queue — that is what the free-function shape is for.
 *
 * The note set is the union of two existing scopes rather than a new one.
 * `{kind:'all'}` is `deleted_at IS NULL`, so it covers active and archived but
 * not the trash, and the desktop exports the trash too
 * (`electron/export-import.ts:221`). A seventh `NoteScope` would need an
 * `ORDER BY` that is a total order — the four-statement `page` CTE in
 * `note-queries.ts` depends on it — and would then leak into every exhaustive
 * switch over `NoteScope`, including `compareNotes`, which would have to invent
 * a *display* order for something that is never displayed. Concatenating two
 * pages that already have proven total orders reproduces the desktop's
 * active-then-archived-then-trashed sequence with no new SQL.
 */
export async function readCollectionSnapshot(
  adapter: DatabaseAdapter,
): Promise<CollectionSnapshot> {
  const defaultNotebookId = await readDefaultNotebookId(adapter);
  if (!defaultNotebookId) {
    throw new RepositoryError('No default notebook is set');
  }
  return {
    notebooks: await selectNotebooks(adapter),
    notes: [
      ...(await queryNotes(adapter, { kind: 'all' })),
      ...(await queryNotes(adapter, { kind: 'trashed' })),
    ],
    labels: await selectLabels(adapter),
    defaultNotebookId,
  };
}

@Injectable({ providedIn: 'root' })
export class CollectionRepository {
  private readonly context = inject(RepositoryContext);

  snapshot(): Promise<CollectionSnapshot> {
    return this.context.read('collection.snapshot', readCollectionSnapshot);
  }
}
