import type { DatabaseAdapter } from '../database/database-adapter';
import { assembleNotes } from '../database/row-mapper';
import type { ChecklistItemRow, NoteImageRow, NoteLabelRow, NoteRow } from '../database/rows';
import { searchPattern } from '../database/search-text';
import type { SqlValue } from '../database/sql-value';
import type { Note } from '../models/note';

/**
 * The note read path: four statements that must agree on which notes they cover.
 *
 * `assembleNotes` needs one page of notes plus the checklist, image and label
 * rows *for that same page*. Collecting the ids from the first query and
 * interpolating `IN (?,?,…)` into the other three would build SQL whose arity
 * grows with the result set, and an unwindowed list would eventually cross
 * `SQLITE_MAX_VARIABLE_NUMBER` (999 on older builds). So each statement instead
 * repeats an identical `page` CTE at fixed arity and re-binds the same
 * parameters. The cost is evaluating the window predicate four times — an index
 * range scan over `offset + limit` rows.
 *
 * **The CTE's `ORDER BY` must be a total order.** Four separate executions only
 * select the same rows if the ordering has no ties to break arbitrarily, which
 * is what the trailing `n.id DESC` is for. It is not decoration: drop it and a
 * page of notes can disagree with its own junction rows whenever two notes share
 * an `updated_at`.
 *
 * **The SQL order is a total order, not the display order.** M11 gave the user
 * three sort orders, one of which (`titleAsc`) SQLite cannot express — its
 * default collation compares bytes and puts `Zebra` before `ähnlich`. So the
 * display order moved to a comparator in `features/notes/note-sort.ts` and the
 * orderings below exist only so the four statements agree on a page. The
 * consequence, which a future caller will otherwise be surprised by: **a
 * `NoteWindow` pages in SQL order**, so windowing plus a non-default sort order
 * would show a window of the wrong notes. No caller passes one today; a caller
 * that wants to would have to move its sort into SQL first.
 */

/**
 * Which notes a view covers, independent of whether a query narrows it further.
 *
 * `'all'` is active *and* archived, and only search reaches it: the desktop's
 * grid replaces the view with `[...active(), ...archived()]` while a query is
 * present (`note-grid.ts`), and never shows that mixture otherwise. Trash is not
 * part of it — the desktop never searches deleted notes.
 */
export type NoteScope =
  | { kind: 'active' }
  | { kind: 'archived' }
  | { kind: 'trashed' }
  | { kind: 'notebook'; notebookId: string }
  | { kind: 'label'; labelId: string }
  | { kind: 'all' };

/** A scope, or a scope narrowed by a query. */
export type NoteView = NoteScope | { kind: 'search'; query: string; scope: NoteScope };

/** Absent means the whole result set; `SQLite` reads `LIMIT -1` as unbounded. */
export interface NoteWindow {
  limit?: number;
  offset?: number;
}

/**
 * Pinned above unpinned in every view, matching the desktop — its repository
 * sorts by `updatedAt` alone and its grid then partitions pinned notes above the
 * rest (`note-grid.ts:52-53`), which concatenates to exactly this order.
 */
const ACTIVE_ORDER = 'n.pinned DESC, n.updated_at DESC, n.id DESC';

/**
 * Trash orders by deletion time — a deliberate deviation. `trash()` does not
 * bump `updatedAt`, so the desktop's single sort leaves recently-deleted notes
 * wherever their last edit put them. `idx_notes_trashed` exists for this.
 */
const TRASH_ORDER = 'n.pinned DESC, n.deleted_at DESC, n.id DESC';

/**
 * `archived ASC` before the timestamp is what reproduces the desktop's
 * `[...active(), ...archived()]` concatenation: an active block, then an
 * archived one, each internally by recency.
 */
const ALL_ORDER = 'n.pinned DESC, n.archived ASC, n.updated_at DESC, n.id DESC';

interface Page {
  /** A `SELECT n.id FROM notes n …` statement producing a total order. */
  readonly sql: string;
  readonly params: readonly SqlValue[];
  /** Repeated on the outer note query, since a join does not preserve the CTE's order. */
  readonly order: string;
}

export function queryNotes(
  adapter: DatabaseAdapter,
  view: NoteView,
  window: NoteWindow = {},
): Promise<Note[]> {
  return loadPage(adapter, viewPage(view, window));
}

/** The same four statements over a one-note window, so both paths assemble alike. */
export async function queryNoteById(
  adapter: DatabaseAdapter,
  id: string,
): Promise<Note | undefined> {
  const [note] = await loadPage(adapter, {
    sql: 'SELECT n.id FROM notes n WHERE n.id = ?',
    params: [id],
    order: ACTIVE_ORDER,
  });
  return note;
}

export async function countNotesInNotebook(
  adapter: DatabaseAdapter,
  notebookId: string,
): Promise<number> {
  const [row] = await adapter.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM notes WHERE notebook_id = ?',
    [notebookId],
  );
  return row?.count ?? 0;
}

/** Every note in a notebook, trashed and archived included — used by the disposition paths. */
export async function noteIdsInNotebook(
  adapter: DatabaseAdapter,
  notebookId: string,
): Promise<string[]> {
  const rows = await adapter.query<{ id: string }>(
    'SELECT id FROM notes WHERE notebook_id = ? ORDER BY id',
    [notebookId],
  );
  return rows.map((row) => row.id);
}

/**
 * Trashed note ids, optionally only those trashed before a cutoff.
 *
 * The desktop compares `deletedAt` against a single cutoff rather than counting
 * days per note (`note-repo.ts` `purgeExpired`), so the boundary moves for every
 * note at once instead of stranding individual ones.
 */
export async function trashedNoteIds(
  adapter: DatabaseAdapter,
  cutoffIso?: string,
): Promise<string[]> {
  const rows =
    cutoffIso === undefined
      ? await adapter.query<{ id: string }>(
          'SELECT id FROM notes WHERE deleted_at IS NOT NULL ORDER BY id',
        )
      : await adapter.query<{ id: string }>(
          'SELECT id FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ? ORDER BY id',
          [cutoffIso],
        );
  return rows.map((row) => row.id);
}

/** A scope's row set, before the window is applied. */
interface Selection {
  /** Everything after `FROM`, so a view may join. `notes` is always aliased `n`. */
  readonly from: string;
  readonly where: string;
  readonly params: readonly SqlValue[];
  readonly order: string;
}

function scopeSelection(scope: NoteScope): Selection {
  switch (scope.kind) {
    case 'active':
    case 'archived':
      return {
        from: 'notes n',
        where: 'n.deleted_at IS NULL AND n.archived = ?',
        params: [scope.kind === 'archived' ? 1 : 0],
        order: ACTIVE_ORDER,
      };
    case 'all':
      return {
        from: 'notes n',
        where: 'n.deleted_at IS NULL',
        params: [],
        order: ALL_ORDER,
      };
    case 'trashed':
      return {
        from: 'notes n',
        where: 'n.deleted_at IS NOT NULL',
        params: [],
        order: TRASH_ORDER,
      };
    // Both remaining scopes are active-only on the desktop: the notebook and
    // label grids read `active()`, which excludes archived and trashed alike.
    case 'notebook':
      return {
        from: 'notes n',
        where: 'n.deleted_at IS NULL AND n.archived = 0 AND n.notebook_id = ?',
        params: [scope.notebookId],
        order: ACTIVE_ORDER,
      };
    case 'label':
      return {
        from: 'notes n JOIN note_labels nl ON nl.note_id = n.id',
        where: 'nl.label_id = ? AND n.deleted_at IS NULL AND n.archived = 0',
        params: [scope.labelId],
        order: ACTIVE_ORDER,
      };
  }
}

/**
 * Search is a predicate over a scope, not a scope of its own — so every scope
 * stays searchable and each keeps its own ordering.
 *
 * `ESCAPE '\'` is mandatory and pairs with `escapeLikePattern`: without it a
 * query of `%` matches every note, where the desktop's `includes('%')` matches
 * almost none. Both sides of the comparison were folded in JavaScript
 * (`search-text.ts`), because SQLite's `LIKE` folds ASCII only.
 */
function searchSelection(query: string, scope: NoteScope): Selection {
  const base = scopeSelection(scope);
  return {
    ...base,
    where: `${base.where} AND n.search_text LIKE ? ESCAPE '\\'`,
    params: [...base.params, searchPattern(query)],
  };
}

function viewPage(view: NoteView, window: NoteWindow): Page {
  const selection =
    view.kind === 'search' ? searchSelection(view.query, view.scope) : scopeSelection(view);

  return {
    sql: `SELECT n.id FROM ${selection.from}
          WHERE ${selection.where}
          ORDER BY ${selection.order} LIMIT ? OFFSET ?`,
    params: [...selection.params, window.limit ?? -1, window.offset ?? 0],
    order: selection.order,
  };
}

async function loadPage(adapter: DatabaseAdapter, page: Page): Promise<Note[]> {
  const scoped = (rest: string) => `WITH page AS (${page.sql}) ${rest}`;

  // Sequential rather than `Promise.all`: the adapter contract is one statement
  // at a time, and the Capacitor plugin holds a single connection.
  //
  // Junction rows only need ordering *within* a note — `assembleNotes` groups by
  // note id preserving insertion order, and takes note order from `noteRows`.
  const noteRows = await adapter.query<NoteRow>(
    scoped(`SELECT n.* FROM notes n JOIN page p ON p.id = n.id ORDER BY ${page.order}`),
    page.params,
  );
  const checklistRows = await adapter.query<ChecklistItemRow>(
    scoped(`SELECT c.* FROM checklist_items c JOIN page p ON p.id = c.note_id
            ORDER BY c.note_id, c.sort_order`),
    page.params,
  );
  const imageRows = await adapter.query<NoteImageRow>(
    scoped(`SELECT i.* FROM note_images i JOIN page p ON p.id = i.note_id
            ORDER BY i.note_id, i.sort_order`),
    page.params,
  );
  // `note_labels` has no ordering column, so `label_id` is the only stable
  // choice. Label array order is therefore not preserved across a round trip.
  const labelRows = await adapter.query<NoteLabelRow>(
    scoped(`SELECT l.* FROM note_labels l JOIN page p ON p.id = l.note_id
            ORDER BY l.note_id, l.label_id`),
    page.params,
  );

  return assembleNotes(noteRows, checklistRows, imageRows, labelRows);
}
