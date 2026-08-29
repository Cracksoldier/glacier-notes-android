import type { DatabaseAdapter } from '../database/database-adapter';
import { notebookToRow } from '../database/row-mapper';
import type { SqlValue } from '../database/sql-value';
import type { Notebook } from '../models/notebook';
import { noteIdsInNotebook } from './note-queries';
import { purgeNote } from './note-writes';

/**
 * Notebook writes as plain functions, opening no transaction — same contract as
 * `note-writes.ts`, so that deleting a notebook and disposing of its notes is a
 * single atomic operation rather than the desktop's two IPC calls, which can
 * half-fail between the move and the delete.
 */

export type NotebookUpdatePatch = Partial<Pick<Notebook, 'name' | 'color' | 'sortOrder'>>;

export async function insertNotebook(adapter: DatabaseAdapter, notebook: Notebook): Promise<void> {
  const row = notebookToRow(notebook);
  await adapter.run(
    'INSERT INTO notebooks (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [row.id, row.name, row.color, row.sort_order, row.created_at, row.updated_at],
  );
}

export async function applyNotebookPatch(
  adapter: DatabaseAdapter,
  id: string,
  patch: NotebookUpdatePatch,
  updatedAt: string,
): Promise<void> {
  const assignments: string[] = ['updated_at = ?'];
  const params: SqlValue[] = [updatedAt];
  const set = (column: string, value: SqlValue) => {
    assignments.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.name !== undefined) {
    set('name', patch.name);
  }
  if (patch.sortOrder !== undefined) {
    set('sort_order', patch.sortOrder);
  }
  // Key presence, not value — see the same rule for a note's colour.
  if ('color' in patch) {
    set('color', patch.color ?? null);
  }

  await adapter.run(`UPDATE notebooks SET ${assignments.join(', ')} WHERE id = ?`, [...params, id]);
}

export async function deleteNotebookRow(adapter: DatabaseAdapter, id: string): Promise<void> {
  await adapter.run('DELETE FROM notebooks WHERE id = ?', [id]);
}

/** `Math.max(-1, ...sortOrders) + 1`, as `notebook-repo.ts:75` computes it. */
export async function nextNotebookSortOrder(adapter: DatabaseAdapter): Promise<number> {
  const [row] = await adapter.query<{ highest: number | null }>(
    'SELECT MAX(sort_order) AS highest FROM notebooks',
  );
  return (row?.highest ?? -1) + 1;
}

export async function readDefaultNotebookId(adapter: DatabaseAdapter): Promise<string | null> {
  const [row] = await adapter.query<{ default_notebook_id: string | null }>(
    'SELECT default_notebook_id FROM app_state WHERE id = 1',
  );
  return row?.default_notebook_id ?? null;
}

/** The foreign key on `app_state.default_notebook_id` rejects an id that is not a notebook. */
export async function writeDefaultNotebookId(
  adapter: DatabaseAdapter,
  notebookId: string,
): Promise<void> {
  await adapter.run('UPDATE app_state SET default_notebook_id = ? WHERE id = 1', [notebookId]);
}

/**
 * Moves every note out of a notebook — archived and trashed included, since the
 * desktop's `moveAllFromNotebook` spans all three lists (`note-store.ts:91-99`)
 * — and bumps `updated_at`, because its per-note `move` does.
 */
export async function moveNotesToNotebook(
  adapter: DatabaseAdapter,
  fromNotebookId: string,
  toNotebookId: string,
  updatedAt: string,
): Promise<void> {
  await adapter.run('UPDATE notes SET notebook_id = ?, updated_at = ? WHERE notebook_id = ?', [
    toNotebookId,
    updatedAt,
    fromNotebookId,
  ]);
}

/** Returns the image ids the purged notes referenced, for M10 to consider. */
export async function purgeNotesInNotebook(
  adapter: DatabaseAdapter,
  notebookId: string,
): Promise<string[]> {
  const imageIds: string[] = [];
  for (const id of await noteIdsInNotebook(adapter, notebookId)) {
    imageIds.push(...(await purgeNote(adapter, id)));
  }
  return imageIds;
}
