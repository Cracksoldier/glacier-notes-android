import type { DatabaseAdapter } from '../database/database-adapter';
import { checklistItemToRow, noteToRow } from '../database/row-mapper';
import { type SqlValue, toSqlBoolean } from '../database/sql-value';
import type { ChecklistItem } from '../models/checklist-item';
import { referencedImageIds } from '../models/image-asset';
import type { Note, NoteType } from '../models/note';
import { queryNoteById } from './note-queries';
import { EntityNotFoundError } from './repository-errors';

/**
 * Note writes as plain functions over an adapter, opening no transaction.
 *
 * The boundary belongs to the caller: `withTransaction` refuses to nest, so a
 * primitive that opened its own could never be composed. `NotebookRepository`
 * purges a notebook's notes by calling `purgeNote` inside its own single
 * transaction, and M12's bulk import will compose these the same way — it must
 * not call repository methods in a loop.
 */

export interface NoteCreateInput {
  notebookId: string;
  type: NoteType;
  title?: string;
  content?: string;
  checklist?: ChecklistItem[];
}

/**
 * The desktop's `NoteUpdatePatch` (`models.ts:66-79`), field for field. Notably
 * absent: `notebookId` and `deletedAt`. Moving and trashing are their own
 * operations because they have their own `updatedAt` rules.
 */
export type NoteUpdatePatch = Partial<
  Pick<
    Note,
    | 'type'
    | 'title'
    | 'content'
    | 'checklist'
    | 'pinned'
    | 'archived'
    | 'color'
    | 'labels'
    | 'imageIds'
  >
>;

const NOTE_COLUMNS =
  'id, notebook_id, type, title, content, color, pinned, archived, deleted_at, created_at, updated_at';

export async function insertNote(adapter: DatabaseAdapter, note: Note): Promise<void> {
  const row = noteToRow(note);
  await adapter.run(
    `INSERT INTO notes (${NOTE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.notebook_id,
      row.type,
      row.title,
      row.content,
      row.color,
      row.pinned,
      row.archived,
      row.deleted_at,
      row.created_at,
      row.updated_at,
    ],
  );
  await replaceChecklist(adapter, note.id, note.checklist ?? []);
  await replaceImages(adapter, note.id, note.imageIds);
  await replaceLabels(adapter, note.id, note.labels);
}

/**
 * Applies a patch and bumps `updated_at`, which is what makes this `update` and
 * not `trash`. Columns are named by literals below, never derived from input.
 */
export async function applyNotePatch(
  adapter: DatabaseAdapter,
  id: string,
  patch: NoteUpdatePatch,
  updatedAt: string,
): Promise<void> {
  const assignments: string[] = ['updated_at = ?'];
  const params: SqlValue[] = [updatedAt];
  const set = (column: string, value: SqlValue) => {
    assignments.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.type !== undefined) {
    set('type', patch.type);
  }
  if (patch.title !== undefined) {
    set('title', patch.title);
  }
  if (patch.content !== undefined) {
    set('content', patch.content);
  }
  if (patch.pinned !== undefined) {
    set('pinned', toSqlBoolean(patch.pinned));
  }
  if (patch.archived !== undefined) {
    set('archived', toSqlBoolean(patch.archived));
  }
  // `color` alone is tested by key presence rather than by value: `null` is
  // banned from the domain types, so `{ color: undefined }` is the only way to
  // say "clear it", and it has to be distinguishable from an absent key.
  if ('color' in patch) {
    set('color', patch.color ?? null);
  }

  await adapter.run(`UPDATE notes SET ${assignments.join(', ')} WHERE id = ?`, [...params, id]);

  if (patch.checklist !== undefined) {
    await replaceChecklist(adapter, id, patch.checklist);
  }
  // Turning a checklist into a text note must drop its rows, not merely stop
  // reading them: `noteFromRow` hides the checklist for text notes, so stale
  // rows would silently resurface if the type ever flipped back.
  if (patch.type === 'text') {
    await deleteChecklist(adapter, id);
  }
  if (patch.imageIds !== undefined) {
    await replaceImages(adapter, id, patch.imageIds);
  }
  if (patch.labels !== undefined) {
    await replaceLabels(adapter, id, patch.labels);
  }
}

export async function trashNote(
  adapter: DatabaseAdapter,
  id: string,
  deletedAt: string,
): Promise<void> {
  // No `updated_at` bump — `note-repo.ts:101-106` deliberately leaves it alone,
  // so trashing a note does not reshuffle it if it is ever restored.
  await adapter.run('UPDATE notes SET deleted_at = ? WHERE id = ?', [deletedAt, id]);
}

export async function restoreNote(
  adapter: DatabaseAdapter,
  id: string,
  updatedAt: string,
): Promise<void> {
  await adapter.run('UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?', [
    updatedAt,
    id,
  ]);
}

export async function moveNote(
  adapter: DatabaseAdapter,
  id: string,
  notebookId: string,
  updatedAt: string,
): Promise<void> {
  await adapter.run('UPDATE notes SET notebook_id = ?, updated_at = ? WHERE id = ?', [
    notebookId,
    updatedAt,
    id,
  ]);
}

/**
 * Deletes the note permanently and returns the image ids it referenced, for
 * M10's garbage collector to consider. The union of the declared `imageIds` and
 * the `glacier-img://` references in the body, because an image mentioned only
 * in Markdown would otherwise leave its file behind with nothing pointing at it.
 */
export async function purgeNote(adapter: DatabaseAdapter, id: string): Promise<string[]> {
  const note = await queryNoteById(adapter, id);
  if (!note) {
    throw new EntityNotFoundError('note', id);
  }
  await adapter.run('DELETE FROM notes WHERE id = ?', [id]);
  return referencedImageIds(note);
}

/** Purges the given notes and accumulates the image ids they referenced. */
export async function purgeNotes(
  adapter: DatabaseAdapter,
  ids: readonly string[],
): Promise<string[]> {
  const imageIds: string[] = [];
  for (const id of ids) {
    imageIds.push(...(await purgeNote(adapter, id)));
  }
  return imageIds;
}

export async function requireNoteExists(adapter: DatabaseAdapter, id: string): Promise<void> {
  await requireRow(adapter, 'notes', id, 'note');
}

export async function requireNotebookExists(adapter: DatabaseAdapter, id: string): Promise<void> {
  await requireRow(adapter, 'notebooks', id, 'notebook');
}

export async function requireLabelExists(adapter: DatabaseAdapter, id: string): Promise<void> {
  await requireRow(adapter, 'labels', id, 'label');
}

/**
 * Junctions are reconciled by delete-then-reinsert rather than by diffing:
 * `UNIQUE (note_id, sort_order)` makes an in-place reorder collide with itself
 * halfway through. Checklist item ids are reinserted unchanged, so they stay
 * stable across a reorder; `sort_order` is re-derived from array position, which
 * makes the array the single source of truth for order.
 */
async function replaceChecklist(
  adapter: DatabaseAdapter,
  noteId: string,
  items: readonly ChecklistItem[],
): Promise<void> {
  await deleteChecklist(adapter, noteId);
  let sortOrder = 0;
  for (const item of items) {
    const row = checklistItemToRow(item, noteId, sortOrder++);
    await adapter.run(
      'INSERT INTO checklist_items (id, note_id, text, checked, sort_order) VALUES (?, ?, ?, ?, ?)',
      [row.id, row.note_id, row.text, row.checked, row.sort_order],
    );
  }
}

async function deleteChecklist(adapter: DatabaseAdapter, noteId: string): Promise<void> {
  await adapter.run('DELETE FROM checklist_items WHERE note_id = ?', [noteId]);
}

async function replaceImages(
  adapter: DatabaseAdapter,
  noteId: string,
  imageIds: readonly string[],
): Promise<void> {
  await adapter.run('DELETE FROM note_images WHERE note_id = ?', [noteId]);
  let sortOrder = 0;
  for (const imageId of new Set(imageIds)) {
    await adapter.run('INSERT INTO note_images (note_id, image_id, sort_order) VALUES (?, ?, ?)', [
      noteId,
      imageId,
      sortOrder++,
    ]);
  }
}

async function replaceLabels(
  adapter: DatabaseAdapter,
  noteId: string,
  labelIds: readonly string[],
): Promise<void> {
  await adapter.run('DELETE FROM note_labels WHERE note_id = ?', [noteId]);
  for (const labelId of new Set(labelIds)) {
    await adapter.run('INSERT INTO note_labels (note_id, label_id) VALUES (?, ?)', [
      noteId,
      labelId,
    ]);
  }
}

async function requireRow(
  adapter: DatabaseAdapter,
  table: 'notes' | 'notebooks' | 'labels',
  id: string,
  kind: 'note' | 'notebook' | 'label',
): Promise<void> {
  const rows = await adapter.query(`SELECT 1 AS present FROM ${table} WHERE id = ?`, [id]);
  if (rows.length === 0) {
    throw new EntityNotFoundError(kind, id);
  }
}
