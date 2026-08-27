/**
 * Desktop `ChecklistItem` (`electron/storage/models.ts`). On the desktop these
 * are *embedded* in the note's JSON, not a standalone entity — hence no
 * `noteId`, no timestamps (`docs/desktop-audit.md` §1 delta 4). Android stores
 * them in their own table for queryability, but the exported shape is this one.
 */
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  sortOrder: number;
}
