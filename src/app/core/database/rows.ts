import type { NoteType } from '../models/note';

/**
 * The SQLite row shapes, kept deliberately separate from the domain models in
 * `core/models/`. Domain models are the `.glacier.json` contract and use
 * camelCase with absent-when-unset optionals; rows are snake_case with explicit
 * `null`s and 0/1 booleans. `row-mapper.ts` is the only place the two meet.
 *
 * These are `type` aliases rather than `interface`s on purpose: only aliases get
 * an implicit index signature, so `NoteRow extends SqlRow` holds structurally
 * and rows can be passed to the adapter without a cast.
 */

export type SchemaMigrationRow = {
  version: number;
  name: string;
  applied_at: string;
};

export type NotebookRow = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AppStateRow = {
  id: number;
  default_notebook_id: string | null;
};

export type LabelRow = {
  id: string;
  name: string;
};

export type NoteRow = {
  id: string;
  notebook_id: string;
  /** Narrowed to the domain union by the table's `CHECK (type IN ('text','checklist'))`. */
  type: NoteType;
  title: string;
  content: string;
  color: string | null;
  pinned: number;
  archived: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Derived, never authored: the case-folded haystack M11 searches, maintained
   * by `refreshSearchText`. Declared because `SELECT n.*` returns it; it has no
   * domain counterpart and `noteFromRow` deliberately drops it.
   */
  search_text: string;
};

/**
 * A note row as the domain can produce one. `search_text` is derived from the
 * note *and its checklist rows*, so a `Note` alone cannot supply it; the insert
 * names its columns and `refreshSearchText` fills it in afterwards.
 */
export type AuthoredNoteRow = Omit<NoteRow, 'search_text'>;

export type NoteLabelRow = {
  note_id: string;
  label_id: string;
};

export type ChecklistItemRow = {
  id: string;
  note_id: string;
  text: string;
  checked: number;
  sort_order: number;
};

export type ImageAssetRow = {
  id: string;
  mime_type: string;
  file_name: string | null;
};

export type NoteImageRow = {
  note_id: string;
  image_id: string;
  sort_order: number;
};
