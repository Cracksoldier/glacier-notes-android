# Glacier Notes for Android — 1.0.0

The first release. Glacier Notes for Android is an offline-first note app and a
companion to the [Glacier Notes desktop app](https://github.com/Cracksoldier/glacier-notes):
your whole collection moves between the two through a single `.glacier.json` file
that both read and write.

Distribution is a privately signed APK, installed by sideloading. It is not on
Google Play.

## What it does

**Notes.** Markdown notes with a live preview, a formatting toolbar, and images
attached from the system photo picker. A note can instead be an ordered checklist
with drag-reordering and completed items grouped at the end — and a note can be
converted from one to the other and back without losing anything.

**Organisation.** Notebooks, labels, note colours, pinning, archive, and a trash
that auto-purges on a schedule you choose (or never). The desktop's note colours
and label semantics are used as-is, so a collection looks the same on both.

**Finding things.** Search titles, bodies and checklist items within any scope,
with matches highlighted. Sort by last edited, newly created, or title.

**Import and export.** The whole collection round-trips through `.glacier.json`.
Export leaves through Android's own save dialog or share sheet; import comes back
through the system document picker, with a preview of what the file contains
before anything is written. Both conflict strategies are supported — *add as
copies* and *replace existing by ID* — and an import that fails partway leaves
your notes exactly as they were. A single note can also be shared as plain text to
any app.

**Presentation.** English and German, dark and light themes, all fonts and icons
bundled locally. Tested with TalkBack and at increased font scale.

## What it deliberately does not do

These are settled v1 decisions rather than missing features:

- **No cloud, no account, no sync.** The release build holds no `INTERNET` permission at all. Nothing you write leaves the device unless you export it yourself.
- **No PIN, no biometric lock, no database encryption.** Notes are protected by your device's own lock screen and by Android's app sandbox, and by nothing else.
- **No Google Play, no automatic updates.** New versions are installed the same way as the first.
- **No crash reporting or telemetry.** Reporting a crash would require the network permission the app does not have.
- **English and German only.**

## Backups are your responsibility

This matters more here than in most apps, because nothing is backing you up
silently.

- **The app is excluded from Google cloud backup on purpose** (`allowBackup="false"` plus a data-extraction rules file that excludes every domain). Device-to-device transfer when you set up a new phone is allowed and will carry your notes across; a cloud restore will not, because nothing was uploaded.
- **Uninstalling deletes everything** — the database and every attached image, with no recovery.
- **Export to `.glacier.json` is the backup.** Settings › Import / Export writes one file containing every note, notebook, label, checklist and image, including the trash. Keep it somewhere off the device, and export again after work you would not want to redo.

## Known limitations

- Restoring a very large collection is a single all-or-nothing transaction; on a collection of ~2000 notes it takes about 13 seconds, during which the app is busy. This is the mechanism that guarantees a failed import changes nothing.
- The app always opens on the note list rather than restoring the last note you had open.
- A referenced image whose file is missing renders as a broken-image placeholder with its alt text; the rest of the note renders normally.

## Install

Enable installation from unknown sources for whichever app you are installing
from, then open the APK. To upgrade later, install the new APK over the old one —
your notes are kept. An APK signed with a different key will be refused rather
than replacing your installation; this is Android protecting your data, not a
fault.
