# Desktop reference audit (M00)

Evidence-backed baseline extracted from the canonical Glacier Notes desktop application before any
Android implementation decisions are made.

- **Source repository:** <https://github.com/Cracksoldier/glacier-notes> (public, MIT)
- **Audited commit:** `e217a7acbddbfc32077387dbd5c37e688bb89570` ("Start 0.3.0 development", 2026-07-31)
- **Local checkout used:** `~/Projekte/glacier-notes`
- **Desktop stack:** Electron 43 main process + Angular 22 renderer, persistence via plain JSON files
- **Audit date:** 2026-08-25

Every claim below cites the desktop file it was read from. Paths are relative to the desktop repo.

> **Precedence rule.** Where this audit contradicts the illustrative examples in
> `GLACIER_NOTES_ANDROID_SPECIFICATION.md`, the desktop implementation wins
> (spec §2, §5 preamble). §1 lists those contradictions explicitly.

---

## 1. Specification deltas — read this first

The Android specification's §5 domain model is illustrative and **differs from the desktop
implementation in twelve ways**. Implementing §5 verbatim would produce exports the desktop app
rejects.

| # | Topic | Android spec §5 says | Desktop actually implements | Source |
| --- | --- | --- | --- | --- |
| 1 | Note type discriminator | `'markdown' \| 'checklist'` | `'text' \| 'checklist'` | `electron/storage/models.ts` |
| 2 | Notebook reference | `notebookId: string \| null` | `notebookId: string` — never null; every note belongs to a notebook | `electron/storage/models.ts` |
| 3 | Note→label field | `labelIds: string[]` | `labels: string[]` | `electron/storage/models.ts` |
| 4 | Checklist storage | separate entity with `noteId`, `position`, `createdAt`, `updatedAt` | **embedded** in the note as `checklist?: ChecklistItem[]`; item is `{id, text, checked, sortOrder}` only | `electron/storage/models.ts` |
| 5 | Trash marker | `trashedAt: string \| null` | `deletedAt?: string` — property **absent** when the note is active, not null | `electron/storage/models.ts` |
| 6 | Label entity | has `createdAt`/`updatedAt` | `{id, name}` only | `electron/storage/models.ts` |
| 7 | Notebook entity | `{id, name, createdAt, updatedAt}` | additionally `color?: string` and `sortOrder: number` (required) | `electron/storage/models.ts` |
| 8 | Image asset | `noteId`, `localPath`, `sizeBytes`, `createdAt` | `{id, mimeType, fileName?}` — no note back-reference, no size, no timestamp | `electron/storage/models.ts` |
| 9 | Import strategies | two (*Add as copies*, *Replace existing by ID*) | **three**: `'copy' \| 'replace' \| 'preserve'` | `electron/export-import.ts:142` |
| 10 | Export scope | "version 1 exports the complete local collection" | three scopes: `{kind:'all'}`, `{kind:'notebook'}`, `{kind:'note'}` | `electron/transfer-core.ts` |
| 11 | Image MIME types | JPEG, PNG, WebP | also **GIF**; hard cap 10 MB per image | `electron/transfer-core.ts` |
| 12 | Trash auto-purge | "should not be purged automatically unless desktop requires it" | desktop **does** auto-purge, default 30 days, on every startup | `electron/storage/models.ts:107`, `electron/main.ts:266` |

Two further corrections to spec prose:

- **Trashed notes are exported.** `allNotes()` unions active, archived and trashed notes before
  building the envelope (`electron/export-import.ts:221-227`). Android spec §15.2 left this
  conditional; it is now settled — trashed notes are in scope.
- **Export filename** is `glacier-export-YYYY-MM-DD.glacier.json`
  (`electron/export-import.ts:64`), not the `glacier-notes-<date>.glacier.json` suggested in
  spec §15.3.

---

## 2. Design tokens

Source: `src/styles/_tokens.scss`. Themes are **CSS classes on `<body>`**, not media queries —
`document.body.classList.toggle('theme-dark', dark)` / `toggle('theme-light', !dark)`
(`src/app/app.ts:59-60`). Dark is the default (`defaultSettings()` returns `theme: 'dark'`).

| Token | Dark | Light |
| --- | --- | --- |
| `--color-bg` | `#0d1b2a` | `#f4f7fa` |
| `--color-surface` | `#1b263b` | `#ffffff` |
| `--color-surface-elevated` | `#243447` | `#ffffff` |
| `--color-accent` | `#4cc9f0` | `#0d8ecf` |
| `--color-accent-muted` | `#63b3ed` | `#3aa8dd` |
| `--color-text` | `#e0e6ed` | `#1b263b` |
| `--color-text-muted` | `#8899aa` | `#5a6b7d` |
| `--color-border` | `#2c3e54` | `#d5dee8` |
| `--color-shadow` | `rgba(0,0,0,0.4)` | `rgba(13,27,42,0.12)` |
| `--color-danger` | `#c0392b` | `#c0392b` |
| `--color-danger-hover` | `#d64534` | `#d64534` |
| `--color-danger-text` | `#e74c3c` | `#c0392b` |

### Note colors

Stable identifiers are the eight palette **names**, defined once in
`src/app/features/notes/note-colors.ts`:

```
red  orange  yellow  green  teal  blue  purple  pink
```

`Note.color` stores the bare name (e.g. `"teal"`); `noteColorVar()` maps it to `var(--note-<name>)`
and returns `null` for unknown values, so stale/unknown colors degrade to "no color" rather than
throwing. Android must persist the same bare names.

| Name | Dark | Light |
| --- | --- | --- |
| red | `#4d2a32` | `#f7d9d7` |
| orange | `#4f3a26` | `#fbe7cf` |
| yellow | `#4a4426` | `#faf3c8` |
| green | `#28422f` | `#d9ecd9` |
| teal | `#1e4247` | `#d2ecef` |
| blue | `#243c5c` | `#d6e4f7` |
| purple | `#3a2e52` | `#e5dcf5` |
| pink | `#4c2a41` | `#f6dcec` |

Dark values are deep desaturated tints designed as card backgrounds under light text; light values
are pale tints under dark text. They are **not** the same hue at different lightness — both sets
must be carried over verbatim.

### Typography, shape, elevation

Source: `src/styles.scss`.

- Font stack: `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`.
  No web font is downloaded — Android should resolve this to Roboto and stay offline.
- Base size `14px`; `.markdown-body` line-height `1.5`; headings `margin: 0.7em 0 0.35em`.
- Theme transition: `background-color 0.2s ease, color 0.2s ease`.
- Corner radii in use (frequency across `src/app/**/*.scss`): **8px ×20**, **6px ×16**, 10px ×5,
  50% ×4 (circular buttons), 999px ×1 (pill), 4px ×1. Treat 8px as the default card radius and
  6px as the default control/image radius.
- Dialog surface: `1px solid var(--color-border)`, radius `12px`, shadow `0 12px 40px var(--color-shadow)`,
  backdrop `rgba(4,10,18,0.55)`.
- Markdown images: `max-width:100%`, radius `6px`.

---

## 3. Branding, icons and licensing

- **Application icons:** `build/icon.png`, `build/icon.ico`, `build/icon.icns`, and rasters
  `build/icons/{16,32,48,64,128,256,512,1024}x*.png`. The 1024px PNG is the best source for
  Android launcher generation. Tray variants: `build/tray.png`, `build/tray@2x.png`.
- **No SVG logo exists in the repo** — only rasters. Android adaptive-icon foreground/background
  layers must therefore be derived from `build/icons/1024x1024.png`, or a vector recreated. Flagged
  as an open question (§9).
- **Icon library:** `@fortawesome/fontawesome-free@^7.3.1`, loaded as a global stylesheet via
  `angular.json:34` → `node_modules/@fortawesome/fontawesome-free/css/all.min.css`. It is bundled
  locally, never CDN-loaded.
- **Licensing obligations** (Font Awesome Free 7): icons CC BY 4.0, fonts SIL OFL 1.1, code MIT.
  CC BY 4.0 requires attribution — the Android build must carry an attribution notice if these
  icons ship. The desktop repo itself is MIT (`LICENSE`).

---

## 4. Domain contract

Source: `electron/storage/models.ts`.

```ts
SCHEMA_VERSION = 1
ENTITY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

Note the pattern accepts UUID **versions 1–5** with RFC-4122 variant bits. `newId()` is
`crypto.randomUUID()` (v4); `nowIso()` is `new Date().toISOString()` — UTC, millisecond precision.
Android must emit the same ISO-8601 shape.

```ts
interface Notebook { id; name; color?; createdAt; updatedAt; sortOrder: number }
interface Label    { id; name }
interface ChecklistItem { id; text; checked: boolean; sortOrder: number }
interface Note {
  id; notebookId; type: 'text' | 'checklist';
  title; content;
  checklist?: ChecklistItem[];   // present only when type === 'checklist'
  imageIds: string[];
  pinned: boolean; archived: boolean;
  color?: string;                // bare palette name
  labels: string[];
  deletedAt?: string;            // absent when active
  createdAt; updatedAt;
}
interface ImageAsset { id; mimeType; fileName? }
```

### Settings

`defaultSettings(osLocale)` — `electron/storage/models.ts:100-110`:

| Key | Default | Android relevance |
| --- | --- | --- |
| `theme` | `'dark'` | port directly |
| `language` | `de` if OS locale starts with `de`, else `en` | port directly |
| `moveCheckedToBottom` | `false` | ported in M09 — see `docs/checklists.md` |
| `closeToTray` | `true` | desktop-only, drop |
| `quickNoteShortcut` | `'CommandOrControl+Alt+G'` | desktop-only, drop |
| `trashAutoPurgeDays` | `30` | port (see §6) |
| `lastSelectedNotebookId` | `null` | port |

Settings are **not** part of the export envelope.

---

## 5. `.glacier.json` exchange contract

Source: `electron/transfer-core.ts`.

```ts
interface ExportEnvelope {
  format: 'glacier-notes-export';   // exact literal, validated
  schemaVersion: number;            // currently 1
  exportedAt: string;               // ISO date
  notebooks: Notebook[];
  notes: Note[];
  labels: Label[];
  images: ExportedImage[];          // { id, mimeType, fileName?, base64 }
  scope?: ExportScope;              // omitted by pre-M8 exports
  defaultNotebookId?: string | null;// present only for scope.kind === 'all'
}
```

Serialized with `JSON.stringify(envelope, null, 2)` — pretty-printed, 2-space indent
(`electron/export-import.ts:90`). File dialog filter accepts extensions `glacier.json` and `json`.

### Validation rules (`validateEnvelope`)

Android's importer must reproduce all of these:

1. Root must be a non-array object; `format` must equal `'glacier-notes-export'`.
2. `exportedAt` must parse as a date.
3. `schemaVersion` must be an integer ≥ 1; **`> SCHEMA_VERSION` is rejected** with an
   actionable message ("Unsupported schemaVersion N…"). Older versions are accepted.
4. `notebooks`, `notes`, `labels`, `images` must all be arrays. Structural errors short-circuit
   before per-entity validation.
5. Per notebook: valid UUID `id`, non-empty `name`, parseable `createdAt`/`updatedAt`, integer
   `sortOrder`. `color` copied only if a string.
6. Per note: valid UUID `id` and `notebookId`; `type` ∈ {`text`,`checklist`}; when `checklist`,
   the `checklist` array is required and each item needs UUID `id`, string `text`, boolean
   `checked`, integer `sortOrder`, with duplicate item ids reported; `title`/`content` strings;
   `imageIds` and `labels` must be arrays of valid UUIDs; `pinned`/`archived` booleans;
   timestamps parseable; `deletedAt` if present must parse.
7. Per label: valid UUID `id`, non-empty `name`.
8. Per image: valid UUID `id`; `mimeType` ∈ {`image/png`, `image/jpeg`, `image/webp`, `image/gif`};
   `base64` non-empty, length %4 === 0, matches `/^[A-Za-z0-9+/]*={0,2}$/`, and decodes to
   ≤ `10 * 1024 * 1024` bytes.
9. Duplicate ids within each collection are errors.
10. **Referential integrity:** every `note.notebookId` must exist in `notebooks`; every entry of
    `note.labels` must exist in `labels`; every id from `referencedImageIds(note)` must exist in
    `images`.
11. `scope` if present must be well-formed and must reference an entity contained in the envelope.
12. `defaultNotebookId` if present (and non-null) must be a valid UUID present in `notebooks`.

Errors accumulate into a `string[]`; the UI shows the list.

### Image references

```ts
IMAGE_REF_PATTERN = /glacier-img:\/\/([0-9a-f-]{36})/g
referencedImageIds(note) = union(note.imageIds, matches in note.content)
```

So an image counts as referenced if it is listed in `imageIds` **or** merely mentioned in Markdown
body text. Renderer side: `src/app/shared/glacier-img.pipe.ts` produces
`glacier-img://<id>` via `bypassSecurityTrustUrl` because Angular's sanitizer rejects the custom
scheme; the Electron protocol handler re-validates the id.

---

## 6. Product behaviour

### Notebooks — `electron/storage/notebook-repo.ts`

- On first run a default notebook named **`"Notes"`** is created and its id stored as
  `defaultNotebookId` inside `notebooks.json`.
- If the persisted `defaultNotebookId` no longer resolves, it falls back to `notebooks[0].id`.
- **The default notebook cannot be deleted** — `delete()` throws `'The default notebook cannot be deleted'`.
- `list()` sorts by `sortOrder` ascending. `create()` assigns `max(sortOrder) + 1`.
- `insert()` is the import-path upsert and deliberately never touches `defaultNotebookId`.

**Notebook deletion is destructive but never silent.** The IPC handler purges every note in the
notebook: `repos.notebooks.delete(id); gcImages(repos, repos.notes.purgeByNotebook(id))`
(`electron/ipc.ts:66-68`). The UI gates this behind a required choice — the delete dialog
(`src/app/features/notebooks/notebook-delete-dialog.html`) shows the contained-note count and forces
the user to pick **"delete the notes"** or **"move them to <notebook>"**, emitting
`{mode:'delete'}` or `{mode:'move', targetId}`. Android must reproduce the *choice*, not just the
purge. This reconciles with Android spec §11's "must not silently destroy note content".

### Labels — `electron/storage/label-repo.ts`

- `list()` sorts by `name.localeCompare(name)` — locale-aware, important for German umlauts.
- **Duplicate names are allowed.** `create()` performs no name-uniqueness check; identity is the id.
- `delete()` removes the label and calls `noteRepo.stripLabel(id)`, which filters the id out of
  every note's `labels` array. Notes are never deleted.

### Notes — `electron/storage/note-repo.ts`

- Stored one file per note at `notes/<uuid>.json`, each with a `schemaVersion` field that is
  stripped on read.
- `list()` default ordering is `b.updatedAt.localeCompare(a.updatedAt)` — most recently updated
  first. **Pinned grouping is not done in the repository**; it is a presentation concern.
- Filter semantics: a trashed note is excluded from both active and archived lists; `trashed: true`
  ignores the `archived` filter entirely.
- `trash()` sets `deletedAt = nowIso()`. `restore()` **deletes the property** and bumps `updatedAt`.
- `purge()` removes the file and returns the note's `imageIds` for garbage collection.
- `isImageReferenced()` checks `imageIds` *and* `content.includes(imageId)`.
- `purgeExpired(days)` deletes trashed notes older than the cutoff; `days <= 0` disables it.

### Trash auto-purge

Runs once at startup, before the UI is available:
`gcImages({notes, images}, notes.purgeExpired(settings.get().trashAutoPurgeDays))`
(`electron/main.ts:266`), default 30 days. Android should port this with the same default and the
same "0 disables" escape hatch.

### Image garbage collection

`gcImages()` (`electron/ipc.ts:38-44`) deletes an image file only when it still exists *and*
`isImageReferenced()` returns false. It is invoked after notebook deletion, note purge, and import.

---

## 7. Import strategies

`applyImportEnvelope()` — `electron/export-import.ts:164-219`. Flow is
inspect → (preview with counts + `hasConflicts`) → apply.

| Strategy | ID handling | Distinguishing behaviour |
| --- | --- | --- |
| `copy` | `remapAsCopies()` mints fresh ids for notebooks, labels, images, notes **and checklist items** | Never overwrites. Rewrites `glacier-img://` refs inside `content` via `content.split(oldId).join(freshId)`. Unresolvable refs are left as-is. |
| `replace` | keeps imported ids, upserts | Before writing, collects `referencedImageIds()` of every *existing* note that is about to be overwritten into `priorImageIds`, then GCs them afterwards so orphaned images from replaced notes are cleaned up. |
| `preserve` | keeps imported ids, upserts | Adds the **exact-restore** path (below). Otherwise identical to `replace` minus the prior-image GC. |

**Exact restore** triggers only when *all* hold: strategy is `preserve`; the local store is
`pristine` (exactly 1 notebook, 0 notes, 0 labels, 0 images); `envelope.scope.kind === 'all'`; and
`defaultNotebookId` is a string. It then calls `notebooks.replaceAll(...)`, which discards the
auto-created "Notes" notebook and restores the backup's own default notebook. This is the
"restore a backup onto a fresh install" path.

None of the three strategies deletes unrelated local data.

### Transactional safety

`electron/import-transaction.ts` implements filesystem-level rollback:

- `beginImportTransaction()` first runs recovery (in case a previous run died), then copies the
  managed set — `notebooks.json`, `labels.json`, `images.json`, `notes/`, `images/` — into
  `.glacier-import-backup/` plus a `manifest.json` recording which existed, and writes a
  `.glacier-import-transaction.json` marker.
- On success: `commitImportTransaction()` removes marker and backup.
- On failure: `writer.discard()`, `recoverImportTransaction()` restores from backup (removing files
  that did not previously exist), then all four repos are re-`init()`ed and the error rethrown.
- The marker is also checked at startup, so a crash mid-import self-heals.

Android's SQLite equivalent must pair a DB transaction with staged image files to get the same
guarantee (milestone M13).

---

## 8. Localization

- `src/app/core/i18n/en.ts` (197 lines) and `de.ts` (202 lines) are plain exported TS objects —
  directly portable, no extraction tooling needed.
- `src/app/core/i18n/i18n.service.ts` provides `t(key, params)` with `{name}`/`{count}`
  interpolation, used as `i18n.t('notebook.containsMany', { count: n })`.
- Language initialization derives from OS locale (`app.getLocale()` → `defaultSettings`).
- Desktop-only key groups to drop on Android: tray, global shortcut / quick note, window
  behaviour, keyboard-shortcut help.

---

## 9. Android dependency baseline

The Android project already matches desktop closely, which keeps portable logic copy-compatible:

| Component | Desktop | Android (current) | Action |
| --- | --- | --- | --- |
| Angular | ^22.0.0 | 22.0.1 | aligned |
| TypeScript | ~6.0.2 | ~6.0.0 | aligned |
| Vitest | ^4.0.8 | ^4.0.8 | aligned |
| Biome | 2.5.4 (formatter only, linter off) | — | add in M01, reuse config verbatim |
| Markdown | `marked` ^18.0.6 + `dompurify` ^3.4.12 | — | add in M06 |
| Icons | Font Awesome Free ^7.3.1 | `ionicons` 8 | decide in M02 (§10) |
| Shell | Electron 43 | Ionic 9 + Capacitor 8 | platform difference, expected |

Android SDK baseline (from `android/variables.gradle` in this repo): `minSdkVersion 24`,
`compileSdkVersion 36`, `targetSdkVersion 36`. Spec §4.1 asked for Android 10 (API 29) as the
floor; Capacitor 8's own floor is API 24. **Recommendation: keep minSdk 24** — nothing in the
planned feature set requires 29, and the photo picker degrades gracefully. Revisit if the chosen
SQLite plugin demands higher.

SQLite plugin selection is deferred to M04; `@capacitor-community/sqlite` remains the presumed
choice pending a compatibility check against Capacitor 8.

---

## 10. Fixture inventory

Desktop can generate real `.glacier.json` fixtures via its export dialog, covering milestones
doc §24. Status against the desktop contract:

| # | Fixture | Producible on desktop | Note |
| --- | --- | --- | --- |
| 1 | Empty collection | yes | scope `all` with only the default notebook |
| 2 | Single text note | yes | |
| 3 | Unicode / German umlauts | yes | also exercises `localeCompare` label ordering |
| 4 | Multiple notebooks | yes | |
| 5 | Multiple labels on one note | yes | |
| 6 | Pinned note | yes | |
| 7 | Archived note | yes | |
| 8 | Trashed note | yes | confirmed in scope — `allNotes()` includes trashed |
| 9 | All 8 note colors | yes | |
| 10 | Ordered checklist, mixed checked | yes | verify `sortOrder` round-trip |
| 11 | Note with one image | yes | |
| 12 | Note with multiple images | yes | |
| 13 | `glacier-img://` refs in body | yes | must survive `copy` remapping |
| 14 | Conflicting ids | hand-edit | duplicate an export and re-import |
| 15 | Unsupported schemaVersion | hand-edit | set `schemaVersion: 999` |
| 16 | Malformed JSON | hand-edit | |
| 17 | Missing relationship | hand-edit | delete a referenced label |
| 18 | Truncated base64 | hand-edit | |
| 19 | Malicious filename | hand-edit | `fileName: "../../evil.png"` |
| 20 | Large collection | script | for M11 performance work |

Fixtures 14–19 must be produced by hand-editing a valid export, since the desktop exporter cannot
emit invalid documents. None may contain real personal data.

---

## 11. Open questions

Recorded rather than decided — these need a product call before the milestones that depend on them.

1. ~~**`preserve` strategy.**~~ **Decided at M13: ported, but never offered as a choice.** All
   three strategies exist in `ImportService`; the page mirrors the desktop's own dialog
   (`transfer-dialog.ts:116-137`), which applies `preserve` automatically when the file has no id
   conflicts and offers *Add as copies* / *Replace existing* only when it does. That is what makes
   restoring a backup onto a fresh phone work without asking a question the user has no basis to
   answer, and it keeps the milestones' two named strategies as the only two the user ever sees.
   See `docs/import-export.md`.
2. ~~**Scoped export.**~~ **Decided at M14: the scopes ship in the contract and stay unwired.**
   `collectExport` accepts all three because narrowing the port would mean maintaining code that
   differs from the authoritative source, but the UI exports only the whole collection. The share
   sheet did not turn out to want an envelope: sharing one note means handing a receiving app
   readable text, so `noteShareText` sends Markdown and a `.glacier.json` stays a backup.
   See `docs/import-export.md`.
3. ~~**GIF support.**~~ **Decided at M10: GIF is accepted everywhere, not import-only.** Rejecting
   it on the attach path while accepting it on import would leave the two paths disagreeing about
   what a valid image is, for no gain — the WebView renders GIF and nothing here recompresses.
   The picker's `accept`, `IMAGE_MIME_TYPES` and M13's import now share one list.
4. **Icon library.** Desktop uses Font Awesome Free 7 (CSS-class based, with CC BY 4.0 attribution
   duty); the Android starter ships Ionicons 8, which is idiomatic for Ionic and already bundled.
   Mixing the two is explicitly discouraged by spec §7.4. *Decision needed before M02.*
5. **Launcher icon source.** No SVG logo exists — only PNG/ICO/ICNS rasters. Adaptive icon layers
   must be cut from `build/icons/1024x1024.png` or a vector recreated. *Decision needed before M02.*
6. **minSdk 24 vs 29.** Spec §4.1 suggests Android 10; Capacitor 8 supports 24. Recommendation is
   to keep 24. *Confirm before M16.*
7. **Trash auto-purge UI.** Desktop exposes `trashAutoPurgeDays` in settings and purges at startup.
   Android spec §18's settings list omits it. Recommend porting it for parity.
