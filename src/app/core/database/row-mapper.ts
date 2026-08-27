import type { ChecklistItem } from '../models/checklist-item';
import type { ImageAsset } from '../models/image-asset';
import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';
import type {
  ChecklistItemRow,
  ImageAssetRow,
  LabelRow,
  NoteImageRow,
  NoteLabelRow,
  NoteRow,
  NotebookRow,
} from './rows';
import { fromSqlBoolean, toSqlBoolean } from './sql-value';

/**
 * Row ⇄ domain conversion, and the only place the absent-vs-null distinction is
 * enforced.
 *
 * Two properties of the object literals below are load-bearing and must survive
 * any refactor:
 *
 * 1. **Conditional spread, not `undefined`.** `...(x !== null && { k: x })`
 *    leaves the key *absent* when unset. Writing `k: x ?? undefined` would put
 *    the key in the object, and `JSON.stringify` would drop it on export but
 *    `'k' in note` would still be true — the desktop's restore path does
 *    `delete note.deletedAt` and its validator distinguishes the two.
 * 2. **Literal property order is the export's key order.** It is transcribed
 *    from the desktop's `interface Note` declaration order.
 */

export function notebookFromRow(row: NotebookRow): Notebook {
  return {
    id: row.id,
    name: row.name,
    ...(row.color !== null && { color: row.color }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sortOrder: row.sort_order,
  };
}

export function notebookToRow(notebook: Notebook): NotebookRow {
  return {
    id: notebook.id,
    name: notebook.name,
    color: notebook.color ?? null,
    sort_order: notebook.sortOrder,
    created_at: notebook.createdAt,
    updated_at: notebook.updatedAt,
  };
}

export function labelFromRow(row: LabelRow): Label {
  return { id: row.id, name: row.name };
}

export function labelToRow(label: Label): LabelRow {
  return { id: label.id, name: label.name };
}

export function imageAssetFromRow(row: ImageAssetRow): ImageAsset {
  return {
    id: row.id,
    mimeType: row.mime_type,
    ...(row.file_name !== null && { fileName: row.file_name }),
  };
}

export function imageAssetToRow(asset: ImageAsset): ImageAssetRow {
  return {
    id: asset.id,
    mime_type: asset.mimeType,
    file_name: asset.fileName ?? null,
  };
}

export function checklistItemFromRow(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    text: row.text,
    checked: fromSqlBoolean(row.checked),
    sortOrder: row.sort_order,
  };
}

export function checklistItemToRow(
  item: ChecklistItem,
  noteId: string,
  sortOrder: number,
): ChecklistItemRow {
  return {
    id: item.id,
    note_id: noteId,
    text: item.text,
    checked: toSqlBoolean(item.checked),
    sort_order: sortOrder,
  };
}

/** The rows a note needs joined in before it is a complete domain object. */
export interface NoteJoins {
  checklist: ChecklistItem[];
  imageIds: string[];
  labels: string[];
}

export function noteFromRow(row: NoteRow, joins: NoteJoins): Note {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    type: row.type,
    title: row.title,
    content: row.content,
    // Only checklist notes carry the array, matching the desktop's own invariant.
    ...(row.type === 'checklist' && { checklist: joins.checklist }),
    imageIds: joins.imageIds,
    pinned: fromSqlBoolean(row.pinned),
    archived: fromSqlBoolean(row.archived),
    ...(row.color !== null && { color: row.color }),
    labels: joins.labels,
    ...(row.deleted_at !== null && { deletedAt: row.deleted_at }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function noteToRow(note: Note): NoteRow {
  return {
    id: note.id,
    notebook_id: note.notebookId,
    type: note.type,
    title: note.title,
    content: note.content,
    color: note.color ?? null,
    pinned: toSqlBoolean(note.pinned),
    archived: toSqlBoolean(note.archived),
    deleted_at: note.deletedAt ?? null,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}

/**
 * Joins four already-ordered result sets into notes, touching no database.
 *
 * The junction inputs must arrive sorted by `sort_order` within each note —
 * this function preserves the order it is given rather than re-sorting, so a
 * caller that forgets `ORDER BY` gets SQLite's arbitrary order rather than a
 * silently different one. Notes come back in `noteRows` order.
 */
export function assembleNotes(
  noteRows: readonly NoteRow[],
  checklistRows: readonly ChecklistItemRow[],
  imageRows: readonly NoteImageRow[],
  labelRows: readonly NoteLabelRow[],
): Note[] {
  const checklists = groupBy(checklistRows, (row) => row.note_id, checklistItemFromRow);
  const images = groupBy(
    imageRows,
    (row) => row.note_id,
    (row) => row.image_id,
  );
  const labels = groupBy(
    labelRows,
    (row) => row.note_id,
    (row) => row.label_id,
  );

  return noteRows.map((row) =>
    noteFromRow(row, {
      checklist: checklists.get(row.id) ?? [],
      imageIds: images.get(row.id) ?? [],
      labels: labels.get(row.id) ?? [],
    }),
  );
}

function groupBy<TRow, TValue>(
  rows: readonly TRow[],
  key: (row: TRow) => string,
  project: (row: TRow) => TValue,
): Map<string, TValue[]> {
  const grouped = new Map<string, TValue[]>();
  for (const row of rows) {
    const id = key(row);
    const bucket = grouped.get(id);
    if (bucket) {
      bucket.push(project(row));
    } else {
      grouped.set(id, [project(row)]);
    }
  }
  return grouped;
}
