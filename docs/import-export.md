# Import and export (M12)

M12 makes the app produce `.glacier.json` files that the **existing Glacier
Notes desktop app imports without modification**. That is the whole goal, and it
is the reason almost every decision below points at "because the desktop does",
including the places where doing so is not what a greenfield design would pick.

M12 ships the *export* half. Import — reading a file the user picked, detecting
conflicts, and applying it — is M13. The Android save dialog and share sheet are
M14; what M12 writes goes into the app's private directory as a harness.

This document records the reasoning a reader cannot recover from the code.

## The port is verbatim, and that is a constraint rather than a shortcut

`src/app/core/import-export/transfer-contract.ts` and `envelope-validation.ts`
are ports of the desktop's `electron/transfer-core.ts`. **Every difference from
that source is a bug, not a local improvement.** If a future change makes the
Android output cleverer than the desktop's, it makes the two apps stop
interoperating and the milestone's only acceptance criterion fails.

"Verbatim" excludes exactly two things:

- **Import-side functions.** `detectConflicts`, `remapAsCopies` and
  `envelopeCounts` live in the same desktop file but do nothing for an exporter.
  They are M13's, along with the applier.
- **Constants the desktop keeps private.** `UUID_PATTERN`, `IMAGE_MIME_TYPES`,
  `MAX_IMAGE_BYTES`, `IMAGE_REF_PATTERN` and `referencedImageIds()` are file-local
  in `transfer-core.ts`. Here they already exist as public model constants in
  `core/models/entity-id.ts` and `core/models/image-asset.ts`, from M04 and M10.
  Re-declaring them would create a second definition of "what counts as an image
  reference" — precisely the hazard `docs/images.md` warns about — so they are
  imported.

`validateEnvelope` is in scope for M12 even though nothing imports yet, because
the exporter needs it as a self-check and the contract specs need a real parser
to assert against.

## The wire format

```jsonc
{ "format": "glacier-notes-export", "schemaVersion": 1, "exportedAt": "<ISO>",
  "notebooks": [], "notes": [], "labels": [], "images": [],
  "scope": { "kind": "all" },   // always written
  "defaultNotebookId": "…" }    // only when scope.kind === 'all'
```

Serialized with `JSON.stringify(envelope, null, 2)`. The file name is
`glacier-export-YYYY-MM-DD.glacier.json`, from `toISOString()`, so it is UTC and
can be a day off from the device's local date near midnight — that is the
desktop's behaviour, the name is cosmetic, and `exportedAt` is the timestamp
that means anything.

`scope` and `defaultNotebookId` are optional in `ExportEnvelope` because exports
predating the desktop's own M8 lack them; `envelope-validation.spec.ts` has a
case asserting such a legacy file still validates.

### Key *order* is not part of the contract

The plan for this milestone called for asserting key-order equality against a
real desktop file. **That assertion is wrong and the fixture disproves it.** The
desktop's `NoteRepo.update` does `{...note, ...patch}`, so an optional key first
set after creation — `color` on a colouring, `deletedAt` on a trash — lands at
the *end* of the object instead of in declaration position. A genuine desktop
export is internally inconsistent about it.

What the two apps must agree on is the key **set**. `desktop-fixture.spec.ts`
asserts that, pins the desktop's append behaviour in its own test so nobody
writes a byte-comparison against it by mistake, and applies the stricter
declaration-order check only to this app's own output — where `collectExport`
spreads the model objects verbatim, so the order is deterministic. That
determinism is worth keeping. It is not worth asserting across the two apps.

## All three scopes ship; one is wired

`ExportScope` is `all | notebook | note`, ported whole, though `ExportService`
only ever calls `{kind:'all'}`. Narrowing the port would mean maintaining code
that differs from the authoritative source, and the scope filtering is nine
lines. `docs/desktop-audit.md` §11 left Android's adoption of scoped exports
open; the answer is that the contract supports them and no UI reaches them until
M14 can offer a share sheet. `transfer-contract.spec.ts` covers all three.

## The export note set is not `list({kind:'all'})`

This is the single easiest thing to get wrong. Android's `NoteScope`
`{kind:'all'}` means `deleted_at IS NULL` — active plus archived, **not** the
trash. The desktop's `allNotes()` (`electron/export-import.ts:221`) unions
active, archived and trashed, so a `{kind:'all'}` query alone silently drops
every trashed note from the backup.

`readCollectionSnapshot` therefore concatenates two existing scopes:

```ts
notes: [
  ...(await queryNotes(adapter, { kind: 'all' })),
  ...(await queryNotes(adapter, { kind: 'trashed' })),
]
```

### Why the union beat a seventh `NoteScope`

A new scope would need an `ORDER BY` that is a **total** order, because the
four-statement `page` CTE in `note-queries.ts` depends on one
(`docs/repositories.md`). It would then leak into every exhaustive switch over
`NoteScope` — including `compareNotes` in `note-sort.ts` and the SQL-vs-comparator
cross-check spec — each of which would have to invent a *display* order for
something that is never displayed. `NoteScope`'s own doc comment says it
describes "which notes a **view** covers", and an export is not a view.

Concatenating two pages that already have proven total orders reproduces the
desktop's active-then-archived-then-trashed sequence with no new SQL at all.

## `CollectionRepository.snapshot()` and the one-turn rule

Reading notebooks, notes, labels and the default notebook id through four
repository calls takes four turns of the repository queue. A write landing
between any two of them yields a **torn export**: a note whose notebook was read
too early to include it. So `readCollectionSnapshot` composes the query
primitives — `selectNotebooks`, `queryNotes`, `selectLabels`,
`readDefaultNotebookId` — inside a single `context.read()`.

This is the same rule `docs/repositories.md` states for bulk *writes*, applied to
a bulk read: **the callback must never re-enter `read()`/`write()`.** Re-entering
stalls the queue until `QUEUE_STALL_TIMEOUT_MS` and then fails as a
`RepositoryDeadlockError`. That is why `readCollectionSnapshot` is a free
function taking a `DatabaseAdapter` rather than a method reaching for
repositories, and why `collection-snapshot.spec.ts` has both a
concurrent-write-does-not-tear case and an explicit no-deadlock case.

Two small extractions this forced: `NotebookRepository.list`'s inline SQL and
`LabelRepository.list`'s query-plus-sort became `selectNotebooks()` and
`selectLabels()`, with the repositories re-pointed at them. Each ordering still
has exactly one encoding.

## `ImageFileStore.read()`

M10 gave the store `init/write/delete/list/url` and no read, because nothing
needed the bytes back — display goes through `Capacitor.convertFileSrc`, which
streams off disk without crossing the bridge. An exporter does need them.

```ts
/** The file's bytes as bare base64, no `data:` prefix. `null` when the file is gone. */
read(id: string): Promise<string | null>;
```

`CapacitorImageFileStore.read` calls `Filesystem.readFile` with **no `encoding`**,
which is what makes the plugin return base64 — the exact mirror of how `write()`
already omits it. Getting this backwards yields a UTF-8 decode of binary rather
than an error. `null` on failure matches the store's existing "already gone is a
state, not an exception" style in `delete()` and `list()`.

Note the opposite choice one directory over: `CapacitorExportFileWriter` must
pass `Encoding.UTF8`, because without it the plugin would treat the JSON as
base64 and reject it.

## Images come from the notes, not the image table

`collectExport` walks `referencedImageIds(note)` over the *exported* notes only.
An image no exported note references is not in the file, even if its row and its
bytes are both on the device. For a `{kind:'note'}` export that also means the
bytes are never read — `transfer-contract.spec.ts` asserts `readImage` is not
even called for an out-of-scope image.

`readImage` is **synchronous**, mirroring the desktop's `fs.readFileSync`. Android
has no synchronous filesystem, so `ExportService` resolves every referenced image
into a `Map` before calling `collectExport`. That prefetch is the only reason the
service has a loop in it.

## A missing image aborts the export here, but not on the desktop

This is the one deliberate deviation from the desktop, and it is worth stating
plainly because it is a divergence in a milestone whose whole point is not
diverging.

The desktop drops an image it cannot read and writes the file anyway. The
resulting envelope has a note referencing an image the file does not carry — and
the desktop's *own* `validateEnvelope` rejects that on import with
`missing image <id>`. So the desktop can produce a backup that neither app can
restore. `envelope-validation.spec.ts` proves the rejection, on a fixture
`collectExport` actually produced, for both a junction reference and a
body-only `glacier-img://` mention.

Android returns `{ status: 'missing-images', imageCount }` and writes nothing. A
backup that cannot be restored is worse than no backup, and M12's acceptance
criterion is that the desktop imports what this app writes.

## Nothing is written until the envelope validates

`ExportService.export()` runs snapshot → prefetch images → `collectExport` →
`validateEnvelope` → serialize, and only then makes a single `write()` call. So
there is no partial file to clean up on any failure and no half-written export
for a user to mistake for a backup. The validation step means a contract
regression fails on the device that exported rather than on the user's desktop.

**No catch block logs its error.** A filesystem message can carry a path and a
database one can carry bound note text; a storage failure surfaces as
`{ status: 'failed' }` and nothing else. This is the same rule as everywhere
else in the app.

## The whole envelope is one string in memory

`JSON.stringify` of the full collection, with every image inlined as base64,
exists as a single JS string before anything reaches disk. Base64 costs a third
on top of the bytes, so a collection with 50 MB of images needs roughly 70 MB of
contiguous string plus whatever the serializer holds.

Streaming was rejected. It would mean writing the envelope incrementally, which
means *not* using `JSON.stringify` on the whole object, which means Android
having its own serializer for a format the desktop produces with one call — a
second encoding of the wire format, and the thing this milestone exists to avoid.
It would also break "nothing is written until it validates", since a streamed
file is partly on disk before the last note is seen.

If a real collection ever exceeds what the WebView can hold, the fix is a
per-image side-car format, which is a **new format decision** and needs the
desktop to agree first — not a local change.

## `Directory.Data` is a harness, not a destination

`CapacitorExportFileWriter` writes to `Directory.Data`
(`context.getFilesDir()`): app-private, no permission, invisible to a file
manager, retrievable only over `adb exec-out run-as`. That is what lets M12 ship
a working Export button without the document picker.

**M14 owns the real destination.** It adds another `ExportFileWriter`
implementation behind the same token; `ExportService` does not change. The seam
exists for the same reason `ImageFileStore` does — a plugin call inside the
service would make it unrunnable under jsdom.

## The desktop fixture

`src/app/core/import-export/fixtures/desktop-all-v1.glacier.json` is the only
artefact in this repository that was not written here, and the only evidence that
the port is a port. It was produced by the **desktop's own** `collectExport` over
its own JSON stores, with the same `readImage` closure `electron/export-import.ts`
passes for `transfer:exportData`, from desktop commit `e217a7a`.

`desktop-fixture.spec.ts` asserts two things against it: this app accepts what
the desktop writes, and this app's own output uses the same fields per entity
kind.

### Regenerating it

The desktop's smoke mode (`GLACIER_SMOKE=1` plus a `filePath` override) needs a
packaged electron-builder build and does not drive an export by itself, so the
fixture is produced by driving the desktop's compiled contract directly. Only the
save dialog is replaced — exactly what the `filePath` override does.

`transfer-core.ts` and the four storage repos import nothing from Electron, so
they compile and run under plain Node:

```bash
cd /tmp
npx --prefix <this repo> tsc <desktop>/electron/transfer-core.ts \
  <desktop>/electron/storage/*.ts \
  --outDir /tmp/glacier-desktop-dist --module commonjs --target es2022 \
  --moduleResolution node --skipLibCheck --esModuleInterop \
  --rootDir <desktop>/electron
```

Run the compile from a directory without a `tsconfig.json`, or tsc raises TS5112.
A residual "Cannot find type definition file for 'node'" is harmless; the JS is
emitted regardless. Then a small CommonJS driver seeds a temporary base dir
through `NotebookRepo`/`NoteRepo`/`LabelRepo`/`ImageStore`, builds the note set
as the desktop's `allNotes()` does
(`[...list({}), ...list({archived:true}), ...list({trashed:true})]`), calls
`collectExport({kind:'all'}, …)` and writes `JSON.stringify(envelope, null, 2)`.

The seeded collection must keep covering the six variants the fixture is for: a
checklist note, a coloured pinned note, an archived note, a trashed note, a
labelled note, and a note embedding a PNG.

### Verifying the other direction

The acceptance criterion runs the same trick backwards: compile
`electron/export-import.ts` and `electron/ipc.ts` the same way, add a stub
`node_modules/electron` exporting inert `ipcMain`/`dialog`/`shell`/`BrowserWindow`
(the import path never reaches them, but the modules holding it `require`
Electron at load time), then replay the bodies of `transfer:importInspect` and
`transfer:importApply` over the file the device produced. Confirmed on M12: the
desktop's own `validateEnvelope` accepts it, `detectConflicts` reports none, and
`applyImportEnvelope` restores all six notes with their checklist state,
colour, pin, label, archive and trash flags, and a byte-identical image file.

## Load-bearing rules

- **Never export `search_text`.** It is a derived internal column and the desktop
  has no such field. `export.service.spec.ts` asserts the substring is absent, as
  are `searchText`, `/data/` and `file://` — no device path may reach a file the
  user shares.
- **`JSON.stringify(envelope, null, 2)` is the serialization.** Two-space
  indentation, asserted in a spec.
- **Nothing is written until the envelope validates.**
- **The export note set includes the trash.** `{kind:'all'}` alone is not it.
- **`referencedImageIds()` still has to move together with
  `ImageAssetRepository.unreferenced()`** — one rule, two encodings, per
  `docs/images.md`. M12 adds a third consumer of that rule in `collectExport`,
  which makes divergence more expensive, not less.
- **The key set is the contract; key order is not.** Do not write a
  byte-comparison against a desktop file.
