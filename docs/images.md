# Images (M10)

M10 gives `glacier-img://` somewhere to point. The domain half already existed
since M04 — `image_assets`, `note_images`, `ImageAsset`, `referencedImageIds()`,
the sanitizer's `glacier-img:` whitelist. What was missing was the bytes: a
picker, app-private files, a way to display them, and a collector that deletes a
file exactly when nothing points at it any more.

This document records the decisions a reader cannot recover from the code, since
several of them look like arbitrary choices and are load-bearing.

## The picker needs no plugin and no permission

The attach button clicks a hidden `<input type="file">`. Capacitor's
`BridgeWebChromeClient.showFilePicker` turns that into `FileChooserParams
.createIntent()` — the system document/photo picker — and hands the bytes back
as a JS `File`. Listing more than one `accept` type makes it set
`EXTRA_MIME_TYPES`.

The branch above it, the one that opens the camera and needs `CAMERA`, only runs
when the input carries `capture`. **Never add `capture` to that input.** Doing so
would introduce a runtime permission request into an app whose whole storage
story is "no permissions", and the failure would be silent on a device that has
already granted it.

`@capacitor/filesystem` was checked the same way rather than assumed: its
published `android/src/main/AndroidManifest.xml` is an empty `<manifest>`, so
nothing enters the merged manifest. `Directory.Data` is `context.getFilesDir()`.

`accept` is a hint the system dialog may ignore — "Browse" reaches arbitrary
files on some devices — so `validatePick()` re-checks type and size on the file
that actually comes back. That is the check that counts.

## The file name has no extension

A file is stored under its bare image id. `ImageAssetRepository` already
promised this in M04 and M10 keeps it, because it is what lets
`ImageFileStore.url()` be **synchronous and pure**. A note card drawing three
thumbnails resolves them from ids it already holds; with `<id>.<ext>` it would
have to read `image_assets` first, on the list-scrolling path, for every card.

The cost is that the WebView must sniff the media type from the bytes.
`WebViewLocalServer.getMimeType` cannot name the type from an extension-less
path, so the response carries no useful `Content-Type` — but `<img>` sniffs the
bytes itself and renders anyway. PNG, JPEG and WebP were each checked on the
emulator for exactly this reason — WebP is the format the sniff is least likely
to name.

If a future format ever fails this way, the fix is `<id>.<ext>` and it is
contained to `CapacitorImageFileStore` plus a migration of existing file names.

## Display is `convertFileSrc`, not base64 and not `blob:`

`Capacitor.convertFileSrc(path)` returns `<serverUrl>/_capacitor_file_/<abs
path>`, which the WebView streams straight off disk. Three consequences:

- It is **same-origin with the app document**, so the existing CSP's
  `img-src 'self'` covers it and M10 changed no policy.
- **No bytes cross the bridge.** Reading a 10 MB image back as base64 for every
  card thumbnail would not be viable; a `blob:` URL has the same problem plus a
  lifetime to manage.
- `url()` needs no `await`, which is the other half of why the file name is the
  bare id.

Writing is still base64 — `WriteFileOptions.data` supports `Blob` on web only —
but that happens once per attach, not once per render.

The in-memory store used by specs and the browser dev server has no path to hand
out and answers with a `data:` URL instead. That is the only reason `data:`
remains in `img-src`.

## Resolution happens after sanitizing

DOMPurify's `afterSanitizeAttributes` hook deletes any `<img>` whose `src` is not
exactly `glacier-img://<uuid>`. `resolveImageSources()` then rewrites the
survivors to real URLs and records the id in `data-image-id` so a tap can
identify what it hit.

The order is the point: the whitelist stays the only way an `<img>` reaches the
output, and matching `src` with a regex is safe because it runs on markup
DOMPurify has already normalized. `renderToHtml()` stays pure and untouched, so
M06's sanitizer specs still assert on raw output.

This is the Android equivalent of the desktop's `glacier-img.pipe.ts` plus its
Electron protocol handler. Android has no protocol to register without native
code, so the substitution lives in `MarkdownService` — the one place already
allowed to bypass Angular's sanitizer.

## Write ordering is forced by the `RESTRICT` FK

`note_images.image_id` is `ON DELETE RESTRICT`, which fixes the order in both
directions:

**Attaching** — bytes, then the `image_assets` row, then the note patch. A row
inserted before its file would be a claim with no referent; a note patch before
its row would violate the FK outright. A failure at either step rolls the
earlier one back, so a device that runs out of space mid-attach leaves neither a
row nor a file the user cannot reach.

**Removing** — save the note *without* the image first, then collect. Only then
does `unreferenced()` agree the image is gone, and until then the FK refuses the
delete anyway.

**Collecting** — the row first and the file second. The FK is the safety net: a
still-claimed image throws before anything touches the disk. A file that
outlives its row is picked up by the next sweep.

## `unreferenced()` mirrors `referencedImageIds()` in SQL

The desktop's rule is that an image is referenced if a note lists it in
`imageIds` **or** merely mentions it in the Markdown body. The junction only
knows the first half — which is why deleting an image row is `RESTRICT` and not
a cascade — so `ImageAssetRepository.unreferenced()` implements the other half:

```sql
SELECT id FROM image_assets
 WHERE id IN (...)
   AND NOT EXISTS (SELECT 1 FROM note_images WHERE image_id = image_assets.id)
   AND NOT EXISTS (SELECT 1 FROM notes WHERE content LIKE '%' || image_assets.id || '%')
```

A UUID contains no `%` or `_`, so no `ESCAPE` clause is needed.

**This is the same standing hazard `docs/repositories.md` names for the sort
order: one rule, two encodings.** If `referencedImageIds()` ever changes what
counts as a mention, this predicate moves with it, or the collector starts
deleting files that are still on screen. `image-gc.service.spec.ts` asserts both
halves — a junction-only claim and a body-only mention — against a real
database.

## Why the sweep lives inside `provideStartup()`

Two states no single operation can clean up:

- An app killed between writing the bytes and saving the note that would have
  referenced them. The autosave debounce is 500 ms, so this window is real.
- An app killed between deleting a row and unlinking its file.

`sweep()` reconciles both: collect every id the database still knows, then delete
any file whose name is not a surviving id.

It is chained *after* `trash.runStartupPurge()` inside the single initializer,
not registered as a fourth `provideAppInitializer`. Angular invokes every
initializer before awaiting any of them, so a separate registration would
sequence nothing (the reasoning is in `core/startup.ts` and
`docs/labels-and-organization.md`). Running last also means whatever the purge
just freed is collected in the same pass.

**The whole sweep is one `try`.** If the database cannot be read it must abort,
because an empty id list reads as "nothing is referenced" and would take every
file on the device with it. There is a spec for exactly that.

## The full-screen viewer forced `useSetInputAPI: true`

`ImageViewerComponent` is the app's first component created by Ionic rather than
by a template or the router: `modalController.create()` builds it and hands it
`componentProps`. Left at its default, Ionic `Object.assign`s those props onto
the instance, which overwrites an `input()` signal with a plain value — the
template then calls a string, and the modal renders nothing at all, with no error
in logcat. `provideIonicAngular({ useSetInputAPI: true })` in `src/main.ts`
switches Ionic to `setInput()`, which signals understand.

**No test could have caught this.** Every jsdom spec stubs `ImagePrompts`, so the
real `modalController` path is never exercised; the failure is silent, so even an
unstubbed spec would need to assert on rendered modal content. It surfaced only
on the emulator. Any future component reached through `modalController`,
`popoverController` or `actionSheetController` depends on this flag — do not
remove it, and do not assume a green suite covers an overlay's inputs.

## Smaller things worth knowing

**The image button is not a `ToolbarAction`.** Every other toolbar button is a
pure text transform in `applyToolbarAction`; attaching opens a picker and writes
a file. Folding it into that union would make it async and impure, so it is a
separate `(attach)` output.

**Checklist notes get no image button.** A checklist note has an empty
`content`, so a `glacier-img://` reference would have nowhere to render.

**Card previews strip images before rendering.** `MarkdownService.render()`
resolves image sources, so without `stripImageReferences()` an attachment would
appear twice on a card — once inline, once in the thumbnail row. The row also
covers images the 600-character preview truncation cut off, and it draws from
`referencedImageIds()` rather than `imageIds`, so an imported note whose junction
rows are thinner than its body still shows what it embeds.

**A missing file degrades to a neutral box.** `.markdown-body img` carries a
`min-height` and a surface tint so a file deleted underneath the app renders as a
legible box carrying its alt text. Verified on the emulator by deleting a file
under a live note: the WebView still draws its own small broken-image glyph
beside the alt text, which the tint cannot suppress, but the note renders and the
app does not crash.

**Nothing here is ever logged.** Not the bytes, not the original file name. The
sweep's one `console.error` carries the error and nothing else.
