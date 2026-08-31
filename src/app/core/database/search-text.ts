import type { DatabaseAdapter } from './database-adapter';

/**
 * The one encoding of what "this note matches this query" means.
 *
 * It lives beside the schema rather than in `core/repositories` because it
 * defines what the `notes.search_text` column *contains*, and migration 002's
 * backfill needs it — `core/database` may not import from `core/repositories`.
 *
 * The desktop decides it in JavaScript — `search-model.ts` does
 * `title.toLowerCase().includes(q)` over the title, the Markdown body and every
 * checklist item's text. Reproducing that in SQL is not possible: SQLite's
 * `lower()` and `LIKE` fold ASCII only, so a stored `MÜLLER` never matches a
 * query of `müller`, and a German note collection would silently lose hits.
 *
 * So the folding stays in JavaScript on *both* sides. `notes.search_text` holds
 * the normalized haystack, written by `refreshSearchText` on every note write
 * (migration 002); the query is normalized by the same function before it
 * becomes a `LIKE` pattern. Nothing else may fold either side.
 */

/**
 * `normalize('NFC')` is a deliberate divergence from the desktop's bare
 * `toLowerCase()`. An Android IME can emit a decomposed `ü` where the desktop
 * would have produced the precomposed one, and the two are not equal as
 * strings. Applied symmetrically to the haystack and the needle it is a strict
 * superset of the desktop's matching for text that is already NFC, which is
 * everything else in the app.
 */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFC').toLowerCase();
}

/**
 * Fields are joined with `\n`, which the single-line searchbar cannot produce,
 * so no query can match across a field boundary and find something that appears
 * in neither field on its own.
 *
 * The body goes in raw, Markdown syntax and `glacier-img://` references
 * included, because the desktop matches against raw `content` too.
 */
export function noteSearchText(
  title: string,
  content: string,
  itemTexts: readonly string[],
): string {
  return normalizeSearchText([title, content, ...itemTexts].join('\n'));
}

/**
 * Not optional. `LIKE` reads `%` and `_` as wildcards, so without this a query
 * of `%` matches every note where the desktop's `includes('%')` matches almost
 * none. The backslash is escaped first, or it would escape the escapes.
 *
 * Every `LIKE` built from this must carry `ESCAPE '\'`.
 */
export function escapeLikePattern(needle: string): string {
  return needle.replace(/[\\%_]/g, '\\$&');
}

/** The `%needle%` a normalized query becomes, ready to bind. */
export function searchPattern(query: string): string {
  return `%${escapeLikePattern(normalizeSearchText(query))}%`;
}

/**
 * Recomputes one note's `search_text` from what is actually in the database.
 *
 * Reading the rows back rather than deriving the value from a domain object is
 * what keeps this a single encoding: `applyNotePatch` only ever sees a partial
 * patch and would otherwise need the unpatched fields fetched anyway.
 *
 * **Call it after the checklist rows are written**, never before — it reads
 * them. There are no triggers to do this instead: `docs/database.md` records
 * that the Capacitor plugin shreds trigger bodies on `";\n"`.
 */
export async function refreshSearchText(adapter: DatabaseAdapter, noteId: string): Promise<void> {
  const [note] = await adapter.query<{ title: string; content: string }>(
    'SELECT title, content FROM notes WHERE id = ?',
    [noteId],
  );
  if (!note) {
    return;
  }
  const items = await adapter.query<{ text: string }>(
    'SELECT text FROM checklist_items WHERE note_id = ? ORDER BY sort_order',
    [noteId],
  );
  await adapter.run('UPDATE notes SET search_text = ? WHERE id = ?', [
    noteSearchText(
      note.title,
      note.content,
      items.map((item) => item.text),
    ),
    noteId,
  ]);
}
