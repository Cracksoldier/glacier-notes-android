# Labels, colours, pinning, archive and trash (M08)

M08 puts a UI on the organisational half of the domain model. The repository
behaviour underneath it — the `updatedAt` bump matrix, why `trash()` deliberately
does not bump it, the `ON DELETE CASCADE` on `note_labels` — is in
`docs/repositories.md` and is not repeated here.

This document records what the feature layer decided: when a written note is
swapped into the list versus when the list is reloaded, why the long press is
hand-rolled, and the one startup ordering that looked correct for a whole
milestone while doing nothing at all.

## Replace or reload

Every M08 action writes through `NotesStore`, and each one takes one of two
paths back into the list.

**Replace** — `setPinned` and `setColor`. Neither changes a `WHERE` clause in
`note-queries.ts`, so the note stays in whatever view it was in and the store can
swap the fresh row in place and re-sort.

**Reload** — labels, archive, unarchive, trash, restore, delete-forever and
empty-trash. All of them can change which views cover the note, so the store
re-runs the query rather than reasoning about it.

`NotesStore.replace()` therefore holds exactly one view predicate — M07's
`notebookId` comparison — and it must stay that way. A general `matchesView()`
would be a second encoding of the `WHERE` clauses in `note-queries.ts`, sitting
beside the encoding of their `ORDER BY` that `compareActiveNotes` already keeps.
`docs/repositories.md` names that duplication as the layer's standing hazard; one
copy of it is the budget.

The split has a second, quieter dependency. `sortActiveNotes` encodes the *active*
ordering, while the trash is ordered by `deleted_at DESC`. Pinning or recolouring
a trashed note would therefore re-sort the trash by the wrong key — which is safe
today only because `noteActionChoices` offers neither action in the trash view.
An action added to the trash later must reload, whatever it writes.

## The long press

The desktop reveals a note's action row on hover. There is no hover on a phone,
so the row became an action sheet opened by a long press, and the card stays a
single tap target.

`LongPressTracker` is a timer and some arithmetic over pointer coordinates: 500 ms
to match Android's own long-press timeout, 10 px of movement slop so a press that
turns into a scroll of the note list cancels instead of firing. It lives outside
the component so both numbers can be tested with fake timers, and `up()` reports
whether the press already fired so the click that follows can be swallowed rather
than opening the note.

Two alternatives were rejected:

- **Ionic's `createGesture`** needs a `GestureController` and
  `requestAnimationFrame`, neither of which can be driven under jsdom. It would
  have moved the threshold and the slop into code no spec can reach.
- **The `contextmenu` event** would hand the timing to the WebView and arrive
  together with the native selection callout — the behaviour the card suppresses
  with `-webkit-touch-callout: none` and `user-select: none`. It also carries no
  movement slop of its own, so a press that became a scroll would still fire.

`LabelsStore` is `providedIn: 'root'` and loaded once for the session, for
`NotebooksStore`'s reason: the drawer lists labels for the whole session and has
no navigation event to reload on. Note cards additionally resolve label ids to
names on every render, which a per-card query would turn into a query per card.
`names()` drops ids it has never seen, and `selectedLabelIds` filters the label
picker's answer down to labels that still exist — not defensive padding, but
because the picker can be open while the drawer deletes a label, and `setLabels`
would then fail the foreign key.

## The startup trash purge

The desktop purges expired trash before its UI is available
(`electron/main.ts:266`, audit §6), with a 30-day default and `0` to disable.
This app reproduces that from an app initializer rather than from
`DatabaseService.init()`, which M04 requires to do nothing but open and migrate.

**Angular does not sequence app initializers.**
`ApplicationInitStatus.runInitializers` invokes every initializer in a loop,
collects the promises and then `Promise.all`s them — so registering settings,
then the database, then the purge in that order sequences nothing. Split up, the
purge ran against a database still reporting `initializing` and a settings store
still holding its defaults, returned at its own readiness guard, and deleted
nothing on every launch. It never failed, so nothing said so.

`provideStartup()` in `src/app/core/startup.ts` exists solely to make the
dependency real: one initializer, settings and database opened in parallel, purge
after both. Anything else the app must do before its first paint belongs in that
function, not in a fourth `provideAppInitializer` beside it.

Two things make this failure mode unusually dark, and are why it is covered by a
spec that boots through `ApplicationInitStatus` rather than by calling the
service directly:

- `runStartupPurge` swallows its own errors by design. A rejected initializer
  aborts bootstrap, and failing to delete an old note is never worth a white
  screen.
- `capacitor.config.ts` sets `loggingBehavior: 'none'`, so on a device even the
  `console.error` it falls back to is invisible.

`startup.spec.ts` seeds a note trashed ten days ago against a seven-day stored
window. That single assertion fails under either half of the bug: an unopened
database purges nothing, and unloaded settings leave the default thirty-day
window, which keeps the note.

## The image GC seam

Four M08 paths end with image ids that no longer have a referent — discarding an
empty note, deleting one forever, emptying the trash, and the startup purge.
There are no image *files* until M10, so `ImageGcService.collect` takes the ids
and stops.

It exists now so those four call sites are written once. M10 replaces the body,
and the desktop's rule for it is in `docs/desktop-audit.md` §6: unlink a file only
when it still exists *and* nothing references it, where "references" is the union
of a note's `imageIds` and any `glacier-img://` mention in its body. That check
has to run against the whole collection at once, because two notes can reference
one image.
