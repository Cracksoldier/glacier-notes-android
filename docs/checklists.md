# Checklist notes and item ordering (M09)

M04 and M05 already carried checklists end to end: `checklist_items` exists,
`NoteRepository.create`/`update` accept a `checklist` array, and the `page` CTE
hydrates one on every read. M09 only added the UI. The persistence side is
described in `docs/database.md` and `docs/repositories.md` and is not repeated
here.

What follows is what the feature layer decided: why there are two orderings,
why a single ticked box rewrites the whole array, and why the checklist editor
is a branch inside the note editor rather than a page of its own.

## Two orderings, and the one place they merge

`sortOrder` is canonical. It is what `checklist_items.sort_order` stores and
what `checklistToText` walks (`checklist-model.ts:85`). Everything the user
sees goes through `displayOrder` (`checklist-model.ts:25`), which sorts by
`sortOrder` and then, if the `moveCheckedToBottom` setting is on, moves the
checked items to the end.

That grouping is **display only**. Ticking a box never renumbers anything, so
unticking it returns the item to where it was rather than to the bottom of the
list. This is what M09's "no silent reordering" criterion is about, and it is
observable: with three items stored `0,1,2` and the middle one unchecked, the
card and editor show the unchecked one first while the database still reads
`0,1,2`.

The single exception is a **drag**. `reorderItems` (`checklist-model.ts:47`)
takes indices into the *displayed* list, so dropping an item while
`moveCheckedToBottom` is on commits the grouped order into `sortOrder`
permanently. That is the desktop's behaviour, and the distinction that makes it
acceptable is intent: a drag is an explicit reordering gesture, a checkbox is
not.

Both readers of `displayOrder` — the editor (`checklist-editor.component.ts:161`)
and the card (`note-card.component.ts:209`) — pass the same setting, so the two
never disagree about what the list looks like.

## Every mutation rewrites the whole array

`replaceChecklist` (`note-writes.ts:212`) deletes every row for the note and
reinserts them, re-deriving `sort_order` from array position. It is not an
optimization gap. `UNIQUE (note_id, sort_order)`
(`migrations/001-initial-schema.ts:74`) makes an in-place reorder collide with
itself: moving item 3 to position 1 has to pass through a state where two rows
claim the same slot, and there is no deferred-constraint escape in SQLite here.
`docs/database.md:233` records the same reasoning from the schema side.

Item **ids are reinserted unchanged**, which is what makes a reorder survive as
a reorder rather than as three new items. The UI depends on this: `@for`'s
`track item.id` and the `pendingFocusId` focus restore both break if ids churn.

`resequence` (`checklist-model.ts:37`) renumbers from array position using the
same rule the writer does, so the in-memory array and the rows agree without a
round trip.

Turning a checklist into a text note is handled separately: `applyNotePatch`
deletes the rows on `type: 'text'` (`note-writes.ts:121`) rather than leaving
them unread, because `noteFromRow` hides a checklist for text notes and stale
rows would resurface if the type ever flipped back.

## The checklist editor lives inside `NoteEditorPage`

There is no second route. `NoteEditorPage` branches on `isChecklist()` and
swaps the Markdown toolbar plus textarea for `<app-checklist-editor>`
(`note-editor.page.ts:152`).

The reason is that everything *around* the body is identical for both kinds of
note and none of it is trivial: the 500 ms autosave debounce, the
`appStateChange` flush that is the only one guaranteed to run before Android
kills a backgrounded process, `ionViewWillLeave`/`ngOnDestroy` → `leave()`, the
discard-empty rule, the notebook chip and the label chip. A second page would
have had to reproduce all of it, and the conversion action would then have had
to navigate between two routes for what is one row changing a column.

Two consequences worth knowing:

- `flush()` writes `{ title, checklist }` for a checklist note and
  `{ title, content }` for a text note, never both (`note-editor.page.ts:463`).
  The patch is key-presence based (`docs/repositories.md`), so sending both
  would leave stale Markdown sitting behind the items.
- `convert()` flushes first and then writes `type`, `content` and `checklist`
  as **one** patch (`note-editor.page.ts:476`). Flushing first is the same
  `updatedAt` rule `chooseNotebook` documents; the single patch is so the note
  can never be observed as a checklist with no items or a text note with no
  body.

The discard-empty rule extends to checklists through `isEmptyBody`
(`note-editor.page.ts:509`): a checklist of blank placeholder rows is as empty
as an untouched textarea, so a note created from the FAB and abandoned is still
discarded.

## `<input>` in the editor, `renderInline` on the card

Item text is Markdown source. The editor edits it, so it is a plain
`<input type="text">` showing exactly the characters stored
(`checklist-editor.component.ts:47`). The card displays it, so it runs through
`MarkdownService.renderInline` (`note-card.component.ts:216`), which is
`marked.parseInline` — inline emphasis and links render, block elements do not,
and `img`/`input`/`button`/`form` are stripped
(`markdown.service.ts:72`). A card is a preview; it must not grow a heading or
a nested list out of one item.

The card also drops blank items before slicing to `CARD_ITEM_LIMIT`
(`note-card.component.ts:211`) and counts the remainder for the `+N more` line.
A card is not the place to advertise an unfinished row.

## `ion-reorder-group`, even though M08 hand-rolled its long press

M08 wrote its own long-press tracker rather than using Ionic's `createGesture`,
so using `ion-reorder-group` here looks inconsistent. It is not, and the
reason is the same one in both cases: **the decision has to end up in a pure
function.**

`createGesture` would have handed the card a stream of coordinates to interpret,
which is logic no jsdom spec can drive. `ionItemReorder` hands over plain
`from`/`to` indices, so `onReorder` (`checklist-editor.component.ts:226`) is
three lines that call `reorderItems` — and a spec can synthesize the event
detail directly, which `checklist-editor.component.spec.ts` does. The desktop's
HTML5 drag-and-drop was not an option regardless: `dragstart` never fires from
a touch screen.

`complete(false)` is deliberate. The signal write has already reordered the
list, so letting Ionic also move its dragged node would leave Angular's view
order out of step with the DOM. Confirmed on the emulator: there is no visible
snap-back.

## Testing gotcha

`ion-button` relocates its `aria-label` onto its inner native button during
hydration, and under jsdom that happens asynchronously. A spec that queries
`button[aria-label="…"]` for a header action will intermittently find nothing.
Target a stable class instead — `.editor__convert`, `.editor__preview-toggle`
(`note-editor.page.spec.ts:134`). Plain `<button>` elements in this feature,
such as the checklist row's remove button, are unaffected.
