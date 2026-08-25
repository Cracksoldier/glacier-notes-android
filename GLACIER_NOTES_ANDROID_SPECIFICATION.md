# Glacier Notes Android — Application Specification

- **Document version:** 1.0
- **Date:** 2026-08-25
- **Application name:** Glacier Notes
- **Platform:** Android
- **Application architecture:** Ionic, Angular, and Capacitor
- **Distribution:** Privately signed APK for sideloading
- **Persistence:** Local SQLite database and application-private image files
- **Security model:** Android application sandbox and device-level security
- **Cloud synchronization:** Explicitly excluded from version 1
- **Canonical desktop implementation:** <https://github.com/Cracksoldier/glacier-notes>

## 1. Product overview

Glacier Notes Android is a mobile companion to the existing Glacier Notes desktop application. Its first release provides the desktop application's core note-management capabilities through a touch-friendly Android interface while operating entirely offline.

Users create and organize notes locally on their devices. Data moves between desktop and Android installations through the established `.glacier.json` import/export format. The application does not require an account, an internet connection, or a Glacier Notes Cloud installation.

### 1.1. Primary goals

- Provide a complete offline-first note-taking experience on Android.
- Achieve parity with the desktop application's core note-management capabilities.
- Preserve compatibility with the existing Glacier Notes domain model and portable exchange format.
- Support Markdown notes, checklists, notebooks, labels, images, and note organization.
- Import and export desktop-compatible `.glacier.json` files.
- Reuse the desktop implementation as the authoritative reference for branding, colors, icons, theme behavior, and portable data semantics.
- Adapt the existing Glacier visual identity to a touch-first Android interface.
- Keep the architecture open to future cloud synchronization without requiring synchronization in version 1.

### 1.2. Explicit non-goals

Version 1 does not include:

- Cloud synchronization or background synchronization.
- Glacier Notes Cloud API integration.
- User accounts, registration, or application authentication.
- Application-specific PIN protection, biometric locking, or SQLCipher encryption.
- Real-time collaboration.
- Integrated Google Drive, Dropbox, WebDAV, or similar external storage services.
- Google Play publication.
- Home-screen widgets, Wear OS support, reminders, or push notifications.
- OCR, AI features, or document scanning.

These capabilities may be considered independently for future releases.

## 2. Canonical desktop reference

The existing desktop application is the authoritative reference for Android implementation decisions:

<https://github.com/Cracksoldier/glacier-notes>

The Android implementation must inspect the desktop repository before finalizing design tokens, exchange schemas, and behavior that depends on existing product conventions.

### 2.1. Design artifacts to inspect

- Global stylesheets and theme configuration.
- Dark and light theme definitions.
- Primary, secondary, and accent colors.
- Background, surface, border, text, and state colors.
- Note-card color values and stable color identifiers.
- Typography, font weights, and text hierarchy.
- Application logos, SVG files, and existing brand assets.
- Icon dependencies and icon styling.
- Card corner radii, shadows, spacing, and elevation.
- Markdown rendering styles.
- Inputs, buttons, dialogs, and navigation styling.
- Existing English and German localization resources.

### 2.2. Functional artifacts to inspect

- Canonical note, notebook, label, checklist, and image models.
- The actual `.glacier.json` serializer and deserializer.
- Supported schema versions and compatibility rules.
- Import semantics for **Add as copies**.
- Import semantics for **Replace existing by ID**.
- `glacier-img://` image-reference behavior.
- Sorting, pinning, archive, trash, and note-color behavior.
- Any product-specific handling of default notebooks and duplicate labels.

When this specification contains illustrative structures or examples that differ from the desktop implementation, the desktop repository takes precedence unless an Android-specific deviation is explicitly documented.

## 3. Technical architecture

### 3.1. Technology stack

| Area | Technology |
| --- | --- |
| Application framework | Angular |
| Mobile UI framework | Ionic Framework |
| Native Android runtime | Capacitor |
| Programming language | TypeScript |
| Styling | SCSS and Ionic theme variables |
| Structured persistence | SQLite |
| Native SQLite integration | `@capacitor-community/sqlite` or an equivalent maintained Capacitor SQLite plugin |
| Image storage | Android application-private filesystem |
| Lightweight settings | Capacitor Preferences |
| Native Android project | Capacitor-generated Android project |
| Build tooling | Angular CLI, npm, Android Studio, and Gradle |
| Distribution artifact | Signed Android APK |
| Formatting and linting | Biome |
| Localization | English and German |
| Testing | Angular-compatible unit tests, database integration tests, emulator tests, and physical-device tests |

Angular, Ionic, Capacitor, Android SDK, and SQLite plugin versions must be selected as one compatible combination. Exact versions should be pinned during implementation after checking the current compatibility matrix.

### 3.2. Architecture principles

The application should use:

- Standalone Angular components and route configuration.
- Strict TypeScript settings and strict Angular template checking.
- Feature-oriented directory organization.
- Angular signals for local UI state where appropriate.
- Explicit repository interfaces for local persistence.
- Domain models separated from SQLite-specific storage representations.
- Dependency injection for native integrations.
- Additive database migrations instead of destructive schema replacement.
- An isolated interoperability layer for desktop-compatible import/export.
- Shared product semantics without a runtime dependency on the cloud application.

Suggested application structure:

```text
src/
  app/
    core/
      database/
      filesystem/
      preferences/
      repositories/
      import-export/
      markdown/
      localization/
      native/
      models/

    features/
      notes/
      notebooks/
      labels/
      archive/
      trash/
      search/
      settings/
      import-export/

    shared/
      components/
      directives/
      pipes/
      utilities/

    app.component.ts
    app.routes.ts

  assets/
    i18n/
    icons/

  theme/
    variables.scss
    glacier-theme.scss
```

### 3.3. Future synchronization readiness

Version 1 must not introduce a required cloud connection. Future synchronization remains possible by preserving:

- Stable UUID-based entity identifiers.
- Creation and modification timestamps.
- Explicit repository and service boundaries.
- Deterministic image references.
- Portable import/export contracts.
- Versioned database migrations.

Future synchronization-specific metadata should not be added to the portable export format unless the canonical desktop exchange format supports it.

## 4. Android platform support

### 4.1. Supported devices

The application targets Android phones first.

Recommended baseline:

- Minimum Android version: Android 10, subject to confirmation against the final Capacitor and plugin compatibility matrix.
- Target SDK: the current stable Android SDK supported by the selected toolchain.
- Primary orientation: portrait.
- Landscape orientation: functional and usable.
- Tablets: supported through responsive layouts, without requiring a dedicated tablet-only experience.

### 4.2. Offline operation

All core functionality must remain available without internet access:

- Create, edit, and view notes.
- Manage notebooks and labels.
- Search local content.
- Attach selected device images.
- Import local files.
- Export local files.
- Share notes or exports using Android's native sharing mechanisms.

The release application must not make automatic network requests or depend on remote services. If feasible, its production Android manifest should omit the `INTERNET` permission. Development builds may differ when debugging or live reload requires networking.

Opening a link through an external Android application is permitted only after an explicit user action.

## 5. Domain model

The Android application must represent the same core functional concepts as the desktop application:

- Notebooks.
- Notes.
- Labels.
- Checklist items.
- Image assets.
- Note-to-label associations.

The structures below illustrate required semantics. They are not permission to invent a new portable schema: exact serialized field names and shapes must match the desktop implementation.

### 5.1. Notebook

```ts
interface Notebook {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

Requirements:

- Notebook IDs are stable UUIDs.
- Notebook names are editable.
- Notes may be assigned to notebooks.
- Desktop-supported notebook metadata must be preserved.
- Deleting a notebook must not silently delete its notes.

Recommended behavior is to ask for confirmation and move affected notes to a default or unassigned location. If the desktop application defines a different behavior, the existing product behavior takes precedence.

### 5.2. Note

```ts
interface Note {
  id: string;
  notebookId: string | null;
  type: 'markdown' | 'checklist';
  title: string;
  content: string;
  labelIds: string[];
  imageIds: string[];
  color: string | null;
  pinned: boolean;
  archived: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Requirements:

- Note IDs are UUIDs.
- Timestamps use a portable representation compatible with desktop.
- Markdown content preserves its original source.
- Notes may have multiple labels and images.
- Notes support pinning, archiving, coloring, and trash.
- Imported fields supported by the canonical desktop contract are preserved.

If desktop uses different type discriminators, field names, nullable behavior, or checklist representations, the desktop implementation is authoritative.

### 5.3. Checklist item

```ts
interface ChecklistItem {
  id: string;
  noteId: string;
  text: string;
  checked: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}
```

Requirements:

- Checklist items support inline Markdown where supported by desktop.
- Users may add, edit, toggle, reorder, and remove items.
- Item order persists.
- Import by existing ID preserves compatible existing identifiers.
- Import as copies generates replacement identifiers and remaps relationships.

### 5.4. Label

```ts
interface Label {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

Requirements:

- Labels may be created, renamed, and deleted.
- Notes may have multiple labels.
- Deleting a label removes associations without deleting notes.
- Duplicate-label handling should match desktop behavior.

### 5.5. Image asset

```ts
interface ImageAsset {
  id: string;
  noteId: string;
  mimeType: string;
  fileName: string;
  localPath: string;
  sizeBytes: number;
  createdAt: string;
}
```

Requirements:

- Image bytes are stored as application-private files.
- SQLite stores image metadata and relationships.
- Markdown image references use the existing Glacier convention:

  ```text
  glacier-img://<imageId>
  ```

- Import converts embedded image data into application-private files.
- Export converts application-private image files into the canonical portable representation.
- Device-specific paths must never appear in portable exports.

## 6. Local persistence

### 6.1. SQLite database

SQLite stores:

- Notebooks.
- Notes.
- Labels.
- Checklist items.
- Note-to-label relationships.
- Image metadata.
- Schema migration state.

Suggested conceptual tables:

```text
notebooks
notes
labels
note_labels
checklist_items
image_assets
schema_migrations
```

Database requirements:

- Enforce primary keys and relevant foreign keys.
- Explicitly enable foreign-key enforcement.
- Add indexes for frequently queried columns.
- Perform related mutations inside transactions.
- Support additive, versioned migrations.
- Preserve user data across upgrades.
- Persist data across application restarts.
- Never silently replace an existing database after migration failure.

Suggested indexes:

```text
notes.notebook_id
notes.updated_at
notes.pinned
notes.archived
notes.trashed_at

checklist_items.note_id
checklist_items.position

note_labels.note_id
note_labels.label_id

image_assets.note_id
```

SQLite full-text search may be used when supported and validated on target Android builds. A conventional database-query fallback is acceptable.

### 6.2. Application-private filesystem

Suggested conceptual structure:

```text
app-private/
  databases/
    glacier-notes.db

  images/
    <image-uuid>.webp
    <image-uuid>.jpg
    <image-uuid>.png

  temporary/
    exports/
    imports/
```

Requirements:

- Do not require broad external-storage permissions.
- Do not rely on hardcoded public filesystem locations.
- Remove temporary export files when no longer required.
- Prevent orphaned image files after failed imports and permanent deletion.
- Validate filenames and filesystem paths.
- Prevent imported filenames from escaping application-managed directories.

### 6.3. Application preferences

Capacitor Preferences stores lightweight settings such as:

- Theme selection.
- Language selection.
- Preferred note layout.
- Default notebook.
- Editor preferences.
- Sorting preferences.

Preferences must not contain the primary note database or large image payloads.

### 6.4. Android backup policy

Because version 1 is intentionally local-only, automatic Android cloud backup should be disabled by default unless a deliberate product decision explicitly permits it.

The user-controlled `.glacier.json` export is the supported backup and transfer mechanism.

The application must explain that uninstalling Glacier Notes removes its local database and application-private images unless a backup was exported beforehand.

## 7. Visual design and theming

### 7.1. Desktop-derived visual identity

The desktop repository is the authoritative visual reference. Android must derive its design from actual desktop implementation artifacts, including:

- Primary, secondary, and accent colors.
- Existing dark and light theme values.
- Surface, background, border, and text colors.
- Existing note-card colors and stable identifiers.
- Application logos and brand assets.
- Existing icon style and, where practical, the same icon library.
- Typography and text hierarchy.
- Spacing, corner radii, shadows, and card presentation.
- Existing Markdown rendering appearance.

Exact values must be extracted from desktop stylesheets, theme configuration, and assets rather than approximated.

### 7.2. Ionic design-token mapping

Desktop design tokens must be mapped to Ionic's theming system.

Illustrative mapping:

```scss
:root {
  /* Replace placeholders with values extracted from the desktop app. */
  --glacier-color-primary: <desktop-primary>;
  --glacier-color-secondary: <desktop-secondary>;
  --glacier-color-accent: <desktop-accent>;

  --glacier-background: <desktop-background>;
  --glacier-surface: <desktop-surface>;
  --glacier-border: <desktop-border>;

  --glacier-text-primary: <desktop-text-primary>;
  --glacier-text-secondary: <desktop-text-secondary>;

  --ion-color-primary: var(--glacier-color-primary);
  --ion-color-secondary: var(--glacier-color-secondary);
  --ion-background-color: var(--glacier-background);
  --ion-text-color: var(--glacier-text-primary);
  --ion-card-background: var(--glacier-surface);
  --ion-toolbar-background: var(--glacier-surface);
  --ion-item-background: var(--glacier-surface);
}
```

Ionic-specific contrast, shade, tint, and RGB companion variables must be calculated consistently from the extracted desktop values.

### 7.3. Themes

Required themes:

- Dark Glacier theme.
- Light Glacier theme.

Recommended settings:

- Dark.
- Light.
- Follow system.

The default should follow the existing desktop product convention, currently expected to be the dark Glacier theme.

### 7.4. Icons and branding

Requirements:

- Reuse the existing Glacier Notes logo when a suitable source asset exists.
- Generate the Android launcher icon from existing brand assets.
- Provide an adaptive launcher icon with foreground and background layers.
- Provide a monochrome launcher icon where supported.
- Match the Android splash screen to the existing Glacier identity.
- Prefer the desktop application's existing icon library if it integrates cleanly with Angular.
- Reuse desktop SVG assets directly where practical.
- Avoid mixing incompatible icon styles.
- Bundle required fonts and assets locally rather than loading them from external services.
- Verify that reused fonts, icons, and third-party assets are appropriately licensed.

### 7.5. Desktop-to-mobile adaptation

| Desktop pattern | Android adaptation |
| --- | --- |
| Persistent sidebar | Navigation drawer |
| Desktop note editor modal | Full-screen editor |
| Hover actions | Visible actions, long-press actions, or bottom sheets |
| Dense masonry layout | Responsive single-column or two-column note cards |
| Mouse-oriented menus | Touch-friendly action sheets |
| Keyboard shortcuts | Toolbar controls and Android navigation |
| Desktop file dialogs | Android document picker |
| Desktop sharing | Android share sheet |

Branding, color, typography, and component appearance should remain recognizable even when interaction patterns differ.

### 7.6. Responsive layouts

The application must support:

- Narrow phones.
- Larger phones.
- Landscape orientation.
- Wider tablet layouts.
- Display cutouts and system insets.
- Appropriate mobile touch-target sizing.

Recommended note layouts include one column on narrow screens and an optional two-column grid where available width supports it.

### 7.7. Accessibility

Minimum requirements:

- Sufficient text and component contrast.
- Accessible labels for icon-only controls.
- TalkBack-compatible navigation.
- Support for larger Android font sizes.
- Practical minimum touch-target dimensions.
- Clear focus states where applicable.
- No reliance on color alone to convey state.

## 8. Navigation and primary screens

Recommended application areas:

```text
Notes
Notebooks
Labels
Archive
Trash
Settings
Import / Export
```

### 8.1. Navigation pattern

Recommended implementation:

- Main notes screen as the initial route.
- Top application bar with search and contextual actions.
- Navigation drawer for notebooks, labels, archive, trash, settings, and import/export.
- Floating action button for creating notes.
- Bottom sheets for creation options and selected note actions.

A bottom-tab interface is not required because notebooks, labels, and filtered views map naturally to a navigation drawer.

### 8.2. Main note list

The main screen displays:

- Pinned notes in a separate top section.
- Other active notes below pinned notes.
- Note titles.
- Markdown text previews.
- Checklist previews.
- Image thumbnails.
- Labels where practical.
- Note colors.
- Last-modified information where appropriate.

Archived and trashed notes must not appear in the normal active-notes view.

### 8.3. Empty states

Provide useful empty states for:

- No notes.
- Empty notebook.
- Empty label.
- Empty archive.
- Empty trash.
- No search results.
- No available import file.
- Failed or incomplete import.

When practical, each empty state includes a relevant next action.

## 9. Note creation and editing

### 9.1. Supported note types

Version 1 supports:

1. Markdown text notes.
2. Checklist notes.

Both note types may include a title, images, labels, notebook assignment, note color, pin state, archive state, and trash state.

### 9.2. Note creation

The floating action button opens a menu offering:

- New text note.
- New checklist.

Creating a note opens the editor immediately.

A completely empty note may be discarded when leaving the editor only if doing so cannot discard meaningful attachments, checklist items, metadata, or other user content.

### 9.3. Mobile note editor

Use a dedicated full-screen route or full-screen Ionic modal.

Required editor capabilities:

- Editable title.
- Markdown-capable body input.
- Markdown formatting toolbar.
- Markdown preview.
- Checklist editor when applicable.
- Image attachment section.
- Notebook selection.
- Label selection.
- Note-color selection.
- Pin and unpin actions.
- Archive and restore actions.
- Trash action.
- Native share action.

The editor must remain usable while the Android soft keyboard is visible.

### 9.4. Markdown toolbar

Recommended toolbar actions:

- Bold.
- Italic.
- Heading.
- Bulleted list.
- Numbered list.
- Task list where appropriate.
- Inline code.
- Code block.
- Link.
- Quote.

The toolbar may scroll horizontally on smaller screens.

Markdown is stored as Markdown source, not as rendered HTML.

### 9.5. Markdown rendering

Requirements:

- Support the Markdown features implemented by desktop.
- Render local Glacier image references.
- Sanitize rendered HTML.
- Reject unsafe protocols and executable content.
- Do not automatically load external image URLs.
- Preserve desktop formatting compatibility where practical.
- Open external links only after explicit user interaction.

### 9.6. Autosave

Recommended behavior:

- Debounce normal editor input.
- Flush pending changes when navigating away.
- Flush pending changes when the app backgrounds.
- Persist checklist changes promptly.
- Show meaningful errors when saving fails.
- Avoid requiring a manual save action for normal editing.

Previously committed changes must survive unexpected application termination.

### 9.7. Checklist editing

Users must be able to:

- Add checklist items.
- Edit checklist text.
- Mark items complete or incomplete.
- Delete items.
- Reorder items using touch interaction.
- Preserve item ordering.
- Display checked items clearly.
- Use inline Markdown where supported by desktop.

Completed-item grouping must not silently change persisted ordering in an incompatible way.

## 10. Image attachments

### 10.1. Image sources

Version 1 must support attaching existing images using Android's system photo picker or document picker.

Camera capture may be added using Capacitor but is not required for desktop-core parity and may be deferred.

### 10.2. Supported formats

Recommended formats:

- JPEG.
- PNG.
- WebP.

Other formats may be supported when Android rendering and the desktop interchange format both handle them reliably.

### 10.3. Image lifecycle

Requirements:

- Copy selected images into application-private storage.
- Generate stable image UUIDs.
- Associate images with their notes.
- Display thumbnails in note cards and editors.
- Provide full-screen image previews.
- Allow users to remove images.
- Delete image files when they become unreferenced.
- Preserve image data across export/import.
- Avoid unexpectedly degrading imported images through automatic recompression.

### 10.4. Permissions

Prefer Android's system image and document pickers. Broad access to all device photos or files must not be requested solely to attach a user-selected image.

## 11. Notebooks

Users can:

- Create notebooks.
- Rename notebooks.
- Delete notebooks.
- Browse notes in a notebook.
- Move notes between notebooks.
- Select a default notebook for new notes.

Requirements:

- Notebook selection is available in the editor.
- Notebook filtering updates the note list.
- Notebook deletion must not silently destroy note content.
- Import/export preserves notebook IDs and note relationships.

## 12. Labels

Users can:

- Create labels.
- Rename labels.
- Delete labels.
- Assign multiple labels to a note.
- Remove labels from notes.
- Filter notes by label.

Requirements:

- Label selection is available in the note editor.
- Label filtering is available through primary navigation.
- Deleting a label removes its relationships without deleting notes.
- Import/export preserves labels and note-label relationships.

## 13. Pinning, note colors, archive, and trash

### 13.1. Pinning

Users can pin and unpin notes.

Pinned notes appear above ordinary active notes. Within pinned and unpinned groups, notes follow the selected sorting order.

### 13.2. Note colors

Users may assign predefined note colors derived from the desktop application.

Requirements:

- Reuse desktop color values and stable identifiers.
- Keep note colors readable in dark and light themes.
- Expose color selection from the editor.
- Preserve supported imported colors.

### 13.3. Archive

Users can archive notes, browse archived notes, and restore archived notes to the normal active-note view.

Recommended search defaults:

- Main-screen search covers active notes.
- Archive-screen search covers archived notes.
- A future global-search option may include all non-trashed notes.

### 13.4. Trash

Users can:

- Move notes to trash.
- Browse trashed notes.
- Restore trashed notes.
- Permanently delete individual notes.
- Empty the trash.

Permanent deletion requires confirmation.

Trash should not be purged automatically unless the desktop product already defines and requires such behavior.

Permanent deletion must clean up checklist items, note-label relationships, image metadata, and unreferenced image files.

## 14. Search

Local search must cover:

- Note titles.
- Markdown note content.
- Checklist item content.

Notebook and label names may additionally be searchable.

Search requirements:

- Update results as the user types.
- Perform case-insensitive matching where practical.
- Respect notebook, label, archive, or trash context unless explicitly configured otherwise.
- Prefer database-backed filtering over loading all content into the Angular UI.
- Handle Unicode and German-language text correctly.
- Remain responsive with realistic note collections.

## 15. Import and export

### 15.1. Canonical file format

The portable exchange format is:

```text
*.glacier.json
```

The desktop serializer and deserializer are the authoritative format definition.

Exports must preserve the desktop-supported representation of:

- Schema version.
- Notebooks.
- Notes.
- Labels and note-label relationships.
- Checklist items.
- Pin, archive, trash, and color state where supported.
- Embedded image data.
- Stable UUID relationships.

The Android app must not create an incompatible alternative format with the same filename extension.

### 15.2. Export scope

Version 1 exports the complete local collection, including active notes, archived notes, notebooks, labels, checklists, and images.

Trashed notes are exported when and only when the desktop exchange contract includes them. Application settings are exported only when explicitly supported by the desktop schema.

### 15.3. Export workflow

1. The user selects **Export**.
2. The application assembles and validates the canonical portable document.
3. The user chooses whether to save the file or share it.
4. The application writes a `.glacier.json` file.
5. The result is clearly displayed.

Suggested filename:

```text
glacier-notes-2026-08-25.glacier.json
```

Saving must use Android's document picker rather than unrestricted storage access.

### 15.4. Import workflow

1. The user selects **Import**.
2. Android's document picker opens.
3. The user selects a `.glacier.json` file.
4. The application validates JSON structure and schema compatibility.
5. The application shows an import summary including notes, notebooks, labels, checklists, images, and potential ID conflicts.
6. The user chooses an import strategy.
7. The application performs the import.
8. The application displays the outcome.

### 15.5. Add as copies

When importing as copies:

- Generate replacement notebook IDs where necessary.
- Generate replacement note IDs.
- Generate replacement checklist-item IDs.
- Generate replacement image IDs.
- Remap notebook, checklist, image, and label relationships.
- Remap `glacier-img://` references.
- Preserve supported titles, content, timestamps, organization, and appearance according to desktop behavior.
- Do not overwrite existing local notes.

### 15.6. Replace existing by ID

When importing by existing ID:

- Preserve imported UUIDs.
- Update existing entities whose IDs match.
- Insert entities whose IDs are not present locally.
- Preserve notebook, label, checklist, and image relationships.
- Replace affected image files safely.
- Do not remove unrelated local data unless the canonical desktop strategy explicitly requires it.
- Clearly warn users that matching local content may be overwritten.

### 15.7. Import validation and recovery

Requirements:

- Validate schema versions before writing.
- Reject malformed JSON.
- Reject unsupported schema versions with an actionable explanation.
- Validate required fields and entity relationships.
- Validate UUIDs where required.
- Validate image MIME types and embedded image payloads.
- Apply practical, documented limits to prevent excessive memory consumption.
- Perform related database mutations transactionally.
- Roll back database changes if import fails.
- Clean up partially created image files.
- Prevent filesystem path traversal.
- Preserve unrelated existing notes after failure.

Because image data is embedded into `.glacier.json`, large files may consume significant memory. The implementation should avoid unnecessary copies of large base64 strings and document supported practical size limits.

### 15.8. Desktop interoperability fixtures

Compatibility fixtures must include:

- Desktop export imported into Android.
- Android export imported into desktop.
- Markdown notes.
- Checklist notes.
- Multiple notebooks.
- Multiple labels.
- Archived, pinned, and colored notes.
- Trashed notes where supported by the canonical schema.
- Multiple attached images.
- `glacier-img://` references.
- Duplicate IDs under both import strategies.
- Unsupported schema versions.
- Malformed or incomplete files.

## 16. Android sharing

### 16.1. Sharing individual notes

Users may share:

- Note title and Markdown content as text.
- Checklist content as readable text.
- Attached images when supported by the selected share flow.

Sharing must use Android's native share sheet.

### 16.2. Sharing exported backups

Users can share generated `.glacier.json` backups through Android's native share sheet.

The receiving application is selected by the user. Glacier Notes must not itself introduce direct integration with email providers, messaging services, or cloud-storage platforms.

### 16.3. Receiving shared content

Receiving externally shared text or images is not required for version 1 and may be implemented later.

## 17. Localization

Supported application languages:

- English.
- German.

Requirements:

- Follow the device language when supported.
- Allow an explicit application language selection.
- Persist language preferences.
- Format dates and numbers appropriately for the selected locale.
- Keep export/import data language-neutral.
- Never translate or modify user-created note content automatically.
- Reuse existing desktop translations and terminology where practical.
- Externalize user-facing strings from Angular components.

## 18. Settings

Version 1 settings include:

- Theme selection.
- Language selection.
- Note-list layout.
- Default notebook.
- Sorting preference.
- Import/export access.
- Application version information.
- Local-storage behavior.
- Backup and uninstall warnings.

Optional editor preferences include Markdown preview behavior, checklist completed-item display, and preferred note-creation type.

The settings interface must not advertise cloud synchronization before synchronization is implemented.

## 19. Security and privacy

### 19.1. Security model

Version 1 relies on:

- Android application sandboxing.
- Android device-level filesystem protections.
- The user's device lock settings.
- Android's normal permission model.

Version 1 does not include an application PIN, biometric unlock, SQLCipher database encryption, end-to-end encryption, or encrypted export files.

### 19.2. User-facing privacy disclosures

The application should clearly explain:

- Notes are stored locally on the Android device.
- No account is required.
- No application-managed cloud synchronization occurs.
- Export files may contain all notes and embedded images.
- Export files are not encrypted by default.
- Anyone with access to an exported file may be able to read its contents.
- Uninstalling the application removes local application data.

### 19.3. Logging

Requirements:

- Do not log full note content.
- Do not log imported file contents.
- Do not log embedded image data.
- Avoid logging user-created titles in production builds.
- Keep production logs focused on technical diagnostics.

### 19.4. Markdown and imported-content safety

Requirements:

- Sanitize rendered Markdown.
- Block JavaScript URLs and unsafe protocols.
- Prevent execution of imported scripts or HTML.
- Validate image payloads before writing files.
- Prevent malicious imported filesystem paths.
- Do not automatically fetch externally referenced resources.

## 20. Error handling and resilience

The application must gracefully handle:

- Insufficient device storage.
- Database initialization failure.
- Database migration failure.
- Corrupted or missing image files.
- Unsupported import formats.
- Malformed JSON.
- Interrupted imports.
- Failed exports.
- Canceled Android document-picker actions.
- Revoked or invalid document access.
- Android process termination.
- Application upgrades.
- Rotation or backgrounding during relevant operations.

User-facing errors should explain what happened, avoid raw stack traces, state whether existing notes remain safe, and provide a recovery action where possible.

## 21. Performance requirements

Recommended expectations:

- Launch promptly on a representative supported Android phone.
- Remain usable with collections containing several thousand notes.
- Preserve responsive editor input.
- Maintain smooth scrolling in note lists.
- Update search results without freezing the interface.
- Display thumbnails without loading every full-resolution image.
- Show progress for imports or exports that take noticeable time.
- Avoid preventable memory exhaustion with large image collections.

Validate performance on an emulator, at least one physical midrange Android phone, and a realistic dataset containing notes, checklists, labels, notebooks, and images.

## 22. Testing strategy

### 22.1. Unit tests

Cover:

- Note creation and updates.
- Notebook operations.
- Label assignment.
- Checklist ordering.
- Archive and trash behavior.
- Markdown image-reference resolution.
- Import validation.
- UUID remapping.
- Export serialization.
- Settings persistence.
- Search filtering.

### 22.2. Database integration tests

Cover:

- Initial schema creation.
- Foreign-key constraints.
- Database migrations.
- Transaction rollback.
- Permanent deletion cleanup.
- Import conflict handling.
- Search queries.
- Image metadata consistency.

### 22.3. Native Android tests

Validate:

- SQLite initialization.
- Application-private file creation.
- Android image selection.
- Image rendering.
- Document-picker import.
- Document-picker export.
- Native share-sheet behavior.
- Background/foreground autosave.
- Signed APK installation and upgrades.

### 22.4. Cross-platform compatibility tests

Required scenarios:

```text
Desktop export -> Android import
Android export -> Desktop import
Desktop export -> Android import -> Android export -> Desktop import
```

Round trips must preserve supported content, organization, IDs, and relationships according to the chosen import mode.

### 22.5. Manual acceptance checks

Confirm:

- The application works in airplane mode.
- Notes and images survive restarts.
- Desktop exports import correctly.
- Android exports import correctly on desktop.
- Backup and uninstall warnings are visible.
- No unnecessary account, permission, or network prompts appear.
- Dark and light themes match the desktop reference.
- English and German translations are usable.
- The signed APK installs successfully through sideloading.

## 23. Build and release

### 23.1. Development prerequisites

Recommended tools:

- Node.js.
- npm.
- Android Studio.
- Android SDK.
- Compatible JDK.
- Ionic CLI.
- Capacitor Android tooling.

Example local workflow:

```bash
npm install

ionic serve
```

Build and synchronize the native Android project:

```bash
ionic build

npx cap sync android

npx cap open android
```

### 23.2. APK signing

Requirements:

- Use a dedicated Android release-signing keystore.
- Keep the keystore outside version control.
- Keep signing passwords and credentials outside committed configuration.
- Back up the signing keystore securely.
- Reuse the same signing identity for subsequent updates.

Losing the release-signing key may prevent installing later versions as updates over existing installations.

### 23.3. Distribution artifact

Version 1 is distributed as a signed APK, for example:

```text
glacier-notes-android-v1.0.0.apk
```

An Android App Bundle is not required for the private sideloading distribution model.

### 23.4. Versioning

Use semantic application versions:

```text
1.0.0
1.1.0
1.1.1
```

Increase the Android `versionCode` monotonically for every distributable build.

## 24. Implementation milestones

### M0 — Project foundation and desktop design audit

- Inspect the existing desktop repository.
- Identify theme files, design tokens, icon dependencies, logos, and localization resources.
- Identify canonical domain models and `.glacier.json` serializers.
- Record extracted colors and typography as reusable Android design tokens.
- Create the Ionic Angular application.
- Configure Capacitor for Android.
- Configure strict TypeScript and Angular template checking.
- Configure Biome.
- Implement dark and light themes using desktop-derived values.
- Integrate the desktop icon library or reusable SVG assets.
- Generate launcher and splash assets from existing branding.
- Verify execution on an Android emulator and a physical device.

### M1 — Local persistence and core models

- Integrate SQLite.
- Define the initial database schema.
- Implement versioned migrations.
- Define domain models and repository interfaces.
- Add application-private image-storage abstractions.
- Implement lightweight settings persistence.
- Add representative database integration tests.

### M2 — Markdown notes and editor

- Implement the main note-list screen.
- Create and edit Markdown notes.
- Add autosave.
- Add the Markdown formatting toolbar and preview.
- Implement responsive note cards.
- Support title/content search.

### M3 — Notebooks, labels, and note organization

- Implement notebook management.
- Implement label management.
- Add pinning and desktop-compatible note colors.
- Add archive and restore behavior.
- Add trash, restoration, and permanent deletion.
- Implement required cleanup and filtering.

### M4 — Checklists and images

- Implement checklist creation and editing.
- Support checklist item ordering.
- Integrate Android image selection.
- Persist images as application-private files.
- Resolve `glacier-img://` references.
- Implement image previews and removal.

### M5 — Desktop-compatible import/export

- Codify the canonical desktop exchange schema.
- Implement `.glacier.json` export.
- Implement validated `.glacier.json` import.
- Implement **Add as copies** and **Replace existing by ID**.
- Integrate Android document pickers.
- Integrate native share-sheet functionality.
- Add desktop-to-Android and Android-to-desktop compatibility fixtures.

### M6 — Hardening and signed release

- Complete English and German translations.
- Validate accessibility and responsive layouts.
- Test representative larger datasets.
- Verify complete offline operation.
- Review manifest permissions and Android backup configuration.
- Test database migrations and signed APK upgrades.
- Generate a signed release APK.
- Complete physical-device acceptance testing.

## 25. Final acceptance criteria

Version 1 is complete when:

1. A signed APK installs successfully on a supported Android device.
2. The application works without internet connectivity, an account, or cloud synchronization.
3. Users can create, edit, and manage Markdown notes and checklists.
4. Users can organize notes using notebooks, labels, pinning, note colors, archive, and trash.
5. Users can attach and view images.
6. Users can search local notes and checklist content.
7. Application data persists across application restarts and compatible upgrades.
8. English and German localizations are available.
9. Dark and light themes reflect the existing desktop application's actual design.
10. Android branding, icons, and note colors are derived from the desktop repository.
11. Existing desktop `.glacier.json` exports import successfully.
12. Android-generated `.glacier.json` exports import successfully into desktop.
13. Both **Add as copies** and **Replace existing by ID** work correctly.
14. Failed imports preserve existing local data.
15. Users can save or share portable exports using standard Android mechanisms.
16. The application introduces no application PIN, biometric locking, database encryption, or required online service.
17. Production permissions are limited to those genuinely required by the selected implementation.
18. Users are informed that exports are unencrypted and uninstalling the app removes local data.
