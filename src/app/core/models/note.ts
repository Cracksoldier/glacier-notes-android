import type { ChecklistItem } from './checklist-item';

/** `'text'`, not `'markdown'` — `docs/desktop-audit.md` §1 delta 1. */
export type NoteType = 'text' | 'checklist';

/**
 * Desktop `Note` (`electron/storage/models.ts`), transcribed field-for-field
 * including declaration order, which is the key order of every exported note.
 *
 * The optional properties are optional in the strict sense: when unset the key
 * is **absent**, not `null` and not `undefined`. The desktop's restore path
 * does `delete note.deletedAt`, and its validator distinguishes the two.
 */
export interface Note {
  id: string;
  /** Never null — every note belongs to a notebook (§1 delta 2). */
  notebookId: string;
  type: NoteType;
  title: string;
  content: string;
  /** Present only when `type === 'checklist'`. */
  checklist?: ChecklistItem[];
  imageIds: string[];
  pinned: boolean;
  archived: boolean;
  /** Bare palette name, e.g. `"teal"` (§2). Unknown values degrade to no colour. */
  color?: string;
  /** Label ids. The field is `labels`, not `labelIds` (§1 delta 3). */
  labels: string[];
  /** Absent while the note is active (§1 delta 5). */
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function isNoteType(value: unknown): value is NoteType {
  return value === 'text' || value === 'checklist';
}
