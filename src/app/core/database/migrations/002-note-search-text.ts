import type { DatabaseAdapter } from '../database-adapter';
import { noteSearchText } from '../search-text';
import type { Migration } from './migration';

/**
 * `notes.search_text`: the case-folded haystack M11's search matches against.
 *
 * Why a stored column rather than a `LIKE` over `title` and `content` directly:
 * SQLite folds ASCII only, so `MÜLLER` would never match a query of `müller`.
 * `search-text.ts` explains the rest. Why not FTS5: it matches tokens and
 * prefixes, and the desktop's `includes()` is a substring test — `kauf` has to
 * find `Einkaufsliste`. `docs/search-and-sorting.md` records both.
 *
 * `NOT NULL DEFAULT ''` rather than nullable, so the reading side never has to
 * distinguish "no text" from "not backfilled yet"; the seed below fills every
 * existing row inside this migration's transaction.
 *
 * No index. A leading-wildcard `LIKE` cannot use one, so an index here would
 * cost writes and buy nothing.
 */
const STATEMENTS: readonly string[] = [
  "ALTER TABLE notes ADD COLUMN search_text TEXT NOT NULL DEFAULT ''",
];

/**
 * Two reads and one `UPDATE` per note. There is no trigger to do this instead —
 * the Capacitor plugin shreds trigger bodies on `";\n"` (`docs/database.md`) —
 * so `refreshSearchText` maintains the column on every subsequent write, and
 * this covers the rows that already existed.
 */
async function backfill(adapter: DatabaseAdapter): Promise<void> {
  const notes = await adapter.query<{ id: string; title: string; content: string }>(
    'SELECT id, title, content FROM notes',
  );
  const items = await adapter.query<{ note_id: string; text: string }>(
    'SELECT note_id, text FROM checklist_items ORDER BY note_id, sort_order',
  );

  const texts = new Map<string, string[]>();
  for (const item of items) {
    const existing = texts.get(item.note_id);
    if (existing) {
      existing.push(item.text);
    } else {
      texts.set(item.note_id, [item.text]);
    }
  }

  for (const note of notes) {
    await adapter.run('UPDATE notes SET search_text = ? WHERE id = ?', [
      noteSearchText(note.title, note.content, texts.get(note.id) ?? []),
      note.id,
    ]);
  }
}

export const noteSearchTextColumn: Migration = {
  version: 2,
  name: 'note-search-text',
  statements: STATEMENTS,
  seed: backfill,
};
