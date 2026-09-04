# Search, sorting and large collections (M11)

M11 fills the last non-import gap: `/search` was a placeholder, `sortOrder` was a
persisted setting with one legal value and no reader, and `NotesStore.load()`
fetched and rendered *every* note in a view — each card running `marked` and
DOMPurify over its own preview.

The desktop is authoritative and it does have search. Audited at
`~/Projekte/glacier-notes`, commit `e217a7a`, the same commit
`docs/desktop-audit.md` cites:

- `src/app/features/search/search-model.ts` — `noteMatches()` is a
  case-insensitive **substring** test over `title`, `content` and every
  `checklist[].text`, via `String.toLowerCase().includes()`. Notebook and label
  names are not searched.
- `src/app/features/notes/note-grid.ts` — while a query is present the view
  becomes `[...active(), ...archived()]`, filtered. Trash is never searched.
  Pinned grouping still applies; archived hits get a badge.
- `src/app/core/markdown/highlight.ts` — `splitText` and `highlightHtml` wrap
  matches in `<mark>`, applied after DOMPurify.
- `electron/storage/note-repo.ts` — one sort order, `updatedAt` descending.

This document records the decisions a reader cannot recover from the code.

## 1. Matching happens in JavaScript on both sides

The desktop's `toLowerCase()` folds Unicode correctly. SQLite's `lower()` and
`LIKE` fold **ASCII only**, so a stored `MÜLLER` would never match a query of
`müller` and a German collection would silently lose hits — silently being the
problem, since a search that finds nothing looks the same as a collection that
contains nothing.

So the folding could not move into SQL, and instead of folding at query time in
TypeScript (which would mean reading every note to search) the *haystack* moved:
`notes.search_text` holds the folded concatenation of title, body and checklist
item texts, and the query is folded by the same function before it becomes a
`LIKE` pattern. `core/database/search-text.ts` is the only place either side is
folded.

Three details in that file are load-bearing:

- **`normalize('NFC')` is a deliberate divergence from the desktop**, which does
  a bare `toLowerCase()`. An Android IME can emit a decomposed `ü` where the
  desktop produces the precomposed one; as strings they are not equal. Applied
  symmetrically to haystack and needle it is a strict superset of desktop
  matching for text that is already NFC, which is everything else in the app.
- **Fields are joined with `\n`**, which a single-line searchbar cannot produce.
  Without a separator a query could straddle a field boundary and match text that
  appears in neither field.
- **`escapeLikePattern` is not optional.** `LIKE` reads `%` and `_` as
  wildcards, so a query of `%` would match every note where the desktop's
  `includes('%')` matches almost none. Every `LIKE` built from it carries
  `ESCAPE '\'`.

The body goes in raw — Markdown syntax and `glacier-img://` references included —
because the desktop matches raw `content` too.

## 2. Why FTS5 was rejected

The milestone asks for FTS to be evaluated and allows a "conventional
database-backed fallback". The fallback is the *primary* path here, and not for
want of FTS5 in the build.

**FTS5 matches tokens and prefixes; the desktop matches substrings.** Its default
tokenizer would index `Einkaufsliste` as one token, and neither `MATCH 'kauf'`
nor `MATCH 'kauf*'` finds it — only a prefix would. German compounds make that a
routine query rather than an edge case, and a search that finds fewer notes than
the desktop's would be a behavioural regression, not an optimization.

Trigram tokenization can do substrings, but it costs an index roughly the size of
the corpus and needs the note text duplicated into an FTS table maintained
without triggers (see below). §6 shows what it would be bought against: a `LIKE
'%…%'` scan of 10 000 notes takes 12 ms.

## 3. No trigger maintains `search_text`

`docs/database.md` records that the Capacitor plugin splits statements on
`";\n"`, which shreds a trigger body — so triggers are unavailable app-wide, not
merely declined here.

`refreshSearchText()` therefore runs at the end of `insertNote` and
`applyNotePatch`, **unconditionally and last**:

- *Last*, because it re-reads the checklist rows and so must run after
  `replaceChecklist`/`deleteChecklist`.
- *Unconditionally*, rather than gated on "did title, content, type or checklist
  change". That condition is exactly the kind that drifts out of step with the
  patch shape, and when it drifts the symptom is a note that stops being findable
  with nothing failing anywhere. It costs two statements on a write that already
  runs several.

`trashNote`, `restoreNote` and `moveNote` do not call it — none of them can
change a note's text.

M12's bulk import composes these same primitives inside one `write()` (the rule
in `docs/repositories.md`), so it inherits correct `search_text` without knowing
this column exists.

## 4. Display order left SQL

`NoteView` used to be the row set *and* the ordering. M11 split it: a `NoteScope`
is the row set, and a search is a scope narrowed by a query. Every scope stays
searchable and keeps its own order.

The three sort orders offered are `updatedDesc` (the default and the desktop's
only one), `createdDesc` and `titleAsc`. This is presentation only — nothing here
reaches `.glacier.json`, so desktop compatibility is untouched.

**`titleAsc` cannot be expressed in SQLite.** Its default collation compares
bytes, which puts `Zebra` before `ähnlich`. `LabelRepository.list` hit the same
wall in M05 and resolved it by sorting in TypeScript with `localeCompare`.

Rather than add two more SQL orderings and then mirror all three in TypeScript
anyway, the two concerns were split:

- `note-queries.ts` keeps its orderings, whose job is to be a **total order** so
  the four statements of the `page` CTE agree on which rows they cover.
- `features/notes/note-sort.ts` decides what the user sees, and `NotesStore`
  applies it to the loaded array. Changing sort order costs a re-sort, not a
  query.

**The consequence, which will otherwise surprise someone: a `NoteWindow` pages in
SQL order.** Windowing plus a non-default sort order would show a window of the
wrong notes. No caller passes a window today; one that wants to must move its
sort into SQL first. `note-ordering.spec.ts` asserts that windowed and unwindowed
reads still agree with each other, and `notes.store.spec.ts` cross-checks the
default comparator against a real query — that pair is what keeps the two
encodings from drifting.

Every comparator ends in `id`, for the same reason the SQL does: without a unique
final key two notes sharing a timestamp or a title swap places between renders.

Two orders are not a function of the setting at all. The trash ignores it —
`trash()` does not bump `updatedAt`, so any key but `deletedAt` would scatter
recently-deleted notes among old ones. And the `all` scope keeps archived notes
in a block below the active ones, reproducing the desktop's
`[...active(), ...archived()]`.

## 5. Search is a page, and which actions a hit offers

The desktop searches from a field in its header with one scope toggle beside it.
A phone has room for neither next to the note list, so search is a route with a
searchbar and a chip row: All · This notebook / This label · Archive · Trash.
"All" is the default and is the desktop's behaviour.

The notebook and label chips appear only when the page was reached from one,
which travels as a query parameter so `/search` stays a single route.

Results render through `NoteListComponent`, so pinned grouping, the grid/list
layout and card actions all come for free. But *which* actions apply is the one
thing a search view cannot answer from the view alone: the `all` scope mixes
active notes with archived ones. `effectiveViewKind(note, view)` in
`note-actions.ts` decides it from the note — a pure function outside the overlay
that shows the sheet, per the rule in `docs/notebooks.md`.

**An empty query is never issued.** `LIKE '%%'` matches every note, so a cleared
searchbar would become an unbounded read of the whole collection behind an idle
prompt nobody would see it under.

Highlighting is ported from the desktop verbatim, with one divergence recorded in
`highlight.ts`: it folds with a bare `toLowerCase()` and does *not* NFC-normalize,
although the query that produced the results did. Normalizing changes a string's
length, and the offsets index back into the original text. The cost is a missing
highlight on decomposed text that the row query still matched — a missing mark
rather than a wrong one.

The `mark` rule lives in `global.scss` rather than in the card's own styles,
because emulated view encapsulation does not reach elements injected through
`[innerHTML]`, which is what `highlightHtml` produces. Its ink is
`--glacier-mark-ink`: the desktop draws a highlight as `--color-bg` on
`--color-accent`, which in the light theme is 3.37:1 and below AA for the small
text a card preview renders, so both themes take the dark theme's ink instead
(9.05:1 dark, 4.79:1 light). `variables.spec.ts` asserts those ratios clear AA
rather than asserting the hex, since the threshold is the reason the token exists.

## 6. What the measurements said

`npm run test:bench` runs `src/benchmarks/collection-performance.spec.ts`, which
is excluded from `npm test` — seeding tens of thousands of rows takes long enough
that nobody would run the suite if it did that on every change. It asserts
correctness at size and nothing about wall-clock time, since a threshold would be
a flake generator rather than a regression detector.

Baseline, `node:sqlite` in memory on a 13th-gen i9-13900K under Node 24, median
of five after a discarded warm-up:

| notes | operation | rows | median |
| --- | --- | --- | --- |
| 1 000 | seed, one transaction | 1 000 | 43 ms |
| 1 000 | list active | 900 | 5.1 ms |
| 1 000 | list active, first window | 30 | 0.3 ms |
| 1 000 | search | 125 | 1.1 ms |
| 5 000 | seed, one transaction | 5 000 | 203 ms |
| 5 000 | list active | 4 500 | 29 ms |
| 5 000 | list active, first window | 30 | 0.3 ms |
| 5 000 | search | 625 | 5.4 ms |
| 10 000 | seed, one transaction | 10 000 | 400 ms |
| 10 000 | list active | 9 000 | 58 ms |
| 10 000 | list active, first window | 30 | 0.3 ms |
| 10 000 | search | 1 250 | 12 ms |

A device is slower than this and the Capacitor plugin adds a bridge hop per
statement, so these are a floor rather than a prediction. What carries over is
the *shape*: reading 10 000 notes costs tens of milliseconds and searching them
costs less, while the same read hands `NoteListComponent` 9 000 cards to mount,
each running `marked` and DOMPurify. **SQL was never the ceiling.** Substring
search is not measurably worse than exact-word search either, which is the last
piece of the FTS5 argument in §2.

### The indexes were not changed

`docs/repositories.md` left "whether to append `, id` to `idx_notes_active` and
`idx_notes_notebook`" as M11's call. `EXPLAIN QUERY PLAN` does show the effect:
without the suffix the active list reports `USE TEMP B-TREE FOR LAST TERM OF
ORDER BY`, and with it the plan is a plain index scan. Timed over 10 000 notes
that is 15.6 ms against 11.2 ms, and search is unchanged at ~16 ms because a
leading-wildcard `LIKE` cannot use an index at all.

**Declined.** Four milliseconds on a read the UI stopped doing at full size (see
below), against two permanent extra indexes on the app's busiest write table —
and permanent is literal, because the additive-only contract bans `DROP INDEX`,
so removing them later would take a migration that cannot remove them. The
windowed read those milliseconds actually matter for is 0.3 ms with the indexes
as they are.

`search_text` carries no index either, for the same reason: a `LIKE '%…%'` cannot
use one, so it would cost writes and buy nothing.

## 7. The list renders a window

`NoteListComponent` renders the first 30 notes and grows by 30 whenever a
sentinel element at the foot of the list intersects the viewport. It lives in the
one component that owns rendering, so the notes, archive, trash and search pages
all get it with no change of their own.

CDK virtual scroll was the alternative and does not fit: it needs uniform item
heights and its own scroll viewport, where this list is a multi-column
masonry inside somebody else's `ion-content`. `ion-infinite-scroll` resolves its
scroll host by walking up to an ancestor `ion-content`, which this component does
not own either.

Two properties are load-bearing:

- **The page size must be large enough that one growth pushes the sentinel back
  out of the viewport.** An `IntersectionObserver` reports *changes*; a sentinel
  still in view after the list grew would never report again and the list would
  stop growing halfway down.
- **The window grows and never resets**, shrinking only to fit a shorter list.
  Pinning or colouring a note hands the list a freshly built array
  (`NotesStore.replace()`), and collapsing back to 30 cards under a reader who is
  scrolled into the list would move whatever they were looking at. Carrying the
  window across a view change means a new view renders as much as the last one
  had grown to — bounded by its own length, and always less than the everything
  this used to render.

It is a window, not virtualization: what has been rendered stays rendered, so
scrolling back up does not re-run `marked` over cards already seen.

Card thumbnails carry `loading="lazy"` and `decoding="async"`, since a card
renders full-resolution files into a 56×56 box. Generating real thumbnails was
left out: it touches M10's file lifecycle and the write ordering its
`ON DELETE RESTRICT` forces, and nothing measured here justifies it yet.

jsdom has neither layout nor an `IntersectionObserver`, so `src/test-setup.ts`
stubs one and exports `triggerIntersection()` for specs to drive — the same
arrangement `setMediaQueryMatches` already had, and for the same reason: the file
is where jsdom's gaps are filled, not the individual specs.

## 8. Out of scope, deliberately

- Searching notebook and label **names**. The milestone calls it optional "if
  consistent with desktop behavior"; the desktop does not.
- Online search, AI, OCR and semantic indexing (milestone §Out of scope).
- Image thumbnail generation, per §7.
