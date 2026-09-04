# Hardening (M15)

M00–M14 built the product. M15 is the first pass over its *shipping posture*: the
merged Android manifest was still Capacitor's scaffold, and two of its defaults
contradicted the v1 constraints outright.

This document is the M15 deliverable. It records the permission inventory of the
**release** manifest, the backup policy and why the `allowBackup` attribute alone
does not express it, the four layers that keep a note off the network, the logging
and Markdown/import audits, what the device actually did under each failure mode,
the accessibility results, the large-collection measurements, and the risks
knowingly accepted rather than fixed.

Everything below marked *observed* was exercised on the `A16_AVD` emulator against
a debug APK built from this tree.

## 1. Permission inventory

The artefact to inspect is the **release** merged manifest, not `src/main` and not
the debug one:

```bash
cd android && ANDROID_HOME=$HOME/Android/Sdk ./gradlew processReleaseManifest
# app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml
```

`src/main/AndroidManifest.xml` is only an input. Nine Capacitor plugins and the
whole AndroidX graph merge permissions into the final file, and two of the four
entries below never appeared in any file in this repository.

| Permission | Introduced by | Disposition |
| --- | --- | --- |
| `android.permission.VIBRATE` | `@capacitor/haptics` (`node_modules/@capacitor/haptics/android/src/main/AndroidManifest.xml`) | **Kept.** Ionic Core calls it for checklist drag-reorder feedback. Normal protection level, no runtime prompt, no data access. |
| `com.glacier.notes.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | `androidx.core`, which self-declares it at `protectionLevel="signature"` | **Kept.** It guards `androidx.core`'s own runtime receivers against other apps; only a binary signed with our key can hold it. Not removable without breaking `ContextCompat.registerReceiver`. |
| `android.permission.INTERNET` | Capacitor's scaffold, `src/main` | **Removed** from `main`, re-declared in a debug-only source set. |
| `android.permission.USE_BIOMETRIC`, `android.permission.USE_FINGERPRINT` | `androidx.biometric:1.1.0`, pulled in transitively by `@capacitor-community/sqlite` (`node_modules/@capacitor-community/sqlite/android/build.gradle:68`) | **Removed** with `tools:node="remove"` markers. |

The release manifest contains exactly the first two. Verified:

```console
$ grep -oP '(?<=<uses-permission android:name=")[^"]*' .../release/.../AndroidManifest.xml
android.permission.VIBRATE
com.glacier.notes.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
```

`android:debuggable` is absent from the release manifest and `"true"` in the debug
one, as expected.

### The biometric markers are load-bearing

The v1 constraints refuse PIN, biometrics and SQLCipher. Without the two
`tools:node="remove"` markers the app *requests two biometric permissions for a
feature it has deliberately decided not to have* — purely because the SQLite
plugin's Gradle file lists `androidx.biometric` whether or not the encrypted-database
mode is used.

There is no build failure and no warning when this happens. **Re-check the release
manifest after every `@capacitor-community/sqlite` upgrade**: if the upstream
dependency is renamed or split, the markers stop matching and the permissions come
back silently.

### The debug `INTERNET` split

`android/app/src/debug/AndroidManifest.xml` declares `INTERNET` and nothing else,
so `npx cap run android -l --external` still works against a dev server.

A debug build therefore proves nothing about the shipping posture, and this is the
trap the split creates: verifying "no network" on a debug APK is meaningless,
because that APK is the one that *can* reach the network. Every network claim in
this document rests on the release manifest, on the four layers in §3, or on the
airplane-mode run in §6.

Diffing the two merged manifests shows `INTERNET` as the only permission
difference — observed.

## 2. Backup and data extraction

Capacitor's scaffold shipped `android:allowBackup="true"` with no rules file, which
means Android may upload `glacierSQLite.db` and every attached image to Google
Drive. That directly contradicts the v1 "fully offline, local-only" constraint and
was never a decision anyone made.

The policy chosen with the user: **block cloud backup, allow device-to-device
transfer.** Both ends of a D2D transfer are devices the user is holding, nothing
reaches a Google server, and someone replacing a phone keeps their notes.

Expressing that takes two things, which is the part worth writing down:

- `android:allowBackup="false"` on `<application>`.
- `android:dataExtractionRules="@xml/data_extraction_rules"`.

**On Android 12 (API 31) and above, `allowBackup="false"` stops cloud backup but
does not stop device-to-device transfer.** The attribute alone therefore expresses
"no cloud" but says nothing about D2D — it neither blocks it nor sanctions it. The
rules file is where the real policy lives: `<cloud-backup>` excludes every domain
(`root`, `database`, `sharedpref`, `file`, `external`), and `<device-transfer />`
is left unrestricted on purpose.

Below API 31 the attribute covers everything and D2D does not exist, so API 24–30
is fully handled by `allowBackup="false"` and no `fullBackupContent` companion file
is needed at `minSdk 24`.

### `file_paths.xml`

`FileProvider`'s path map is the other place the app could leak. The scaffold
mapped `<external-path path="." />` — the whole of shared external storage — plus
`<cache-path path="." />`.

The app hands exactly one directory to another app: `Directory.Cache/share`, which
is `SHARE_DIR` in `src/app/core/native/capacitor-share-gateway.ts:12`. The map is
now that one entry and nothing else. The `external-path` entry was removed rather
than left as reachable surface; nothing in the app ever granted a URI under it.

This narrowing has a failure mode that looks like nothing: renaming `SHARE_DIR`
without renaming the path here makes `FileProvider.getUriForFile` throw, the share
gateway catches it, and the user sees the same outcome as cancelling the share
sheet.

## 3. Offline proof

Four independent layers keep a note off the network. They are independent on
purpose: any one of them failing does not open a path.

1. **The sanitizer hook** — `markdown.service.ts:34`, `afterSanitizeAttributes`.
   An `<img>` whose `src` does not match `/^glacier-img:\/\/[0-9a-f-]{36}$/` has the
   *whole node* removed, not just its attribute. A remote URL in a note body
   therefore never becomes an element that could be fetched. Anchors get
   `rel="noopener"`.
2. **The CSP** — `src/index.html:17`. `default-src 'self'`, `connect-src 'self'`,
   `img-src 'self' data: blob:`, `object-src 'none'`, `frame-src 'none'`,
   `form-action 'none'`. A remote fetch that got past the sanitizer is blocked here.
3. **The link handler** — `note-editor.page.ts:556` and `isWebUrl` at `:698`.
   A tapped anchor is re-validated as `http:`/`https:` against a real `URL` parse
   before `window.open`, which leaves the app as an Android intent handled by the
   browser. The WebView itself never navigates.
4. **The absent permission** — §1. Even a bug in all three layers above cannot make
   a socket in a release build.

No font, icon or asset is remote. Grepping the production bundle for `http(s)://`
returns license text, attribution URLs and XML namespaces only — nothing
fetchable. Font Awesome is bundled as SVG icon objects, the fonts are local files,
and `angular.json` keeps `"inlineCritical": false` (M06) so no inline `onload`
handler is generated.

Airplane-mode behaviour is in §6.

## 4. Logging audit

`capacitor.config.ts:9` sets `loggingBehavior: 'none'`. This is not cosmetic:
without it Capacitor's bridge logger writes every SQLite bind value and every
result row to logcat on debug builds, which is note titles and bodies.

There are exactly three `console.*` sites in `src/app`, all `console.error`, all
outside any note read:

| Site | Logs |
| --- | --- |
| `core/database/database.service.ts:40` | that initialization failed, before any note has been read |
| `core/maintenance/trash-maintenance.service.ts:37` | that the auto-purge failed; the surrounding code deals in ids and counts |
| `core/images/image-gc.service.ts:58` | that the sweep failed; ids and counts only |

The standing rules, both of which fail silently when broken:

- **No catch block may log its error.** A filesystem error message carries a path
  and a SQLite one carries bound note text, so `console.error('...', error)` on a
  data path is a content leak wearing a diagnostic's clothes. The three sites above
  are permitted because none of them is on a data path.
- **Only `error.code` may ever be read from a plugin rejection**, never
  `error.message`, which carries the storage provider's path.
  `DocumentsPlugin.java` rejects with constant codes for exactly this reason —
  `ERR_BAD_REQUEST`, `ERR_TOO_LARGE`, `ERR_READ`, `ERR_WRITE` — and passes the code
  as both message and code so a caller that reads the wrong field still leaks
  nothing.

## 5. Markdown and import security recheck

Re-audited in M15; no changes were needed. Recorded here so the next reader does
not have to re-derive it.

- **URI allow-list** — `markdown.service.ts:25` is DOMPurify's default regexp plus
  `glacier-img:`. It is passed as `ALLOWED_URI_REGEXP` to both the block and inline
  render paths.
- **Image `alt` survives.** `markdown.service.ts` sets no `ALLOWED_ATTR`, so
  DOMPurify's default applies and `alt` is kept. `insertImageReference`
  (`core/markdown/markdown-edit.ts:147`) writes the picked filename into it from
  `note-editor.page.ts:500`, so an attached image is named for a screen reader.
- **Image types and size** — `IMAGE_MIME_TYPES` is exactly `image/png`,
  `image/jpeg`, `image/webp`, `image/gif`; `MAX_IMAGE_BYTES` is 10 MB
  (`core/models/image-asset.ts:16,23`). Both are enforced twice: on a picked file
  in `image-picking.ts:15,18`, and on every image in an incoming envelope in
  `envelope-validation.ts:218,230`.
- **No envelope-supplied name reaches the filesystem.** An image file is named
  after its image id with no extension (`core/images/image-file-store.ts:9`), and
  that id has already passed `UUID_PATTERN` in validation. Path traversal has no
  entry point: there is no code path where a string from a `.glacier.json` file
  becomes part of a path.
- **Nothing reaches storage before `validateEnvelope` passes** (M12), and the
  apply is one `write()` turn so a failure rolls the whole thing back (M13). §6
  confirms both on device.

### Malformed imports, observed

Four hand-built files were picked through the real system document picker against
the 2013-note collection. Every one was refused at the preview stage, before
anything reached storage, and the structural snapshot was byte-identical to the one
taken before the run.

| File | Message shown |
| --- | --- |
| 24 bytes of plain text | *"This file cannot be imported. The file is not valid JSON."* |
| valid envelope, one `image/svg+xml` image | *"images[0]: unsupported mimeType"* |
| valid envelope, one 11 MB `image/png` | *"images[0]: invalid base64 data"* |
| the same envelope with a 1 KB image | accepted — *"1 notebooks · 0 notes · 0 labels · 1 images"*, then cancelled |

The last two differ in nothing but the image's byte count, so the third row is the
10 MB cap and not some other rejection. `envelope-validation.ts:224` deliberately
collapses every base64 problem — wrong padding, illegal characters, over the cap —
into one message, because distinguishing them would tell a caller more about the
file than it needs to know.

No message carried a path, a note title or any file content.

### Confirmed non-issues

Recorded rather than "fixed", because each looks like a defect from a distance:

- `English` / `Deutsch` in the language segment
  (`features/settings/settings.page.ts:98,101`) are template literals, which the
  project otherwise forbids. They are **endonyms** and correct: a language picker
  names each language in its own language, so translating them would be the bug.
- The `<access origin="*" />` in `res/xml/config.xml` is dead Cordova scaffold — see §9.

## 6. Failure recovery

Every row was produced on the emulator against the seeded 2013-note collection
(§8). The database was compared with a structural-only query — ids, foreign keys,
flags, timestamps and *lengths* of text columns, never titles or content.

| Failure | Observed behaviour | Evidence |
| --- | --- | --- |
| **Process death during autosave** | `SIGKILL` inside the 500 ms `SAVE_DEBOUNCE_MS` window. Un-flushed keystrokes are lost, which is the contract; the database file was byte-identical afterwards and the app relaunched into a clean list. | db size and mtime unchanged; `integrity_check = ok` |
| **Process death mid-import** | `SIGKILL` 5.0 s into a 13.1 s apply. The db had grown to 5,120,000 B with a 612,864 B rollback journal beside it. On relaunch SQLite replayed the journal, the journal disappeared, and the db returned to exactly 3,997,696 B — its pre-import size — with every table count identical and no orphaned image file. This is the mechanism that makes the all-or-nothing import real. | journal present then gone; counts identical; `integrity_check = ok` |
| **Process death mid-export (share)** | `SIGKILL` while the staged export was being written. The staged file is written by a single `Filesystem.writeFile` call, so no partial file was observable at 100 ms poll granularity — either nothing existed or the complete 2,142,574 B file did. A complete-but-orphaned staged file left behind by the kill was deleted by the startup sweep on the next launch; `cache/share` was empty. The database was untouched. | `cache/share` empty after relaunch; db mtime unchanged |
| **Full disk during import** | Settled in 3.0 s with *"The import failed and nothing was changed. Your notes are as they were."* The database was byte-identical and the message carried no path and no database text. | db unchanged; message text is a translation key, not an error string |
| **Full disk while staging a share** | *"Could not write the export. Free up some space and try again."* `cache/share` did not even exist afterwards — nothing half-written was staged. | directory absent |
| **Missing image file** (row present, file deleted) | The note rendered with the browser's broken-image placeholder and its `alt` text; the rest of the note rendered normally. No toast, no alert, no crash, no retry loop. | manual inspection |
| **Orphaned image file** (file present, no row) | Planted `11111111-2222-3333-4444-555555555555` in `files/images`. The startup sweep deleted exactly that file and left the two referenced ones. | directory listing before/after |
| **Migration that throws** | `DatabaseService` logs the failure (ids only, §4) and the app shows its load-error state with a Retry action rather than an empty list — `NotesPage.isEmpty` tests for `status() === 'ready'` specifically so a failed load is never rendered as "you have no notes". | `notes.page.ts:163` and its spec |
| **Rotation while an edit is pending** | Typed into the body, rotated to landscape inside the 500 ms debounce. The process id was unchanged: the Activity declares `configChanges="orientation\|screenSize\|…"`, so it is not recreated and the WebView — with the editor's signals and its pending timer — survives intact. The debounce then fired normally and the text landed. | pid identical; content length 18 → 26 in the db |
| **Backgrounding while an edit is pending** | Typed, then `KEYCODE_HOME` immediately. The `appStateChange` handler (`note-editor.page.ts:406`) flushes the pending autosave, and the text was in the database two seconds later without the app returning to the foreground. | content length 26 → 29 in the db |
| **Process recreation after backgrounding** | Relaunched cold and reopened the note: the full 29 characters were there. The app always cold-starts on `/notes` rather than restoring the editor route, which is deliberate and unrelated. | reopened editor shows the saved text |

### What could not be forced

**Full disk during a SAF save, and during an image attach, could not be made to
fail.** Android's storage manager reclaims cached space on demand: free space
jumped from 948 KB to 91 MB mid-test and both operations then succeeded. This is
reported as *not verified* rather than *passed*. The import and share-staging rows
above did fail cleanly under the same conditions, and all three share the same
`ENOSPC` handling, but that is an inference and not an observation.

## 7. Accessibility and localization

Method: TalkBack enabled, the app restarted so Chromium rebuilds its virtual view
hierarchy, then `uiautomator dump` on every route in **both English and German**,
reading `content-desc`, `text`, `class` and the `NAF` (Not Accessibility Friendly)
flag off every node.

Two defects were found, both fixed, and both are instances of the same
under-documented Chromium behaviour.

### Chromium drops an `aria-label`-derived name in two cases

| Case | What happens |
| --- | --- |
| A control that maps to a **checkable** Android node — `aria-pressed` promotes an `ion-button` to `android.widget.ToggleButton` | The `aria-label`-derived name is **dropped**. Only a name derived from *content* survives. |
| An element with **no ARIA role** — `ion-reorder` exposes none | A name is prohibited on a role-less element by the accessible-name computation, so the `aria-label` is silently ignored. |

Both produced a node with `content-desc=''`, `text=''` and `NAF='true'` — a
control TalkBack announces as nothing at all, with no console warning, no failing
spec, and no visual difference.

The fix in both cases is hidden text that is real content, not an attribute:

| Control | Fix | Result |
| --- | --- | --- |
| `features/notes/notes.page.ts:64` — the grid/list layout toggle | `.glacier-sr-only` span, `aria-label` removed | `text='NOTE LAYOUT'` / `'NOTIZLAYOUT'` |
| `features/notes/checklist-editor.component.ts:44` — the reorder handle | `.glacier-sr-only` span inside `ion-reorder` | `text='Drag to reorder'` / `'Zum Sortieren ziehen'` |

`.glacier-sr-only` lives in `src/global.scss`. It measures 1×1 px with
`clip-path: inset(50%)`, so neither control changed visually — confirmed on device.

### Everything else was already correct

- Icon-only buttons elsewhere (menu, search, back, FABs, note actions) all carry an
  `aria-label` and are **not** checkable, so Chromium keeps it. Ionic's
  `inheritAttributes` moves `aria-*` from the host onto the shadow
  `button.button-native`, which is the node that reaches the tree.
- A native `<input type="checkbox">` with an `aria-label` **does** keep its
  `content-desc`, so the checklist checkboxes were fine as written. The rule is
  about the *element*, not about checkability alone.
- The note card (`role="button"` + `tabindex="0"`) is focusable and named from its
  own content.
- The search-scope radiogroup takes each chip's name from its text content
  (`{{ i18n.t(chip.labelKey) }}`), which is the pattern that is immune to both
  traps above.
- `ion-searchbar`'s inner EditText reports `NAF='true'` but carries a `hint=`
  attribute, which TalkBack announces. Not a defect.

### Font scale and localization

`font_scale` at 1.3 and 2.0, every route, both languages: no clipped or overlapping
text was found. Both themes were checked on every page; the desktop note colours
render correctly in dark and light.

`en.ts` and `de.ts` hold **218 keys each with identical key sets** — no key exists
in one and not the other, so no string can fall back. Fourteen values are byte-identical
across the two files and all fourteen are correct German as they stand:
`Glacier Notes`, `Orange`, `Import`, `Export`, `Import / Export`, `Labels`, `Code`,
`Link`, `Version {version}`, `Backup`, `System`. Nothing is untranslated.

Airplane mode on, every flow — create, edit, render Markdown with an image, search,
export, import, share — worked, and no font or icon fell back to a default glyph.

## 8. Large-collection evidence

Seeded via an import of a synthetic `.glacier.json`: **2013 notes**, 4 notebooks,
2 labels, 1655 checklist items, 402 note/label links, 2 images. Resulting database
≈ 4.0 MB. Measured on the `A16_AVD` emulator, alongside M11's baselines.

| Operation | Measurement |
| --- | --- |
| Import apply (one `write()` turn) | **13.1 s** |
| Cold note-list load | **0.38 s** (median of 3) |
| Search, matching query | 432–466 ms, including the 200 ms searchbar debounce |
| Search, no-match full scan | **699 ms** |
| Scroll, window grown 30 → 780 cards | frame median **17 ms**, p95 22 ms, max 26 ms — no dropped frames |
| Sort `updatedDesc` / `createdDesc` | 0.52 s / 0.53 s |
| Sort `titleAsc` | **0.69 s**; ordering verified monotonic |
| Export of the whole collection | 2,142,572 B, previewed as "4 notebooks · 2013 notes · 2 labels · 2 images" |

The import number is the one with a hard limit next to it.
`QUEUE_STALL_TIMEOUT_MS` is 30,000 ms (`core/repositories/repository-context.ts:20`)
and the apply is deliberately a single transaction, so 13.1 s leaves roughly 2.3×
headroom. M13's rule stands: an import legitimately slower than the timeout raises
the constant. Splitting the transaction to go faster gives up the rollback that §6
demonstrates, which is the whole point of it.

## 9. Accepted residual risks

Knowingly accepted, not overlooked.

- **`minifyEnabled false`** (`android/app/build.gradle:21`). The release build ships
  unobfuscated, so class and method names are readable in the APK. Deferred to M16
  along with signing; enabling R8 needs its own verification pass because Capacitor
  plugins are reflected into. Nothing about the app's security depends on
  obfuscation — there is no secret in the binary.
- **The unused `sqlcipher-android:4.17.0` AAR**
  (`node_modules/@capacitor-community/sqlite/android/build.gradle:64`). It is linked
  into the APK although v1 refuses SQLCipher, costing binary size and carrying native
  code the app never calls. Removing it means forking or patching the plugin's Gradle
  file, which is a larger maintenance burden than the risk justifies. It contributes
  no permission.
- **`res/xml/config.xml` still contains `<access origin="*" />`.** This is Cordova
  scaffold. Capacitor does not read this file — its own configuration is
  `capacitor.config.ts` — and no Cordova plugin is installed, so the element grants
  nothing. It was left in place rather than edited because it is generated output;
  the risk is that a future reader mistakes it for a live allow-list, which this
  paragraph exists to prevent.
- **No crash reporting, by design.** A crash reporter would need `INTERNET` and
  would ship stack frames and possibly note text off the device. The trade is
  accepted: field failures are invisible, and the app compensates with the recovery
  behaviour in §6 rather than with telemetry.
- **Full-disk SAF save and image attach are unverified**, per §6.
