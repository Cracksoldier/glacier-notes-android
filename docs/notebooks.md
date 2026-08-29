# Notebooks, filtering and the default notebook (M07)

M07 puts a UI on top of the notebook repository M05 already built. The hard
parts — atomic deletion, the dispositions, the `ON DELETE RESTRICT` that forces
them — are described in `docs/repositories.md` and are not repeated here.

This document records only what the feature layer decided: where notebook state
lives, why the delete dialog's logic sits outside the overlay that shows it, and
the one place a SQL `WHERE` clause is deliberately mirrored in TypeScript.

## Where notebook state lives

`NotebooksStore` is `providedIn: 'root'` and loaded once, from `AppComponent`'s
constructor. That is not the pattern `NotesStore` uses, and the reason is the
drawer: it is mounted for the whole session, so it has no navigation event to
reload on. A notebook renamed on the management page has to appear in the drawer
without one.

Four readers then share that single list — the drawer, the management page, the
editor's notebook chip, and the Settings default-notebook picker. A rename is one
write and four updated views.

**The default notebook id is not in `SettingsStore`.** It lives in the
`app_state` table, reached through `NotebookRepository`, because it travels
inside the `.glacier.json` envelope (`docs/desktop-audit.md` §5) and
settings never do (`docs/settings-and-localization.md`). The Settings page has
one row that writes somewhere other than `SettingsStore`, and this is it.

`lastSelectedNotebookId` is written by the notes page but has no reader. The
desktop restores the last sidebar selection at launch; this app always opens on
`/notes`, because cold-starting into a notebook would be surprising on a phone.
The value is kept truthful so a later milestone can decide otherwise.

## Filtering reuses the notes page

`/notebooks/:notebookId` loads `NotesPage`, the same component as `/notes`. The
route parameter binds to an `input()`, and an `effect` calls
`NotesStore.setView()` — a notebook view is the note list with a different
`WHERE` clause, not a second screen. The drawer needs
`routerLinkActiveOptions: { exact: true }` because every notebook path is a
prefix match of `/notebooks`.

Creating a note while viewing a notebook puts it in *that* notebook rather than
the default one. Landing elsewhere would read as a bug.

## Overlays cannot be tested, so they decide nothing

An Ionic overlay cannot be instantiated under jsdom. Any branch taken inside an
`AlertController` callback is therefore a branch no spec can reach.

`notebook-dispositions.ts` exists for that reason alone: it builds the delete
dialog's radio options and maps the chosen value back to a
`NotebookDisposition`, as pure functions. `NotebookPrompts` presents overlays,
collects a value, and hands it over. The dialog's real decisions — which
notebooks may receive the notes, what "delete the notes too" maps to — are
covered by `notebook-dispositions.spec.ts` without an overlay in sight.

Two options are withheld rather than offered and then failed: the notebook being
deleted is not a move target (the repository rejects it), and the default
notebook offers neither *delete* nor *set as default* in its action sheet.
Changing the default is how a notebook becomes deletable — the desktop offers no
way to change it at all, so that flow is Android's own.

The delete dialog counts notes before opening. Deleting optimistically and
reading the count off `NotebookNotEmptyError` would save a query, but an empty
notebook would then be deleted with no confirmation at all.

## The one mirrored predicate

`NotesStore.replace()` drops a note from the list when a notebook view no longer
covers it, using a single `notebookId` comparison. That is the only view
predicate held in TypeScript, and it should stay that way.

A general `matchesView()` would be a second encoding of the `WHERE` clauses in
`note-queries.ts`, sitting next to the encoding of their `ORDER BY` that
`compareActiveNotes` already keeps — the standing hazard named in
`docs/repositories.md`. M08's archive and trash transitions belong in a reload,
not here.

Two related orderings that will otherwise break silently:

- The editor **flushes its pending autosave before** moving a note. Both writes
  bump `updatedAt`; a debounce landing after the move would overwrite the move's
  timestamp with an older one and sort the list wrongly.
- After a delete disposition purges or moves notes, `NotesStore.load()` must run.
  Those rows changed behind the note list's back, in every view.

`moveNote` rethrows where `save` swallows. A move is an explicit user action, not
a background write, so a failure has to surface.
