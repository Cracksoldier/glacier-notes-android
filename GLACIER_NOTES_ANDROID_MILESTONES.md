# Glacier Notes Android — Coding-Agent Implementation Milestones

- **Document version:** 1.0
- **Date:** 2026-08-25
- **Application:** Glacier Notes Android
- **Specification:** `GLACIER_NOTES_ANDROID_SPECIFICATION.md`
- **Canonical desktop repository:** <https://github.com/Cracksoldier/glacier-notes>
- **Platform:** Android
- **Framework:** Ionic + Angular + Capacitor
- **Distribution:** Privately signed APK for sideloading
- **Version 1 data storage:** Local SQLite database and application-private image files
- **Version 1 security:** Android application sandbox only
- **Version 1 cloud synchronization:** Explicitly excluded

## 1. Purpose and usage

This document decomposes the Glacier Notes Android specification into implementation milestones suitable for an autonomous coding agent or a developer working incrementally.

Each milestone defines:

- A bounded goal.
- Required prerequisites.
- In-scope implementation tasks.
- Explicit exclusions.
- Expected deliverables.
- Verification commands or procedures.
- Acceptance criteria.
- An implementation prompt suitable for a coding agent.

Complete milestones in order. Do not begin a dependent milestone until its prerequisite acceptance criteria have passed.

## 2. Product constraints that apply to every milestone

The following decisions are fixed and must not be reopened without explicit user approval:

1. The application uses Angular, Ionic, and Capacitor.
2. Version 1 runs on Android and is distributed as a privately signed APK.
3. The application provides full desktop-core feature parity.
4. Notes, notebooks, labels, checklists, and image metadata are persisted locally in SQLite.
5. Image bytes are stored in Android application-private files.
6. Version 1 has no application-managed cloud synchronization or required online service.
7. Version 1 has no account registration, application authentication, PIN lock, biometric lock, or additional database encryption.
8. Import/export uses the existing desktop-compatible `.glacier.json` format.
9. Import supports **Add as copies** and **Replace existing by ID**.
10. The desktop implementation is authoritative for visual design, icons, note colors, portable data semantics, and existing product behavior.
11. The application supports English and German.
12. Dark and light themes are required.
13. Tooling should use Biome rather than introducing Prettier.
14. Required fonts, icons, and assets must be packaged locally.
15. The release application must not make automatic network requests.
16. The release application should omit the `INTERNET` permission whenever compatible with the selected implementation.

## 3. Agent execution protocol

### 3.1. Before starting a milestone

The implementing agent must:

1. Read the complete Android specification.
2. Read this milestone document.
3. Inspect the current repository, its instructions, and the existing implementation.
4. Confirm that prerequisite milestones are complete.
5. Identify files that will be modified.
6. Identify relevant tests and existing verification commands.
7. Preserve unrelated user changes.
8. Document unresolved dependencies rather than inventing missing desktop behavior.

### 3.2. During implementation

The agent must:

- Implement only the current milestone's approved scope.
- Prefer existing project conventions over unrelated refactoring.
- Keep changes reviewable and narrowly focused.
- Add or update tests with the implementation.
- Avoid placeholder implementations that report success without performing the required work.
- Avoid hardcoding undocumented desktop colors, schema fields, icon libraries, or import semantics.
- Avoid adding network services, accounts, analytics, telemetry, authentication, or encryption outside scope.
- Avoid broad Android storage permissions where a system picker or application-private storage is sufficient.
- Preserve compatibility with desktop behavior already established in earlier milestones.
- Surface decisions that require access to unavailable desktop implementation details.

### 3.3. After implementation

The agent must:

1. Run the applicable formatter/linter, type checks, tests, and build.
2. Perform milestone-specific Android verification where applicable.
3. Summarize files changed and user-visible behavior.
4. Report skipped checks and explain why they were unavailable.
5. Identify remaining risks, follow-up work, and documented deviations.
6. Confirm that out-of-scope functionality was not introduced.
7. Stop after completing the milestone unless explicitly instructed to continue.

### 3.4. Suggested common verification commands

Use the actual scripts defined by the Android project. Once available, the standard verification set should resemble:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Native milestones additionally use commands resembling:

```bash
npx cap sync android
```

```bash
./gradlew assembleDebug
```

Run Gradle commands from the generated Android project directory. Do not assume a command exists until the corresponding script or wrapper has been created.

### 3.5. Recommended review and merge policy

- Prefer one pull request per milestone.
- Keep milestone branches independent and reviewable.
- Complete acceptance checks before merging.
- Do not combine unrelated later-milestone functionality into an earlier milestone.
- Split a milestone further if its implementation becomes too large for practical review.
- Record known deviations and remediation tasks explicitly.

## 4. Milestone dependency overview

| Milestone | Name | Depends on |
| --- | --- | --- |
| M00 | Desktop reference audit and implementation decisions | None |
| M01 | Ionic Angular and Capacitor project foundation | M00 |
| M02 | Desktop-derived Glacier design system and application shell | M00, M01 |
| M03 | Localization and persisted application settings | M01, M02 |
| M04 | Domain models, SQLite infrastructure, and migrations | M00, M01 |
| M05 | Repository layer and local persistence integration | M04 |
| M06 | Markdown notes, responsive note list, and autosaving editor | M02, M03, M05 |
| M07 | Notebooks, navigation filtering, and default notebook behavior | M05, M06 |
| M08 | Labels, note colors, pinning, archive, and trash | M05, M06, M07 |
| M09 | Checklist notes and ordered checklist items | M05, M06, M08 |
| M10 | Private image storage, image attachments, and Markdown image references | M05, M06, M09 |
| M11 | Local search, sorting, and larger-collection performance | M06, M07, M08, M09, M10 |
| M12 | Canonical desktop exchange contract and validated export | M00, M05, M08, M09, M10 |
| M13 | Desktop-compatible import and both conflict strategies | M12 |
| M14 | Android document pickers, share sheets, and backup UX | M12, M13 |
| M15 | Privacy, resilience, accessibility, and Android hardening | M03, M10, M11, M13, M14 |
| M16 | Signed APK release, upgrade verification, and final acceptance | All previous milestones |

Milestones may only run concurrently when their prerequisites, owned files, and acceptance criteria do not overlap. Sequential implementation is the default.

## 5. M00 — Desktop reference audit and implementation decisions

### Goal

Produce an evidence-backed implementation baseline from the actual Glacier Notes desktop repository before inventing design values, domain contracts, or interchange semantics.

### Prerequisites

- Access to the Glacier Notes desktop repository.
- Access to the Android application specification.

### Tasks

- Inspect desktop global stylesheets and theme configuration.
- Record exact dark and light design tokens.
- Identify background, surface, border, primary, secondary, accent, and text colors.
- Identify stable note-color values and identifiers.
- Identify typography, spacing, corner radii, shadows, and important component styling.
- Identify the desktop logo, icon assets, and icon-library dependency.
- Identify existing English and German translations and terminology.
- Inspect note, notebook, label, checklist, and image models.
- Identify all required fields, nullable values, enums, timestamps, and relationship semantics.
- Locate `.glacier.json` export and import implementations.
- Identify supported schema versions and optional/required fields.
- Identify archive, trash, notebook deletion, sorting, and duplicate-label behavior.
- Verify how **Add as copies** remaps IDs and image references.
- Verify how **Replace existing by ID** treats conflicts and unrelated existing data.
- Select a compatible Angular/Ionic/Capacitor/SQLite-plugin version combination.
- Record the supported Android minimum SDK and target SDK for the selected combination.
- Record licensing requirements for reused icons, fonts, and assets.
- Create a desktop compatibility matrix and representative fixture inventory.

### Out of scope

- Implementing cloud synchronization.
- Guessing exact theme values or serialized fields without repository evidence.
- Building production UI beyond what is necessary to document decisions.

### Deliverables

- Desktop design-token inventory.
- Desktop icon and branding inventory.
- Canonical domain-contract summary.
- `.glacier.json` compatibility matrix.
- Import-strategy behavior notes.
- Android dependency compatibility matrix.
- Initial list of desktop-generated fixture files.
- Documented unresolved desktop-reference questions, if any.

### Verification

- Every extracted color, icon, schema rule, and behavioral claim references a real desktop source file.
- The chosen package versions are mutually compatible.
- Representative desktop fixtures can be produced or are available.

### Acceptance criteria

- No exact design tokens remain speculative.
- The desktop exchange contract is sufficiently understood to guide future fixtures and serializers.
- Both desktop import strategies have documented behavior.
- The expected Android SDK baseline is documented.
- Any blocked repository access is identified before implementation proceeds.

### Coding-agent prompt

> Implement milestone M00 only. Inspect the existing Glacier Notes desktop repository and produce an evidence-backed audit of its themes, icons, domain models, `.glacier.json` schema, import behavior, and compatible Android dependencies. Do not invent undocumented colors or file-format fields. Document unresolved blockers and stop after completing the audit.

## 6. M01 — Ionic Angular and Capacitor project foundation

### Goal

Create a reproducible Ionic Angular project capable of running in a browser for development and launching as a native Android application through Capacitor.

### Prerequisites

- M00 dependency and Android SDK decisions.

### Tasks

- Scaffold an Ionic application using Angular and npm.
- Configure standalone Angular components and routing.
- Add Capacitor and create the Android project.
- Select and document the Android application identifier.
- Enable strict TypeScript and Angular template checking.
- Configure SCSS.
- Configure Biome for linting and formatting.
- Define consistent npm scripts for development, linting, formatting checks, type checking, testing, and production builds.
- Create the feature-oriented directory structure defined by the specification.
- Add baseline unit-test infrastructure.
- Add `.gitignore` rules for build outputs, local SDK configuration, signing keys, and secrets.
- Document local development prerequisites and commands.
- Confirm that required packaged assets do not depend on runtime internet access.
- Synchronize the Android project through Capacitor.
- Verify that an Android debug build can be generated.

### Out of scope

- Production note features.
- SQLite repositories.
- Cloud connectivity or analytics.
- Release-signing credentials.

### Deliverables

- Reproducible Ionic Angular project.
- Capacitor Android project.
- Biome configuration.
- Strict TypeScript and Angular configuration.
- Initial README with setup, development, and Android build commands.
- Working browser development launch and Android debug build.

### Verification

```bash
npm install
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
npx cap sync android
```

Build and launch the debug application on an emulator or connected Android device when the Android SDK is available.

### Acceptance criteria

- The project installs cleanly from documented prerequisites.
- Angular strict checks are enabled.
- Biome performs formatting and lint checks.
- The production web bundle builds successfully.
- Capacitor synchronizes successfully.
- The Android debug application launches.
- No account, cloud service, analytics, or unrelated permission is introduced.

### Coding-agent prompt

> Implement milestone M01 only. Scaffold the Ionic Angular and Capacitor Android application using the compatibility decisions recorded in M00. Configure strict Angular/TypeScript, Biome, npm scripts, baseline tests, and a reproducible Android debug build. Do not implement note features or cloud integrations.

## 7. M02 — Desktop-derived Glacier design system and application shell

### Goal

Establish the Android application's recognizable Glacier visual identity using exact assets and design tokens extracted from the desktop application.

### Prerequisites

- M00 completed design audit.
- M01 working application shell.

### Tasks

- Define semantic Glacier design tokens based on the desktop audit.
- Map desktop colors to Ionic theme variables.
- Calculate required Ionic contrast, shade, tint, and RGB companion values.
- Implement desktop-derived dark and light themes.
- Apply consistent surface, background, typography, border, and card styling.
- Integrate the desktop icon library when practical, or reuse its SVG assets.
- Bundle required fonts and assets locally.
- Implement the top application bar and navigation-drawer shell.
- Add a floating action button placeholder.
- Add responsive screen containers and mobile-safe spacing.
- Respect Android system insets and display cutouts.
- Generate launcher, adaptive launcher, monochrome launcher, and splash-screen assets when source assets permit.
- Document any desktop visual convention that must be adapted for mobile.

### Out of scope

- Inventing alternative Glacier branding.
- Using externally hosted fonts or icons.
- Implementing production note persistence.

### Deliverables

- Desktop-derived design-token files.
- Dark and light Ionic themes.
- Responsive application shell.
- Reused or documented desktop iconography.
- Initial Android branding and splash assets.
- Theme and layout smoke tests.

### Verification

- Compare Android theme values against desktop source artifacts.
- Verify dark and light themes on an emulator.
- Verify portrait and landscape layouts.
- Verify no external font or icon requests occur.
- Run standard lint, type, test, and build checks.

### Acceptance criteria

- Android colors and icons are traceable to actual desktop assets.
- Dark and light themes are functional.
- Navigation shell and application branding render correctly.
- Icon-only controls have initial accessible labels.
- Fonts and icons function offline.

### Coding-agent prompt

> Implement milestone M02 only. Create the Glacier Android design system and application shell using the exact desktop theme values, icon assets, fonts, and branding discovered in M00. Map desktop tokens to Ionic variables and deliver dark/light themes, responsive navigation, and Android launcher/splash assets without introducing network-fetched resources.

## 8. M03 — Localization and persisted application settings

### Goal

Implement English/German localization and durable lightweight application settings without storing note content in preferences.

### Prerequisites

- M01 working application infrastructure.
- M02 theme-enabled application shell.

### Tasks

- Select an Angular-compatible localization approach appropriate for runtime language switching.
- Create English and German translation resources.
- Reuse desktop terminology and translations where practical.
- Detect the device language on first launch.
- Add a user-selectable language preference.
- Add dark, light, and follow-system theme preferences.
- Add initial preference models for note layout, sorting, and default notebook.
- Implement a Capacitor Preferences adapter.
- Define deterministic browser-development behavior for the preferences abstraction.
- Build the initial settings screen.
- Localize existing navigation labels, buttons, empty states, and settings labels.
- Format representative dates according to the selected locale.
- Document which settings are local-only and excluded from portable export.

### Out of scope

- Storing note records or image data in preferences.
- Cloud-backed settings.
- Requiring a restart for ordinary language selection unless the chosen localization mechanism makes it unavoidable.

### Deliverables

- English and German translation resources.
- Preferences service and native adapter.
- Theme and language settings UI.
- Initial persisted layout, sort, and default-notebook settings models.
- Localization and preference tests.

### Verification

- Switch languages and verify visible labels update.
- Switch themes and verify the preference survives application restart.
- Verify device-language initialization.
- Verify that no note content is written to preferences.
- Run standard project checks.

### Acceptance criteria

- English and German interfaces are functional.
- Theme and language choices persist across restarts.
- Desktop terminology is reused where practical.
- Preferences contain only lightweight configuration.

### Coding-agent prompt

> Implement milestone M03 only. Add English/German localization, device-language initialization, runtime language selection, desktop-derived theme selection, and Capacitor Preferences-backed settings. Reuse desktop terminology and keep note data out of preferences.

## 9. M04 — Domain models, SQLite infrastructure, and migrations

### Goal

Create a native SQLite persistence foundation that faithfully represents desktop-compatible Glacier Notes entities and can evolve through safe migrations.

### Prerequisites

- M00 canonical domain-model and compatibility decisions.
- M01 working Capacitor Android project.

### Tasks

- Define desktop-compatible TypeScript domain models.
- Separate domain interfaces from SQLite storage row models.
- Integrate the selected maintained Capacitor SQLite plugin.
- Implement a platform-aware database initialization service.
- Define the initial database schema for notebooks, notes, labels, note-label associations, checklist items, and image metadata.
- Add primary keys, foreign keys, and required indexes.
- Explicitly enable SQLite foreign-key enforcement.
- Implement additive, versioned database migrations.
- Implement startup behavior for a new installation and an existing database.
- Define transaction helpers and deterministic error propagation.
- Define a browser-development/testing strategy without implying browser storage is the production Android persistence mechanism.
- Add representative schema and migration fixtures.
- Ensure database initialization failures never silently replace existing data.

### Out of scope

- SQLCipher or additional database encryption.
- Cloud synchronization tables or account models.
- Broad user-facing feature development.

### Deliverables

- Canonical TypeScript domain models.
- SQLite initialization service.
- Initial schema migration.
- Transaction helper.
- Database adapter abstraction.
- Database initialization and migration tests.

### Verification

- Create a fresh database on Android.
- Reopen the existing database after application restart.
- Verify foreign keys are enforced.
- Exercise an upgrade migration using an older test schema.
- Verify migration failure does not destroy existing data.
- Run standard project checks.

### Acceptance criteria

- All required entity types have a schema representation.
- Database creation and reopening work on Android.
- Foreign-key enforcement and required indexes are present.
- Migrations are additive and tested.
- The application does not recreate an empty database over existing data after failure.

### Coding-agent prompt

> Implement milestone M04 only. Build the desktop-compatible domain model, native SQLite initialization, initial schema, foreign keys, indexes, transaction helpers, and additive migrations. Use application-local unencrypted SQLite and explicitly avoid synchronization tables, cloud dependencies, or destructive recovery.

## 10. M05 — Repository layer and local persistence integration

### Goal

Expose reliable, transaction-aware repositories for all Glacier Notes entities while isolating UI code from native SQLite details.

### Prerequisites

- M04 working database and migrations.

### Tasks

- Implement note repository interfaces and SQLite implementations.
- Implement notebook and label repositories.
- Implement checklist-item persistence interfaces.
- Implement image-metadata persistence interfaces.
- Implement note-label association management.
- Centralize UUID generation and desktop-compatible timestamp handling.
- Implement transactional create, update, delete, and relationship operations.
- Add queries for active, pinned, archived, trashed, notebook-filtered, and label-filtered notes.
- Add deterministic ordering and pagination/list-window capabilities where appropriate.
- Define explicit error types for storage and constraint failures.
- Provide dependency-injection wiring and test doubles.
- Add repository integration tests using realistic desktop-compatible fixtures.
- Document repository contracts needed by future synchronization without implementing synchronization.

### Out of scope

- Cloud transport or sync queues.
- File import/export.
- Native document-picker integration.

### Deliverables

- Repository interfaces and SQLite-backed implementations.
- UUID/timestamp utilities.
- Transaction-backed relationship operations.
- Injectable testing doubles.
- Repository integration coverage.

### Verification

- Create, update, query, and delete representative notes and notebooks.
- Verify note-label and checklist relationships survive restart.
- Verify invalid references fail consistently.
- Verify transactions roll back on intentional failures.
- Run standard project checks.

### Acceptance criteria

- UI features can consume repositories without direct SQL/plugin coupling.
- Entity identifiers and timestamps match desktop expectations.
- Relationship operations are atomic where required.
- Repository data survives application restart.

### Coding-agent prompt

> Implement milestone M05 only. Add clean repository interfaces and SQLite implementations for notes, notebooks, labels, checklist items, note-label associations, and image metadata. Preserve UUID/timestamp compatibility and test transactional behavior without implementing cloud synchronization or import/export.

## 11. M06 — Markdown notes, responsive note list, and autosaving editor

### Goal

Deliver the first complete local note-taking workflow: create, edit, persist, display, and reopen Markdown notes.

### Prerequisites

- M02 themed application shell.
- M03 localization and preferences.
- M05 note repositories.

### Tasks

- Implement the active-notes route and initial empty state.
- Render desktop-styled responsive note cards.
- Support one-column and appropriate two-column layouts.
- Add a floating action button for Markdown-note creation.
- Implement a full-screen note editor.
- Add editable title and Markdown body fields.
- Implement a horizontally scrollable Markdown toolbar.
- Support bold, italic, headings, lists, links, quotes, inline code, and code blocks.
- Implement safe Markdown preview.
- Sanitize rendered HTML and block unsafe protocols.
- Prevent automatic remote image/resource fetching.
- Implement debounced autosave.
- Flush pending changes on navigation and application backgrounding.
- Preserve keyboard usability and Android system insets.
- Define safe discard behavior for completely empty notes.
- Add localizable save-error and empty-state messaging.
- Add relevant unit, component, and repository-integrated tests.

### Out of scope

- Full notebook/label management.
- Checklist-specific editors.
- Image selection.
- Import/export.

### Deliverables

- Responsive active-notes screen.
- Full-screen Markdown editor and formatting toolbar.
- Sanitized Markdown preview.
- Autosave lifecycle integration.
- Persisted Markdown note creation/editing flow.
- Editor and lifecycle tests.

### Verification

- Create a Markdown note, close the app, reopen it, and verify content persists.
- Navigate away while an autosave is pending and verify it flushes.
- Background the app while editing and verify committed data persists.
- Verify unsafe Markdown links or HTML do not execute.
- Verify notes display correctly in dark and light themes.
- Run standard project checks.

### Acceptance criteria

- Users can create, edit, and reopen Markdown notes offline.
- Autosave preserves ordinary editing without requiring a manual save action.
- Note cards are responsive and desktop-brand consistent.
- Rendered Markdown is sanitized and does not automatically load remote content.

### Coding-agent prompt

> Implement milestone M06 only. Build the responsive active-note screen and full-screen desktop-branded Markdown editor with formatting toolbar, sanitized preview, durable SQLite-backed autosave, and Android lifecycle flushing. Keep all behavior local and defer checklist, image, and import/export features.

## 12. M07 — Notebooks, navigation filtering, and default notebook behavior

### Goal

Implement notebook organization while preserving desktop-compatible notebook relationships and deletion semantics.

### Prerequisites

- M05 notebook and note repositories.
- M06 working note editor and note list.

### Tasks

- Display notebooks in the navigation drawer.
- Create notebook-management screens or dialogs.
- Implement notebook creation and renaming.
- Implement notebook-specific note filtering.
- Add notebook selection to the note editor.
- Add move-to-notebook actions where appropriate.
- Implement a persisted default notebook preference.
- Define a desktop-compatible unassigned/default notebook representation.
- Implement confirmation before deleting a notebook.
- Move or preserve associated notes according to audited desktop behavior.
- Add localized validation, empty states, and deletion messaging.
- Add repository and UI tests for notebook relationships.

### Out of scope

- Cloud-shared notebooks.
- Collaborative notebook permissions.
- Import/export.

### Deliverables

- Notebook navigation and filtering.
- Notebook create/rename/delete flows.
- Editor notebook selection.
- Default notebook setting.
- Safe notebook deletion behavior and tests.

### Verification

- Create multiple notebooks and move notes between them.
- Restart the app and verify relationships persist.
- Delete a notebook containing notes and verify notes are preserved according to desktop behavior.
- Verify filtering and empty states.
- Run standard project checks.

### Acceptance criteria

- Users can fully manage notebooks offline.
- Notes retain the correct notebook relationships across restarts.
- Notebook deletion does not silently destroy user notes.
- Default notebook behavior is predictable and desktop-compatible.

### Coding-agent prompt

> Implement milestone M07 only. Add desktop-compatible notebook management, navigation-drawer filtering, editor notebook assignment, default-notebook settings, and safe notebook deletion. Preserve existing notes and avoid introducing cloud sharing or import/export behavior.

## 13. M08 — Labels, note colors, pinning, archive, and trash

### Goal

Complete the core organizational features required for desktop parity.

### Prerequisites

- M05 repository layer.
- M06 note editor and note list.
- M07 notebook navigation.

### Tasks

- Implement label creation, renaming, deletion, and navigation filtering.
- Add multi-label selection to the note editor.
- Match desktop duplicate-label behavior.
- Implement pin/unpin actions and pinned-note grouping.
- Add desktop-derived note-color choices and stable identifiers.
- Implement archive, archive browsing, and restoration.
- Implement trash, trash browsing, restoration, and permanent deletion.
- Add confirmation for destructive actions and empty-trash operations.
- Ensure archived and trashed notes are excluded from normal active-note views.
- Preserve notebook and label filtering semantics across applicable screens.
- Add localized empty states and action descriptions.
- Add persistence and UI tests for every state transition.
- Define cleanup hooks for future image-file deletion without requiring image implementation yet.

### Out of scope

- Automatic trash purging unless the desktop audit establishes it as required.
- Remote labels or cloud archive synchronization.

### Deliverables

- Label management and filtering.
- Multi-label editor integration.
- Desktop-derived note-color selection.
- Pinned-note grouping.
- Archive and trash screens.
- Restorable and permanently deletable notes.
- Organizational state-transition tests.

### Verification

- Assign multiple labels to a note and restart the app.
- Rename and delete labels without deleting associated notes.
- Pin and unpin notes and verify ordering.
- Archive and restore notes.
- Trash, restore, and permanently delete notes.
- Verify no automatic trash purge occurs unless documented by desktop behavior.
- Run standard project checks.

### Acceptance criteria

- Users can organize notes with labels, colors, pinning, archive, and trash.
- Desktop note-color identifiers and values are preserved.
- Destructive operations require confirmation.
- Unrelated notes are never deleted when a label is removed.

### Coding-agent prompt

> Implement milestone M08 only. Add desktop-compatible labels, note colors, pinning, archive, and trash with localized navigation and safe destructive confirmations. Reuse audited desktop color identifiers and preserve notebook/label relationships without adding automatic purge or cloud features.

## 14. M09 — Checklist notes and ordered checklist items

### Goal

Provide first-class checklist notes with persistent ordering and desktop-compatible item semantics.

### Prerequisites

- M05 checklist repositories.
- M06 editor infrastructure.
- M08 organization controls.

### Tasks

- Add checklist-note creation to the floating action button.
- Implement a checklist-specific full-screen editor.
- Add, edit, check, uncheck, and remove checklist items.
- Implement touch-friendly drag/reorder behavior.
- Persist item positions and stable UUIDs.
- Preserve desktop-compatible inline Markdown rendering.
- Render checklist previews on note cards.
- Support labels, notebooks, colors, pinning, archive, and trash on checklist notes.
- Integrate autosave and app-background lifecycle flushing.
- Define completed-item display without silently changing canonical ordering.
- Localize checklist controls and empty states.
- Add unit and integration tests for item ordering and state transitions.

### Out of scope

- Collaborative or synchronized checklists.
- Reminders or notification scheduling.

### Deliverables

- Checklist creation workflow.
- Checklist editor with touch reordering.
- Persistent item IDs, completion state, and ordering.
- Checklist note-card previews.
- Checklist persistence and lifecycle tests.

### Verification

- Create a checklist with multiple entries.
- Reorder entries and restart the app.
- Toggle completion and verify state persists.
- Assign labels and notebooks to checklist notes.
- Archive and restore checklist notes.
- Run standard project checks.

### Acceptance criteria

- Checklist notes provide the expected desktop-core functionality.
- Item ordering and IDs persist across restarts.
- Checklist notes support the same organizational actions as Markdown notes.
- Editor and lifecycle behavior remain consistent with ordinary notes.

### Coding-agent prompt

> Implement milestone M09 only. Add desktop-compatible checklist notes, persistent item UUIDs and ordering, touch reordering, checked state, inline Markdown behavior, note-card previews, and autosave. Keep all existing notebook, label, archive, and trash features working for checklist notes.

## 15. M10 — Private image storage, attachments, and Markdown image references

### Goal

Support desktop-compatible image attachments while keeping image bytes in Android application-private storage.

### Prerequisites

- M05 image-metadata repositories.
- M06 Markdown note editor.
- M09 checklist editor.

### Tasks

- Implement a native filesystem abstraction for application-private image directories.
- Add image selection using Android's system photo picker or document picker.
- Support JPEG, PNG, and WebP where compatible with desktop.
- Copy selected files into application-private storage.
- Generate stable image UUIDs and persist metadata.
- Validate MIME types, file sizes, and application-controlled filenames.
- Add image attachments to both Markdown and checklist notes where supported by desktop.
- Implement responsive image thumbnails on note cards and in editors.
- Implement full-screen image preview.
- Resolve `glacier-img://<imageId>` references to safe local image content.
- Prevent local-image references from escaping managed storage.
- Add safe image-removal behavior.
- Delete image files when no longer referenced.
- Integrate file cleanup with permanent note deletion and empty-trash operations.
- Handle missing and corrupted local images gracefully.
- Add filesystem, metadata, rendering, and cleanup tests.

### Out of scope

- Broad photo-library access permissions.
- Uploading images to remote services.
- Mandatory camera capture.
- Automatic destructive recompression of imported images.

### Deliverables

- Application-private image filesystem service.
- System-picker image attachment workflow.
- Persisted image metadata.
- Thumbnail and full-screen image rendering.
- Safe `glacier-img://` resolution.
- Permanent-deletion and orphan-cleanup tests.

### Verification

- Attach JPEG, PNG, and WebP images where supported.
- Restart the app and verify attachments still display.
- Embed and render a `glacier-img://` image reference.
- Permanently delete a note and verify unreferenced image files are removed.
- Verify missing-image placeholders fail safely.
- Verify broad storage access is not requested.
- Run standard project checks and Android device tests.

### Acceptance criteria

- Images survive application restarts.
- Image bytes reside in application-private storage rather than note-table blobs.
- Canonical Glacier image references render safely.
- Unreferenced image files are cleaned up after permanent deletion.
- The user selects images without granting broad storage permissions.

### Coding-agent prompt

> Implement milestone M10 only. Add Android system-picker image attachments, application-private image files, SQLite metadata, desktop-compatible `glacier-img://` rendering, thumbnails, full-screen previews, and safe orphan cleanup. Avoid broad storage permissions, remote uploads, and mandatory camera features.

## 16. M11 — Local search, sorting, and larger-collection performance

### Goal

Deliver responsive local search and predictable sorting across realistic note collections.

### Prerequisites

- M06 Markdown notes.
- M07 notebook filtering.
- M08 labels and organizational state.
- M09 checklist notes.
- M10 image previews.

### Tasks

- Add searchable top-bar UI.
- Search note titles, Markdown content, and checklist item text.
- Optionally include notebook and label names if consistent with desktop behavior.
- Apply case-insensitive matching where practical.
- Preserve Unicode and German-language behavior.
- Respect current notebook, label, archive, and trash context.
- Define desktop-compatible sort options and persisted preferences.
- Keep pinned notes separated while applying selected sorting within each group.
- Evaluate SQLite full-text search availability on supported Android builds.
- Use a conventional database-backed fallback when full-text search is unavailable.
- Avoid loading all full-resolution images while scrolling.
- Add representative datasets containing thousands of notes.
- Measure editor responsiveness, list scrolling, and interactive search.
- Optimize queries, indexes, rendering, and thumbnails as justified by measurements.

### Out of scope

- Online search.
- AI-powered search, OCR, or semantic indexing.
- Introducing complex full-text dependencies without a measured need.

### Deliverables

- Localized search interface.
- Context-aware database-backed searching.
- Persisted sorting preferences.
- Larger-collection test fixtures.
- Documented baseline performance measurements and optimizations.

### Verification

- Search titles, note content, and checklist text.
- Search German text and representative Unicode content.
- Verify search behavior inside notebooks, labels, archive, and trash.
- Verify pinned ordering under each supported sorting option.
- Test a representative collection with thousands of notes.
- Run standard project checks.

### Acceptance criteria

- Search finds matching Markdown and checklist content.
- Search respects active filtering contexts.
- Sorting and pinned sections remain predictable.
- Larger collections remain responsive on a representative Android device.

### Coding-agent prompt

> Implement milestone M11 only. Add responsive database-backed local search across titles, Markdown, and checklist items; support notebook/label/archive/trash contexts, desktop-compatible sorting, Unicode/German text, and measured larger-collection performance. Do not add online, AI, or OCR features.

## 17. M12 — Canonical desktop exchange contract and validated export

### Goal

Generate `.glacier.json` exports that the existing Glacier Notes desktop application can import without modification.

### Prerequisites

- M00 desktop serializer audit and fixtures.
- M05 repository persistence.
- M08 organization state.
- M09 checklist support.
- M10 image storage.

### Tasks

- Codify the actual desktop exchange schema in a dedicated interoperability module.
- Preserve the desktop schema version and exact field names.
- Represent desktop-compatible notebooks, notes, labels, checklists, and images.
- Preserve note colors, pinning, archive, trash, timestamps, and relationships as defined by desktop.
- Load application-private image bytes and encode them using the canonical desktop representation.
- Ensure device-private paths never appear in exports.
- Define validation for required fields and internal references.
- Implement a complete-collection export service.
- Define a stable export filename strategy.
- Avoid unnecessary duplication of large base64 image payloads.
- Add desktop-generated fixture comparisons.
- Add round-trip contract tests against representative desktop-compatible documents.
- Define user-visible errors for missing images, invalid data, and insufficient storage.
- Keep the exporter independent from Android document-picker UI until M14.

### Out of scope

- Inventing a new JSON schema or alternate extension.
- Cloud backup.
- Android save/share UI beyond internal test harnesses.

### Deliverables

- Canonical exchange-contract module.
- Desktop-compatible export serializer.
- Representative contract fixtures.
- Portable filename helper.
- Export validation and interoperability tests.

### Verification

- Export notes, notebooks, labels, checklist items, colors, pinned state, archive state, and images.
- Validate exported UUID references.
- Verify local Android filesystem paths are absent.
- Import a generated export into the desktop application where available.
- Verify unsupported or missing image data produces a meaningful error.
- Run standard project checks.

### Acceptance criteria

- Exported files use the canonical `.glacier.json` structure.
- Existing desktop installations can import Android exports.
- Supported metadata and relationships remain intact.
- Embedded image content round-trips correctly.
- No Android-local paths or application-only secrets appear in exports.

### Coding-agent prompt

> Implement milestone M12 only. Create the canonical desktop-compatible `.glacier.json` exchange-contract module and complete-collection exporter, including notebooks, notes, labels, checklists, colors, organization state, UUID relationships, and embedded images. Verify against actual desktop fixtures and do not invent a parallel format.

## 18. M13 — Desktop-compatible import and both conflict strategies

### Goal

Safely import desktop `.glacier.json` files using both required conflict-resolution strategies without corrupting existing local data.

### Prerequisites

- M12 canonical exchange contract and export fixtures.

### Tasks

- Implement structured JSON parsing and schema-version validation.
- Validate entity references, required fields, UUIDs, MIME types, and embedded image data.
- Build an import preview summarizing notes, notebooks, labels, checklists, images, and conflicts.
- Implement **Add as copies** with complete entity ID remapping.
- Remap notebook, label, checklist, image, and note relationships.
- Rewrite `glacier-img://` image references during copy imports.
- Implement **Replace existing by ID** using desktop-defined overwrite behavior.
- Insert new entities and update matching existing entities.
- Avoid deleting unrelated local data unless desktop semantics explicitly require it.
- Stage imported image files before finalizing database changes.
- Coordinate database transactions and filesystem staging to avoid partial imports.
- Roll back database mutations and clean staged files after failure.
- Replace existing image files safely during overwrite imports.
- Document practical import-size limits and memory constraints.
- Handle unsupported schemas, malformed JSON, and canceled imports gracefully.
- Add exhaustive fixtures for both conflict strategies.

### Out of scope

- Cloud data reconciliation.
- Automatic syncing or background imports.
- New interchange formats.

### Deliverables

- Validated `.glacier.json` import parser.
- Import-preview service.
- Add-as-copies implementation.
- Replace-existing-by-ID implementation.
- Transactional import orchestration and staged image cleanup.
- Failure, conflict, and round-trip compatibility tests.

### Verification

- Import a representative desktop export into an empty Android installation.
- Import the same file as copies and verify every relevant ID and image reference is remapped.
- Import an updated file by existing ID and verify matching entities are replaced.
- Verify unrelated local notes remain untouched.
- Force a malformed image, relationship failure, or simulated filesystem failure and verify rollback.
- Verify staged files are removed after failure.
- Run standard project checks and native filesystem tests.

### Acceptance criteria

- Existing desktop exports import successfully.
- Both import modes produce the exact expected desktop-compatible behavior.
- Image references remain valid after copy imports.
- Existing unrelated data survives failed and successful imports.
- Partial database changes and orphaned staged images are not left behind after errors.

### Coding-agent prompt

> Implement milestone M13 only. Build validated desktop-compatible `.glacier.json` import with preview, complete Add-as-copies UUID/reference remapping, Replace-existing-by-ID behavior, transactional persistence, staged private image files, rollback, and exhaustive desktop-fixture tests. Preserve unrelated local data and never introduce cloud reconciliation.

## 19. M14 — Android document pickers, share sheets, and backup UX

### Goal

Expose import/export and note sharing through Android-native file and sharing experiences without requesting broad storage access.

### Prerequisites

- M12 validated exporter.
- M13 safe importer.

### Tasks

- Add import/export navigation and settings access.
- Implement Android document-picker import using a maintained plugin or a narrow native bridge.
- Correctly handle Android `content://` document URIs.
- Implement export using Android's system create-document/save workflow.
- Offer native share-sheet export as an alternative to saving.
- Configure application-controlled temporary export files safely.
- Configure Android file-provider/share access where required.
- Implement per-note text sharing for Markdown and checklists.
- Share images only when supported by a safe, explicit native share flow.
- Display import-preview counts and conflict-mode choices.
- Warn before **Replace existing by ID** overwrites matching data.
- Show success, cancellation, validation, and storage-failure states.
- Explain that `.glacier.json` backups are not encrypted.
- Explain that uninstalling the application deletes local application-private data.
- Clean temporary files after completed or abandoned operations where practical.
- Test system-picker behavior on supported Android versions.

### Out of scope

- Direct integrations with email, messaging, Drive, Dropbox, or WebDAV providers.
- Broad `MANAGE_EXTERNAL_STORAGE` or legacy storage permissions.
- Incoming share intents, unless separately approved.

### Deliverables

- Import/export screens and localized flows.
- Android system document-picker integration.
- Native export save and share workflows.
- Individual note-sharing flow.
- Backup privacy and uninstall disclosures.
- Android `content://` URI and cancellation tests.

### Verification

- Select and import a desktop `.glacier.json` file using the Android document picker.
- Save an export to a user-selected destination.
- Share an export through the Android share sheet.
- Share Markdown and checklist note content.
- Cancel each operation and verify graceful handling.
- Verify no broad external-storage permission is requested.
- Verify temporary share files are not exposed longer than necessary.
- Run standard project checks and physical-device tests.

### Acceptance criteria

- Users can import, save, and share backups without broad storage access.
- Both import conflict strategies are selectable and clearly explained.
- The user is warned that exported backups are unencrypted.
- Note sharing uses Android-native affordances.
- Native file operations work with modern scoped-storage document URIs.

### Coding-agent prompt

> Implement milestone M14 only. Connect the validated importer/exporter to Android's document picker and share sheet, handle `content://` URIs safely, expose both import strategies, add per-note sharing, and provide clear unencrypted-backup/uninstall disclosures. Do not add broad storage permissions or direct cloud-provider integrations.

## 20. M15 — Privacy, resilience, accessibility, and Android hardening

### Goal

Harden the complete application for offline, private, reliable Android usage before producing a release candidate.

### Prerequisites

- M03 localization and settings.
- M10 images.
- M11 search and performance.
- M13 import recovery.
- M14 native file/sharing flows.

### Tasks

- Review the merged release Android manifest.
- Remove unnecessary permissions, including `INTERNET` where feasible.
- Confirm development-only network permissions do not leak into release builds.
- Disable Android automatic cloud backup by default unless explicitly approved otherwise.
- Review Android data-extraction and backup rules for supported versions.
- Verify all fonts, assets, icons, and Markdown renderers operate offline.
- Audit logging to ensure note content, titles, imported documents, and image payloads are not exposed unnecessarily.
- Recheck Markdown sanitization and blocked URL schemes.
- Recheck imported filename, path traversal, MIME type, and image validation.
- Test insufficient-storage and failed-migration behavior.
- Verify missing image handling and orphan cleanup.
- Exercise cancellation and process death during import/export and editing.
- Verify autosave behavior during rotation, backgrounding, and process recreation.
- Audit accessibility labels, TalkBack order, contrast, and larger system font sizes.
- Complete missing English/German translations.
- Validate dark/light themes and desktop note colors across all screens.
- Test realistic larger collections on a physical Android device.
- Document any accepted residual risks.

### Out of scope

- Adding biometric/PIN security as a workaround.
- Enabling cloud backup or cloud sync without explicit approval.
- Introducing analytics or crash reporting that transmits user data.

### Deliverables

- Manifest and permissions review.
- Backup/data-extraction configuration.
- Logging and Markdown security audit.
- Accessibility and localization audit results.
- Failure-recovery and performance test evidence.
- Documented release-blocking defects and residual risks.

### Verification

- Enable airplane mode and exercise every major workflow.
- Inspect the merged release manifest.
- Confirm backup policy matches the local-only product decision.
- Run TalkBack and increased-font-size checks.
- Test unsupported imports, malformed images, and insufficient storage.
- Validate search/list behavior with a representative large collection.
- Run standard project checks and native Android test procedures.

### Acceptance criteria

- All major workflows function offline.
- Release permissions are minimal and justified.
- Backup configuration does not silently upload user data.
- Sensitive note contents do not appear in ordinary production logs.
- Accessibility and translations meet the specification.
- Import and migration failures do not destroy existing user data.

### Coding-agent prompt

> Implement milestone M15 only. Harden the finished offline Android application by reviewing release permissions, disabling unapproved Android cloud backup, auditing logs and Markdown/import security, validating accessibility/localization, and testing insufficient storage, lifecycle interruptions, larger datasets, and failure recovery. Do not introduce locks, encryption, analytics, or cloud services.

## 21. M16 — Signed APK release, upgrade verification, and final acceptance

### Goal

Produce a privately distributable signed Android APK and verify that the complete application meets every version 1 acceptance criterion.

### Prerequisites

- M00 through M15 completed.
- A user-controlled Android signing keystore or a documented secure process for creating one.

### Tasks

- Confirm release application ID, display name, version name, and monotonically increasing `versionCode`.
- Configure release signing without committing keystores, passwords, or private signing material.
- Document secure keystore storage and backup responsibilities.
- Generate the release APK.
- Validate the signing certificate and installation behavior.
- Install the signed APK on a supported physical Android device.
- Verify fresh-install database initialization.
- Perform an upgrade installation over a previous signed build using the same signing identity.
- Verify existing notes, checklists, notebooks, labels, and images survive upgrade.
- Run desktop-to-Android and Android-to-desktop interoperability checks.
- Verify both import strategies on a real device.
- Verify dark/light desktop-derived theming and English/German translations.
- Repeat offline airplane-mode validation.
- Verify local-only privacy disclosures and Android backup configuration.
- Create release notes describing supported capabilities, limitations, and manual backup responsibilities.
- Record reproducible release-build instructions.
- Produce the final signed APK without committing confidential signing material.

### Out of scope

- Google Play publishing.
- Android App Bundle publication.
- Cloud synchronization.
- Any expansion of the approved v1 security model.

### Deliverables

- Signed Android release APK.
- Release build instructions.
- Version and signing documentation without secrets.
- Physical-device test evidence.
- Desktop import/export interoperability evidence.
- Release notes and documented known limitations.

### Verification

- Build a release APK using the documented signing procedure.
- Install the APK through Android sideloading.
- Upgrade an existing signed installation without losing data.
- Import a desktop-generated `.glacier.json` file.
- Export Android data and import it into desktop.
- Test both import strategies.
- Run all standard project checks and applicable Android tests.
- Confirm no signing material is committed to version control.

### Acceptance criteria

- A signed APK installs successfully on supported Android devices.
- The same signing identity supports upgrades without application-data loss.
- All required core desktop note features are functional.
- Desktop-compatible import/export works in both directions.
- All application behavior remains usable offline.
- Version 1 includes no account, cloud service, PIN, biometrics, or additional database encryption.
- The release build contains no committed signing secrets and no unjustified permissions.

### Coding-agent prompt

> Implement milestone M16 only. Prepare the privately sideloadable signed Android APK, configure secure release signing without committing secrets, validate fresh installs and upgrades, run complete desktop import/export interoperability tests, verify offline behavior and final acceptance criteria, and produce concise release documentation. Do not publish to Google Play or add cloud functionality.

## 22. Cross-milestone quality gates

### 22.1. Desktop compatibility gate

Before completing milestones that affect interoperability or visual identity:

- Verify decisions against actual desktop source files.
- Reuse canonical theme values and stable note-color identifiers.
- Preserve exact `.glacier.json` schema versions and field names.
- Reuse existing desktop icon assets or clearly document an approved mobile adaptation.
- Test representative desktop-generated fixtures.
- Document intentional Android-only deviations.

### 22.2. Offline and privacy gate

Before completing each user-facing milestone:

- Confirm the feature works without an internet connection.
- Verify no external runtime asset or font is required.
- Confirm no account or cloud service is introduced.
- Avoid logging note content or exported document contents.
- Avoid unnecessary Android permissions.

### 22.3. Data integrity gate

Before completing each persistence or import milestone:

- Verify stable UUID relationships.
- Verify timestamps remain desktop-compatible.
- Ensure relevant writes are transactionally grouped.
- Confirm existing data survives process restart.
- Validate migration and error behavior.
- Avoid orphaned private image files.
- Prove that failed imports do not overwrite unrelated data.

### 22.4. Native Android gate

Before completing each native integration milestone:

- Verify the feature on an Android emulator.
- Verify critical picker, filesystem, sharing, backup, and lifecycle behavior on a physical device when available.
- Use modern scoped-storage patterns.
- Handle `content://` URIs correctly.
- Avoid relying exclusively on browser-development behavior.

### 22.5. User experience gate

Before completing each UI milestone:

- Validate dark and light themes.
- Verify English and German translations.
- Check meaningful icon labels and basic TalkBack behavior.
- Verify appropriate phone touch targets.
- Test both narrow and wider Android layouts.
- Confirm errors and destructive actions are clearly communicated.

## 23. Suggested fixture inventory

Maintain a representative desktop-compatible fixture set containing:

1. An empty collection.
2. A single Markdown note.
3. A note containing Unicode and German umlauts.
4. Multiple notebooks with assigned notes.
5. Multiple labels attached to one note.
6. A pinned note.
7. An archived note.
8. A trashed note when supported by the desktop schema.
9. Notes using every supported desktop note color.
10. An ordered checklist with checked and unchecked items.
11. A note with one image.
12. A note with multiple images.
13. A Markdown note containing `glacier-img://` references.
14. Conflicting entity IDs for both import strategies.
15. An unsupported schema version.
16. A malformed JSON document.
17. A missing entity relationship.
18. Invalid or truncated base64 image data.
19. A malicious or invalid imported filename.
20. A larger representative collection for performance testing.

Fixtures must not contain real confidential user notes, personal images, private signing credentials, or other sensitive data.

## 24. Suggested definition of done for each milestone

A milestone is complete only when:

1. Every in-scope task is implemented or explicitly documented as unnecessary.
2. Every acceptance criterion passes.
3. New or changed behavior has relevant automated tests.
4. Existing tests continue to pass.
5. Formatting, linting, type checking, and production builds pass.
6. Native Android verification is completed when the milestone affects native behavior.
7. No unrelated user changes were overwritten.
8. No cloud, authentication, encryption, analytics, or other prohibited v1 feature was introduced.
9. Desktop compatibility deviations are documented.
10. The implementation is ready for review as an independently understandable change.

## 25. Final release acceptance checklist

- [ ] Signed APK installs through private sideloading.
- [ ] Existing installations upgrade without losing local data.
- [ ] Application works in airplane mode.
- [ ] No registration, login, or cloud connection is required.
- [ ] Markdown notes can be created, edited, viewed, and deleted.
- [ ] Checklists support adding, editing, completion, and persistent ordering.
- [ ] Notebooks can be created, renamed, filtered, and safely deleted.
- [ ] Labels can be created, assigned, filtered, renamed, and safely deleted.
- [ ] Pinning and desktop-derived note colors work correctly.
- [ ] Archive and trash support restoration.
- [ ] Permanent deletion requires confirmation and cleans up related data.
- [ ] Existing device images can be attached without broad storage permissions.
- [ ] `glacier-img://` references resolve correctly.
- [ ] Search covers titles, Markdown content, and checklist text.
- [ ] Dark and light themes match desktop-derived design tokens.
- [ ] Existing desktop icons and branding are reused where practical.
- [ ] English and German translations are available.
- [ ] Desktop-generated `.glacier.json` exports import successfully.
- [ ] Android-generated `.glacier.json` exports import successfully on desktop.
- [ ] **Add as copies** remaps IDs and image references correctly.
- [ ] **Replace existing by ID** updates matching records without deleting unrelated notes.
- [ ] Failed imports preserve existing data and clean staged files.
- [ ] Android document picker and share sheet work on physical devices.
- [ ] Users are informed that exported backups are not encrypted.
- [ ] Users are informed that uninstalling the app removes local data.
- [ ] Android automatic cloud backup is disabled unless explicitly approved.
- [ ] Release permissions are minimal and justified.
- [ ] Production logs do not expose note content or embedded image data.
- [ ] Signing credentials are not committed to version control.
- [ ] All automated tests, type checks, formatting checks, and release-build checks pass.
