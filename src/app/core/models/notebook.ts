/**
 * Desktop `Notebook` (`electron/storage/models.ts`). `color` and `sortOrder` are
 * absent from the Android specification's illustrative shape — the desktop wins
 * (`docs/desktop-audit.md` §1 delta 7).
 *
 * Property order is the export's key order; do not reorder.
 */
export interface Notebook {
  id: string;
  name: string;
  /** Optional: the key is absent, never null, when the notebook has no colour. */
  color?: string;
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
}

/** `electron/storage/notebook-repo.ts:16`. */
export const DEFAULT_NOTEBOOK_NAME = 'Notes';
