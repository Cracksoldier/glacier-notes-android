# Markdown, the note list and the editor (M06)

M06 is the first milestone whose code a user can see. It ports the desktop's
Markdown pipeline verbatim, then builds the two screens Android needs around it:
a responsive active-note list and a full-screen editor that saves without a save
button.

Most of it is a transcription and needs no defending. This document records only
the parts a reader cannot recover from the desktop source — the three deliberate
divergences, the reason the store exists at all, and the four independent layers
that keep a note from making a network request.

## What was ported unchanged

| Behaviour | Desktop source |
| --- | --- |
| The five selection transforms and their toggle-off maths | `features/notes/markdown-edit.ts:10-92` |
| `marked` with `{ gfm: true, breaks: true, async: false }` | `core/markdown/markdown.service.ts:37` |
| DOMPurify's `FORBID_TAGS` and extended `ALLOWED_URI_REGEXP` | `core/markdown/markdown.service.ts:38-41` |
| The `afterSanitizeAttributes` hook | `core/markdown/markdown.service.ts:20-29` |
| 600-character *source* truncation for card previews | `core/markdown/markdown.service.ts:7,45-52` |
| The 500 ms autosave debounce and its patch shape | `features/notes/note-editor-dialog.ts:31,373-376` |
| Masonry: `columns: 240px; column-gap: 12px`, `break-inside: avoid` | `features/notes/note-grid.scss:5-8` |
| Card geometry, the pinned/others split, the empty-note line | `note-card.scss`, `note-grid.html:21-32` |

`marked` and `dompurify` are pinned to the desktop's majors on purpose. A
`.glacier.json` written on one app and opened on the other must render the same
document, and M12's round-trip depends on it.

Two desktop functions were **not** ported: `renderInline` belongs to checklist
items (M09) and the `highlight` argument to search (M11). Adding them now would
mean shipping untested code paths with no caller.

## The three divergences

**A blockquote button exists here and not on the desktop.** The desktop toolbar
has nine buttons and none of them is a quote (`markdown-toolbar.ts:74-89`); M06
requires one. It is `prefixLines(value, s, e, '> ')` — the same primitive `h1`,
`h2` and `ul` already use, so it inherits their toggle-off behaviour for free.
The desktop's image button was absent instead, because `glacier-img://` had
nothing to point at until M10 gave it files. It now exists, outside the
`ToolbarAction` union rather than in it — see `docs/images.md`.

**Empty notes created in the editor session are discarded.** The desktop keeps
them unconditionally (`electron/storage/note-repo.ts:66-85`). M06's task list
asks for the opposite. The resolution: the FAB creates the row *before*
navigating, so the list is never a lie about what is stored, and passes
`?created=1`. On leaving, a note that this session created and that still has an
empty title and empty body is purged. A pre-existing note the user empties is
never deleted — losing typed text is the one unrecoverable outcome, and the
asymmetry is what keeps the feature from having that failure mode.

**The action-to-transform switch lives in `markdown-edit.ts`, not the editor.**
The desktop keeps it inside the dialog component, where it needs a live
`<textarea>` to run. `applyToolbarAction()` is pure, so every button's mapping
and its toggle-off round trip are asserted without a DOM.

## Why `NotesStore` exists

Ionic calls `ionViewWillLeave` on the page being left, but **does not await it**.
The editor's final flush is asynchronous. A design where the list reloaded from
SQLite on `ionViewWillEnter` would therefore race its own editor: the read can
start before the write commits, and the list intermittently shows the text from
before the last keystrokes.

`NotesStore` removes the race rather than papering over it. The editor writes
*through* the store, so the saved note reaches the list synchronously with the
write that produced it. There is nothing left to reload. This mirrors the
desktop's `core/store/note-store.ts` `updateInPlace`.

**A future refactor that reintroduces reload-on-re-enter reintroduces the bug.**

`save()` also re-sorts, which is what lifts a just-edited note back to the top
without a second database round-trip. That sort is `compareActiveNotes`, a second
encoding of the ordering already expressed in SQL in `note-queries.ts` — risk #1
in `docs/repositories.md`. `notes.store.spec.ts` shuffles the SQL result, re-sorts
it with the TypeScript comparator, and asserts the ids match, over a fixture that
exercises both the `pinned` key and the `id` tiebreaker. If a sort order is ever
added, both sides move together or that spec fails.

## Why a note cannot reach the network

Four independent layers, none of which is load-bearing alone:

1. **The sanitizer removes the node, not the attribute.** The
   `afterSanitizeAttributes` hook deletes any `<img>` whose `src` is not
   `glacier-img://<uuid>`. A neutered `<img>` with a stripped attribute would
   still be an element something later re-populates; a removed one cannot be.
   M10 resolves the surviving references to real URLs *after* this hook has run,
   so the whitelist is still the only way an `<img>` gets into the output.
2. **A `Content-Security-Policy` meta tag in `src/index.html`** with
   `default-src 'self'`, `img-src 'self' data: blob:` and `connect-src 'self'`.
   `style-src` must keep `'unsafe-inline'` because Angular injects component CSS
   as `<style>` tags. M10's resolved URLs are same-origin and covered by
   `'self'`; `data:` is what the browser-only memory file store uses.
3. **The WebView never follows a link itself.** The preview's click handler
   `preventDefault()`s, re-validates the protocol with `new URL()`, and only then
   calls `window.open(href, '_blank')`, which Capacitor turns into an
   `ACTION_VIEW` intent. Letting the WebView navigate would blank the app shell.
   The protocol re-check is redundant against DOMPurify and kept anyway: it is
   one line and the last gate before an intent leaves the app.
4. **M15 removes the `INTERNET` permission**, at which point layers 1–3 are
   defence in depth rather than the defence.

Layer 3's redundancy is the pattern worth keeping: the sanitizer and the click
handler fail differently, so neither one being wrong is sufficient.

The CSP cost one build setting. Angular's `inlineCritical` optimization emits
`<link rel="stylesheet" media="print" onload="this.media='all'">`, and a policy
without `'unsafe-inline'` for scripts blocks that handler — leaving every global
stylesheet at `media="print"` and the app unstyled, with the only evidence a
single logcat line. `angular.json` sets `"inlineCritical": false`. Weakening the
policy to accommodate the handler would have been the wrong trade: the app has
one stylesheet and no measurable benefit from inlining it.

## Why `loggingBehavior` is `'none'`

Capacitor's bridge logger echoes every plugin call and its result to logcat on
debug builds (`native-bridge.js:329,349`). For `CapacitorSQLite` that means the
`UPDATE notes SET … title = ?, content = ?` bind values and every row a `SELECT`
returns — note titles and bodies in the system log, which
`CLAUDE.md` forbids outright. `capacitor.config.ts` sets
`loggingBehavior: 'none'`, which silences both that and the native
`Logger.verbose` call. This is not a release-only concern that M15 can absorb:
debug builds run on real devices during development.

## The list page

`noteLayout` finally gets a reader. The toolbar toggle writes
`SettingsStore.setNoteLayout()`; `grid` is the desktop masonry and `list` a
single full-width column. The masonry needs no media query — a fixed 240px column
width lets the browser pick the count, which is one on a phone and two or more in
landscape.

Cards render pinned notes under a `grid.pinned` heading and the rest under
`grid.others`, exactly as `note-grid.html` does. Nothing in M06 can *set*
`pinned`, but `NoteRepository.list({kind:'active'})` already returns pinned notes
first, so omitting the headings would be quietly wrong the moment M08 lands.

The card shows a title and a rendered preview and nothing else. Colours, labels,
the pin badge and the hover-revealed action row are M08's — and a hover row has
no meaning on a touch screen anyway, so the whole card is one tap target. The
preview carries `pointer-events: none` so a rendered link inside it cannot steal
that tap.

## The editor page

A routed page at `notes/:id` rather than the desktop's `<dialog>`, so Android
hardware back routes through the Ionic router for free and M07/M08 can link
straight to a note. `id` and the `created` query param arrive as signal inputs
through `withComponentInputBinding`.

The flush is forced from three places, which is two more than the desktop needs:

- `ionViewWillLeave()` — the back button, hardware back, any navigation away.
- `App.addListener('appStateChange')` when `isActive === false` — Android may
  kill a backgrounded process with no further callback, so this is the only
  flush guaranteed to run before that happens.
- `ngOnDestroy()` — the belt to the other two braces.

The desktop debounces a second time in its storage layer
(`electron/storage/json-store.ts:68-78`, another 500 ms). Ours does not:
`store.save()` goes straight into a SQLite transaction, which is strictly more
durable and is the whole point of M05.

A failed write sets `saveFailed` and shows a localized non-blocking line. It does
**not** clear the editor's text.

The toolbar is `overflow-x: auto` with 40px touch targets. The desktop fits nine
buttons on one row at 30px each; a 360dp phone cannot, and wrapping to a second
row would push the textarea down every time the keyboard opened.

## Testing notes

Two things about the specs that will otherwise be rediscovered the hard way:

- **Capacitor plugins are proxies**, so `vi.spyOn(App, 'addListener')` throws
  `The property "addListener" is not defined on the object`. The backgrounding
  path is driven by replacing the module with `vi.mock('@capacitor/app', …)`.
- **`fixture.whenStable()` does not wait for the editor's reads and writes.**
  They are plain promise chains, not tracked Angular tasks. The specs await a
  real macrotask instead, which is why every fake-timer test installs the timers
  *after* the page is open.
