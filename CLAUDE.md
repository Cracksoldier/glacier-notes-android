# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Glacier Notes Android is an offline-first note-taking app (Ionic + Angular + Capacitor) built as a mobile companion to the existing **Glacier Notes desktop app**: <https://github.com/Cracksoldier/glacier-notes>.

Two documents in the repo root govern all work here and take precedence over assumptions:

- `GLACIER_NOTES_ANDROID_SPECIFICATION.md` — what to build (domain model, persistence, theming, import/export, security).
- `GLACIER_NOTES_ANDROID_MILESTONES.md` — how to build it, decomposed into milestones M00–M16 with per-milestone scope, deliverables, verification, and acceptance criteria.
- `docs/desktop-audit.md` — the M00 audit. **Read §1 before touching domain models or export code**: the specification's illustrative `Note`/`Label`/`ImageAsset` shapes contradict the desktop implementation in twelve places, and the desktop wins.

**The desktop repository is authoritative** for visual design tokens, note colors, icons, domain model field names, and `.glacier.json` schema semantics. Never invent these values — audit the desktop source (milestone M00) and cite real source files. If desktop details are unavailable, document the blocker rather than guessing.

## Current repository state

M00 through M02 are complete. The design system, app shell and branding are in place; every drawer destination routes to a placeholder page because no data layer exists yet. Work continues at M03.

Starter defaults still awaiting a later milestone:

| Item | Current | Required by |
| --- | --- | --- |
| `android/app/src/main/AndroidManifest.xml` | has `INTERNET`, `allowBackup="true"` | M15 removes/disables both |
| `src/app/features/*` | placeholder pages behind `app-empty-state` | M04 onwards, one per feature |
| UI strings | English literals | M03 adds i18n |
| Theme mode | in memory, defaults to dark | M03 persists it |

Resolved by M01: app ID is `com.glacier.notes` in `capacitor.config.ts`, `android/app/build.gradle` and `strings.xml`; Biome formats (linter off) alongside angular-eslint; `format`, `format:check` and `typecheck` scripts exist; `.gitignore` covers keystores and Android build output.

Resolved by M02: `docs/design-system.md` records the token layers, the light-accent contrast deviation, the Font Awesome CC BY 4.0 attribution obligation (surfaced in Settings at M11), the re-vectorized brand mark, and why the Android system bars are wired the way they are. **Read it before touching `src/theme/`, `src/global.scss` or `android/app/src/main/res/values*/`** — several of those values look arbitrary but are derived or load-bearing.

## Commands

```bash
npm start                  # ng serve — browser dev server
npm run build              # production web bundle -> www/
npm test                   # Vitest via @angular/build:unit-test (jsdom, single run)
npm run test:watch         # same, in watch mode
npm run lint               # angular-eslint
npm run format:check       # Biome formatter check (formatter only; Biome's linter is off)
npm run typecheck          # tsc --noEmit over tsconfig.app.json and tsconfig.spec.json
```

Run a single test file or a single test by name:

```bash
npx ng test -c ci --include src/app/home/home.page.spec.ts
npx ng test -c ci --filter '^AppComponent'
```

Native Android:

```bash
npm run build && npx cap sync android
npx cap open android
cd android && ./gradlew assembleDebug
```

## Architecture

- **Angular 22 standalone** — no NgModules. Bootstrap is `src/main.ts` via `bootstrapApplication`; routes are lazy `loadComponent` entries in `src/app/app.routes.ts`. `IonicRouteStrategy` is provided so Ionic page caching works.
- **Strict everywhere** — `tsconfig.json` enables `strict`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, plus Angular `strictTemplates` and `strictInjectionParameters`. Do not weaken these.
- **Testing** — Vitest under jsdom through the Angular unit-test builder. `src/test-setup.ts` polyfills `window.matchMedia`, which Ionic components (`ion-menu`, `ion-split-pane`) require under jsdom; extend this file rather than stubbing per-spec.
- **Android target** — `android/variables.gradle`: minSdk 24, compile/target SDK 36. Capacitor 8.

- **Browser targets** — `.browserslistrc` is Chromium-only (Chrome/ChromeAndroid ≥ 107), since the only shipping runtime is the Android WebView.

The directory skeleton under `src/app/` exists but is empty: `core/` (database, filesystem, preferences, repositories, import-export, markdown, localization, native, models), `features/` (notes, notebooks, labels, archive, trash, search, settings, import-export), and `shared/`. UI code must reach persistence only through repository interfaces in `core/repositories` — never via direct SQLite plugin calls.

Data flows in two separated layers: domain models (desktop-compatible, UUID-keyed) vs. SQLite row models. Notes/notebooks/labels/checklists/image *metadata* live in SQLite; image *bytes* live in app-private files and are referenced from Markdown as `glacier-img://<imageId>`.

## Fixed v1 constraints

These are settled decisions (milestones doc §2) — do not reopen without explicit user approval:

- Fully offline. No cloud sync, no accounts, no auth, no network requests in release builds; drop the `INTERNET` permission where possible.
- No PIN, biometrics, SQLCipher, or export encryption.
- Local SQLite + app-private image files only.
- Import/export uses the desktop `.glacier.json` format with both **Add as copies** and **Replace existing by ID** strategies. Never introduce a parallel format under the same extension. (Desktop also has a third `preserve` strategy and scoped exports; whether Android adopts them is an open question in `docs/desktop-audit.md` §11.)
- English and German; dark and light themes; all fonts/icons/assets bundled locally.
- Distribution is a privately signed sideload APK — no Google Play, no AAB.
- Use system photo/document pickers; never request broad storage permissions.

## Working conventions

Implement **one milestone at a time** and stop when it's done — do not pull later-milestone functionality forward. Before starting, confirm prerequisite milestones passed their acceptance criteria; after finishing, run lint/typecheck/test/build plus any native verification the milestone calls for, and report skipped checks with the reason.

Every persistence or import change must preserve stable UUIDs and desktop-compatible timestamps, group related writes in transactions, and guarantee that a failure never destroys existing user data or leaves orphaned image files.

Never log note content, titles, imported document contents, or image payloads.
