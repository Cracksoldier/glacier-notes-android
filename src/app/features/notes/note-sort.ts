import type { Note } from '../../core/models/note';
import type { NoteSortOrder } from '../../core/preferences/settings.model';
import type { NoteView } from '../../core/repositories/note-queries';

/**
 * Display order, which as of M11 is no longer the SQL order.
 *
 * `titleAsc` cannot be expressed in SQLite: its default collation compares
 * bytes, so `Zebra` sorts before `ähnlich`. `LabelRepository.list` hit the same
 * wall and resolved it the same way — sort in TypeScript with `localeCompare`.
 * Rather than adding two SQL orderings and then mirroring all three here, the
 * two concerns are split: `note-queries.ts` provides a *total* order so its four
 * statements agree on a page, and this file decides what the user sees. The
 * consequence is recorded there: a `NoteWindow` pages in SQL order.
 *
 * Under the default `updatedDesc` every comparator below reproduces its view's
 * SQL order exactly, which `notes.store.spec.ts` cross-checks against a real
 * query. That is what keeps the two encodings honest.
 */

/** Ordering within a group, once pinning and archived-ness have been settled. */
const KEYS: Record<NoteSortOrder, (a: Note, b: Note) => number> = {
  updatedDesc: (a, b) => descending(a.updatedAt, b.updatedAt),
  createdDesc: (a, b) => descending(a.createdAt, b.createdAt),
  // Bare `localeCompare`, as `compareLabels` uses: it is what puts `Äpfel` next
  // to `Apfel` instead of after `Zebra`.
  titleAsc: (a, b) => a.title.localeCompare(b.title),
};

/**
 * The comparator for a view, which is not purely a function of the sort order:
 *
 * - The trash is ordered by deletion time and ignores the setting entirely.
 *   `trash()` does not bump `updatedAt` (`docs/repositories.md`), so any other
 *   key would scatter recently-deleted notes among old ones.
 * - The `'all'` scope keeps archived notes in a block below the active ones,
 *   reproducing the desktop's `[...active(), ...archived()]` while searching.
 *
 * Every comparator ends in `id`, for the same reason the SQL does: without a
 * unique final key two notes sharing a timestamp or a title can swap places
 * between renders.
 */
export function compareNotes(view: NoteView, order: NoteSortOrder): (a: Note, b: Note) => number {
  const scope = view.kind === 'search' ? view.scope : view;

  if (scope.kind === 'trashed') {
    return (a, b) =>
      comparePinned(a, b) || descending(a.deletedAt ?? '', b.deletedAt ?? '') || descendingId(a, b);
  }

  const key = KEYS[order];
  if (scope.kind === 'all') {
    return (a, b) =>
      comparePinned(a, b) || compareArchived(a, b) || key(a, b) || descendingId(a, b);
  }
  return (a, b) => comparePinned(a, b) || key(a, b) || descendingId(a, b);
}

export function sortNotes(
  notes: readonly Note[],
  view: NoteView,
  order: NoteSortOrder,
): readonly Note[] {
  return [...notes].sort(compareNotes(view, order));
}

function comparePinned(a: Note, b: Note): number {
  if (a.pinned === b.pinned) {
    return 0;
  }
  return a.pinned ? -1 : 1;
}

function compareArchived(a: Note, b: Note): number {
  if (a.archived === b.archived) {
    return 0;
  }
  return a.archived ? 1 : -1;
}

function descending(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}

function descendingId(a: Note, b: Note): number {
  return descending(a.id, b.id);
}
