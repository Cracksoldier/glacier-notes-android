import { Injectable, inject } from '@angular/core';

import type { DatabaseAdapter } from '../database/database-adapter';
import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';
import { queryImageAssetIds } from './image-queries';
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

/**
 * Every id already stored, by kind.
 *
 * Structurally identical to `ExistingIds` in `transfer-contract.ts`, and declared
 * again here on purpose: `core/import-export` depends on `core/repositories` and
 * not the other way round, so importing the type would invert that.
 */
export interface CollectionIds {
  notebookIds: Set<string>;
  noteIds: Set<string>;
  labelIds: Set<string>;
  imageIds: Set<string>;
}

/**
 * Same one-turn rule as `readCollectionSnapshot`, and the same reason: an import
 * decides both whether the file conflicts and whether the store is pristine from
 * these four sets, and a write landing between two of the reads would let it
 * decide those two questions about different databases.
 *
 * The notes query is unfiltered — a trashed note still owns its id, so a file
 * carrying it conflicts. That is the desktop's `allNotes()`.
 */
export async function readExistingIds(adapter: DatabaseAdapter): Promise<CollectionIds> {
  const ids = async (sql: string): Promise<Set<string>> => {
    const rows = await adapter.query<{ id: string }>(sql);
    return new Set(rows.map((row) => row.id));
  };
  return {
    notebookIds: await ids('SELECT id FROM notebooks'),
    noteIds: await ids('SELECT id FROM notes'),
    labelIds: await ids('SELECT id FROM labels'),
    imageIds: new Set(await queryImageAssetIds(adapter)),
  };
}

@Injectable({ providedIn: 'root' })
export class CollectionRepository {
  private readonly context = inject(RepositoryContext);

  snapshot(): Promise<CollectionSnapshot> {
    return this.context.read('collection.snapshot', readCollectionSnapshot);
  }

  existingIds(): Promise<CollectionIds> {
    return this.context.read('collection.existingIds', readExistingIds);
  }
}
