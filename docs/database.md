# Database and persistence (M04)

The SQLite layer under `src/app/core/database/`: the v1 schema, why each
foreign key behaves the way it does, the migration contract, the three engine
backends, and the obligations this milestone hands to later ones.

`docs/desktop-audit.md` §1 and §4 hold the domain shapes these tables persist.
Read that first — the specification's illustrative `Note` shape contradicts the
desktop in twelve places, and the desktop wins.

## Why the schema is ours to design

The desktop has no schema. It persists one JSON file per entity through
`electron/storage/*-repo.ts`, so there is no precedent to transcribe for a
single column type, foreign key, or `ON DELETE` clause. Everything here is a
decision, and each one is justified against an observed desktop *behaviour*
rather than an observed desktop schema.

That cuts both ways: it also means the desktop performs its cascades
**explicitly, in application code, in a deliberate order**. A database-level
cascade would take that sequencing away from us — see `notes.notebook_id` below.

## Engine choice

`@capacitor-community/sqlite@8.1.1`. There is no official `@capacitor/sqlite`;
this is the only maintained Capacitor 8 option. Two consequences, both verified
against the plugin's own source and both accepted with eyes open:

- **SQLCipher is always the engine.**
  `android/src/main/java/…/SQLite/Database.java:276` calls
  `SQLiteDatabase.openOrCreateDatabase(_file, password, null, null)` importing
  `net.zetetic.database.sqlcipher.SQLiteDatabase`. We pass an empty passphrase
  and create connections with `'no-encryption'`, so the database is unencrypted
  as the fixed v1 constraints require. The upside is that the bundled SQLite is
  current rather than the Android API 24 system build, which is what makes
  `STRICT` tables (SQLite ≥ 3.37) safe to use.
- **It drags in biometrics.** `android/build.gradle:68` has an unconditional
  `implementation "androidx.biometric:biometric:1.1.0"`, whose AAR manifest
  declares `USE_BIOMETRIC` and `USE_FINGERPRINT`. Those merge into our
  manifest. **M15 must strip them with `tools:node="remove"`** — the app has no
  biometric locking and must not ask for the permission.

### Two banned column names

`Database.java:1084-1086` checks `isLastModified()` and `isSqlDeleted()` and,
when a table has **both** a `last_modified` and a `sql_deleted` column,
rewrites every `DELETE` into `UPDATE … SET sql_deleted = 1` (line 948). A
delete would silently become a soft delete and the row would keep coming back.

No column is ever named `last_modified` or `sql_deleted`. `schema.spec.ts`
walks `sqlite_schema` and `PRAGMA table_info` and asserts neither name appears,
so a future migration cannot reintroduce them by accident.

### No triggers, and one statement per call

`UtilsSQLite.java:47` splits a batched statement string on `";\n"`. That shreds
any trigger body, and — worse — can produce a partially created schema with no
error. So: no triggers, and `CapacitorSqliteAdapter.execute()` issues one
plugin call per statement rather than handing over a blob. Every migration
keeps each statement as a separate array element; `migration-runner.spec.ts`
statically asserts no statement contains an interior `;` or a `--` comment.

## The v1 schema

`STRICT` throughout, so a `TEXT` column cannot quietly hold an integer. Note
that STRICT still permits *lossless* conversion — inserting `42` into a `TEXT`
column stores `'42'` — so `CHECK` constraints do the work that type affinity
cannot. Booleans are `INTEGER` with `CHECK (x IN (0, 1))`; SQLite has no
boolean type. Timestamps are ISO-8601 `TEXT`, matching the desktop's JSON.

Tables: `schema_migrations`, `notebooks`, `app_state`, `labels`, `notes`,
`note_labels`, `checklist_items`, `image_assets`, `note_images`. The
authoritative definitions are `src/app/core/database/migrations/001-initial-schema.ts`
— this document explains them rather than duplicating them.

### Why each `ON DELETE`

| Foreign key | Action | Justified by |
| --- | --- | --- |
| `notes.notebook_id` | **RESTRICT** | `electron/ipc.ts:64-68` deletes the notebook and *then* runs `gcImages(repos, repos.notes.purgeByNotebook(notebookId))`. A database cascade would remove the notes before we could collect their image ids, orphaning image files on disk. Spec §11 forbids that. The repository moves or refuses, explicitly. |
| `note_labels.label_id` | CASCADE | Exactly the desktop's `stripLabel` behaviour: deleting a label removes it from every note. |
| `note_labels.note_id` | CASCADE | The row has no meaning without its note. |
| `checklist_items.note_id` | CASCADE | On the desktop the checklist is a field *inside* the note's JSON — it cannot outlive it. |
| `note_images.note_id` | CASCADE | Same: the junction row is part of the note. |
| `note_images.image_id` | **RESTRICT** | Guards only half of the desktop's `isImageReferenced`, which also matches `content.includes(imageId)`. The junction alone cannot prove an image is unreferenced, so it must never be the thing that authorizes a file deletion. M10 owns the other half. |
| `app_state.default_notebook_id` | SET NULL | Mirrors the desktop falling back to `notebooks[0].id` when the default is gone. |

### Where `defaultNotebookId` lives

In `app_state`, not in Capacitor Preferences, because it round-trips in the
`.glacier.json` export envelope, needs a real foreign key, and must be set
atomically with the notebook's own creation.

`lastSelectedNotebookId` is the opposite case: device-local UI state that is
never exported. It stays in Preferences (M03) — see
`docs/settings-and-localization.md`.

### Indexes

Seven, all listed in `001-initial-schema.ts` and inventoried exactly by
`schema.spec.ts` so an accidental addition or removal fails the suite.

Three deserve a note. `idx_notes_notebook` and `idx_notes_active` are
**partial** — `WHERE deleted_at IS NULL` — because every list view in the app
excludes trash, so trashed rows are dead weight in those indexes. Both carry
`pinned DESC, updated_at DESC`, which is the desktop's sort order, so the index
satisfies the ordering rather than just the filter. `idx_notes_trashed` is the
mirror image (`WHERE deleted_at IS NOT NULL`) for the trash view alone.

### Seeding

`notes.notebook_id` is `NOT NULL`, so the first note cannot exist without a
notebook. The v1 migration therefore seeds one named `Notes` with
`sort_order 0` — matching `electron/storage/notebook-repo.ts:41-52` — and
points `app_state.default_notebook_id` at it. The seed runs **inside the
migration's transaction**, so a fresh database is never observable in an empty,
unusable state.

## The migration contract

```ts
interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
  seed?: (adapter: DatabaseAdapter) => Promise<void>;
}
```

`runMigrations()` in `migrations/migration-runner.ts`:

1. **Validates before issuing any DDL.** Versions must be positive integers and
   strictly increasing. It then refuses — with zero `execute` calls — if the
   database reports a version newer than the code knows (a downgrade, which
   would mean an older APK opening a newer file) or if an applied version has
   no matching definition. `migration-runner.spec.ts` proves the zero-write
   property with a recording decorator around the adapter.
2. **Runs each migration in its own transaction**, covering the statements, the
   seed, the `schema_migrations` row and the `user_version` bump together. A
   failure part-way through leaves the file exactly as it was, and a corrected
   version applies cleanly to that same file afterwards — there is a spec
   against a real temp file for this.
3. **Treats `schema_migrations` as authoritative.** `PRAGMA user_version` is
   mirrored in the same transaction purely as a cheap external probe you can
   read over `adb` without parsing a table.

Migrations are **additive only**. `migration-runner.spec.ts` statically scans
every statement and fails on `DROP TABLE|COLUMN|INDEX`, `TRUNCATE` or
`RENAME TO`. A failed init never deletes or recreates the file — destructive
recovery is explicitly out of scope for this app.

The plugin's own upgrade engine stays dormant: we never call
`addUpgradeStatement`, so there is exactly one migration mechanism.

### Foreign keys and transactions

`PRAGMA foreign_keys` is a **silent no-op inside a transaction**. It is set once
on open by every adapter. A future migration that needs to reorder rows past a
constraint must use `defer_foreign_keys` rather than trying to turn foreign keys
off mid-transaction.

## Three backends behind one interface

`DatabaseAdapter` (8 methods) behind the `DATABASE_ADAPTER` injection token —
the same shape M03 used for `PREFERENCES_ADAPTER`. Which one you get is decided
by `createDatabaseAdapter()` in `src/environments/environment.ts`, swapped for
`environment.prod.ts` by `angular.json`'s `fileReplacements`.

| Backend | Where | Why |
| --- | --- | --- |
| `CapacitorSqliteAdapter` | Device, **and the dev build whenever `Capacitor.isNativePlatform()`** | So a live-reload session against the emulator exercises the production code path. |
| `NodeSqliteAdapter` | Specs, on Node 24's built-in `node:sqlite` | A real engine means foreign keys, `CHECK`s and `ON DELETE` are actually exercised. A hand-rolled fake would only assert our beliefs about SQLite. Zero runtime dependency. |
| `SqlJsAdapter` | Plain browser dev server only | In-memory, resets on every reload. |

Two things about `SqlJsAdapter` are deliberate. It is **in-memory**, because the
plugin's own web path delegates to the `jeep-sqlite` element backed by
IndexedDB — persistent enough to be mistaken for production storage and
different enough to mislead. And it loads the **`sql-asm.js`** build, so there
is no `.wasm` asset to serve and no `loader` entry in `angular.json`; adding one
makes the external-packages plugin resolve `node:sqlite` under
`platform: 'browser'` and breaks the spec build. Its types are a local ambient
declaration (`sql-asm.d.ts`) rather than `@types/sql.js`, which types the
package root and pulls in the `emscripten` globals.

`environment.prod.ts` imports only the Capacitor adapter — **no browser
fallback on purpose**. A release build only ever runs in the Android WebView,
and an in-memory database that silently loses every note on reload is the worst
failure mode we could ship. That import graph is also what keeps sql.js out of
the APK; verify with `grep -ril "sql\.js\|sql-asm" www/` after a production
build.

Because `tsconfig.app.json` uses `"files": ["src/main.ts"]`, `environment.prod.ts`
is not reachable from the app project and would escape `npm run typecheck`
entirely. It is listed explicitly in `tsconfig.spec.json`'s `include` for that
reason. `npm run build` remains a mandatory verification step, not an optional
one.

## Startup

`DatabaseService.init()` runs as the second `provideAppInitializer` in
`src/main.ts`, after `SettingsStore.init()` so the theme and language are
already in place.

It **never rejects**. An app initializer that rejects aborts bootstrap and
leaves a blank screen, which is a strictly worse outcome than a running app
that can explain itself. Instead it records a `status` signal
(`'initializing' | 'ready' | 'error'`) and an `error` message for the UI to
render a fatal-error state. Critically, a failed init never deletes or
recreates the database file.

## Obligations handed to later milestones

- **M05** — `UNIQUE (note_id, sort_order)` on `checklist_items` and
  `note_images` blocks naive in-place reordering. Repositories must
  delete-all-then-reinsert inside a transaction, or defer the constraint.
- **M10** — the other half of `isImageReferenced`: an image is referenced if it
  appears in `note_images` **or** as `glacier-img://<id>` in any note's
  Markdown. The `RESTRICT` above only covers the first.
- **M12** — key-order fidelity in the mappers is asserted against a
  transcription of the desktop, not against the desktop at runtime. Re-verify
  against a real exported `.glacier.json` file.
- **M15** — strip `USE_BIOMETRIC` and `USE_FINGERPRINT` from the merged
  manifest with `tools:node="remove"`.

## What specs cannot cover

Connection consistency across WebView restarts. The plugin's
`checkConnectionsConsistency` → `isConnection` →
`retrieveConnection`/`createConnection` → `isDBOpen` → `open` dance exists
because a WebView reload leaves the native side holding connections the
JavaScript side has forgotten. There is no way to reproduce that in a spec, so
it is covered only by the emulator check: force-stop and relaunch, then
background/foreground with a live-reload session attached.
