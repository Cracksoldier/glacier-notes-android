# Glacier Notes for Android

An offline-first Android note application, built to be file-compatible with the
[Glacier Notes desktop app](https://github.com/Cracksoldier/glacier-notes) through the
portable `.glacier.json` exchange format.

The app is fully local: no accounts, no cloud sync, no analytics, no telemetry. Notes,
notebooks, labels and images live in an app-private SQLite database and app-private
image files on the device.

## Documentation

| Document | Purpose |
| --- | --- |
| [`GLACIER_NOTES_ANDROID_SPECIFICATION.md`](GLACIER_NOTES_ANDROID_SPECIFICATION.md) | Product and technical specification |
| [`GLACIER_NOTES_ANDROID_MILESTONES.md`](GLACIER_NOTES_ANDROID_MILESTONES.md) | Milestone plan (M00–M16) |
| [`docs/desktop-audit.md`](docs/desktop-audit.md) | Audit of the desktop app; authoritative for design tokens, domain fields and the export schema |
| [`CLAUDE.md`](CLAUDE.md) | Working notes for coding agents |

> `docs/desktop-audit.md` records where the specification's *illustrative* domain model
> disagrees with the desktop implementation. Where they conflict, the desktop wins —
> implementing the specification verbatim would produce exports the desktop app rejects.

## Prerequisites

| Tool | Version used |
| --- | --- |
| Node.js | 24.x (npm 12) |
| JDK | 21 |
| Android SDK | compileSdk / targetSdk 36, minSdk 24 |
| Gradle | 8.14.3 (via the checked-in wrapper — no separate install needed) |

Install Android Studio, or the command-line SDK tools plus the SDK Platform 36 and
Build-Tools packages. Point Gradle at the SDK by setting `ANDROID_HOME`, or by creating
`android/local.properties` with `sdk.dir=/path/to/Android/Sdk` (that file is gitignored).

## Setup

```bash
npm install
```

## Development

```bash
npm start          # dev server at http://localhost:4200
npm run build      # production web bundle into www/
npm run watch      # rebuild on change (development configuration)
```

## Checks

```bash
npm run format:check   # Biome formatter check
npm run format         # Biome formatter, writing changes
npm run lint           # angular-eslint (Angular template and selector rules)
npm run typecheck      # tsc --noEmit over app and spec projects
npm run test           # Vitest under jsdom, single run
npm run test:watch     # Vitest in watch mode
```

Run a single test file:

```bash
npx ng test --configuration ci -- src/app/app.component.spec.ts
```

Formatting is handled by Biome and linting by angular-eslint; Biome's linter is disabled
so the two never disagree. This mirrors the desktop repository's setup.

## Android

```bash
npm run build            # web bundle must exist before syncing
npx cap sync android     # copy www/ and plugin config into android/
npx cap open android     # open the project in Android Studio
```

Debug build and install from the command line:

```bash
cd android
./gradlew assembleDebug
./gradlew installDebug   # requires a connected device or running emulator
```

The debug APK is written to `android/app/build/outputs/apk/debug/`.

Release signing is out of scope until M16. Keystores, `android/keystore.properties`
and `.env` files are gitignored and must never be committed.

## Application identifier

`com.glacier.notes` — matching the desktop application's identifier. It appears in
`capacitor.config.ts`, `android/app/build.gradle` (`namespace` and `applicationId`) and
`android/app/src/main/res/values/strings.xml`; keep all three in sync.
