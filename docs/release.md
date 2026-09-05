# Release (M16)

M15 fixed the app's shipping *posture*. M16 produces the shipping *artefact*: a
privately sideloadable, signed APK, built by a procedure someone else can repeat,
with the signing material provably outside this repository.

This document is the M16 deliverable. It records the build-environment
prerequisites that are not obvious and cost an hour each when missed, the
reproducible build procedure, the version scheme, how release signing is wired
without committing a secret, what R8 is and is not doing and why each keep rule
exists, and the evidence gathered on device.

Everything marked *observed* was exercised against a release APK built from this
tree on the `Pixel_9_Pro_XL` emulator (Android 16, API 36).

## 1. Build-environment prerequisites

Three things block a build on a clean machine. None is a code change, and none is
discoverable from a failure message that says what is actually wrong.

### The JDK must be 21, not whatever is on `PATH`

Gradle 8.14.3 (`android/gradle/wrapper/gradle-wrapper.properties`) with AGP 8.13.0
does not support JDK 25. A machine whose `java` is 25 fails during configuration
with a message about an unsupported class file version, which reads like a
dependency problem rather than a toolchain one.

Android ships a JDK 21 with the SDK tooling. Pass it per invocation:

```bash
cd android && JAVA_HOME="/c/Program Files/Android/openjdk/jdk-21.0.8" ./gradlew assembleRelease
```

**Do not put this in `android/gradle.properties` as `org.gradle.java.home`.** That
file is tracked, and the path is machine-specific; the next person to clone would
inherit a path that does not exist on their machine.

### `android/local.properties` must exist

Gradle needs `sdk.dir`. The file is gitignored (`.gitignore:76`) precisely because
it is machine-specific, so a fresh clone does not have one:

```properties
sdk.dir=C\:\\Users\\<your-user>\\AppData\\Local\\Android\\Sdk
```

Two things about that value, both of which produce an unhelpful error when got
wrong: a Java properties file does **not** expand environment variables, so
`%USERPROFILE%` or `$HOME` stays a literal string and the SDK is reported missing;
and the backslashes and the colon must be escaped exactly as above, because `\` is
the properties-format escape character. A forward-slash path avoids both problems
if you prefer it.

### Node must satisfy the Angular CLI's floor

`ng build` produces `www/`, which `npx cap sync android` copies into
`android/app/src/main/assets/public`. Without it the APK contains a stale bundle or
none at all.

Angular CLI 22 refuses to run below v22.22.3 / v24.15.0 / v26.0.0 and **exits
before building** — with, on some shells, an exit status that a wrapper script
reports as success. The failure mode to recognise is a "build" that finishes
suspiciously fast and leaves `www/` absent. Check `node --version` first.

### A note on line endings

`biome.json` sets `"lineEnding": "lf"`, and the repository stores LF. A clone made
with `core.autocrlf=true` (the Windows default) checks out CRLF, and
`npm run format:check` then fails on *every* file while `git status` stays clean —
the mismatch is invisible in the diff. Set it per repository and renormalise:

```bash
git config core.autocrlf false
npm run format          # rewrites CRLF -> LF; content is unchanged, so git sees no diff
git add -A && git reset # refresh the index's stat cache after the rewrite
```

## 2. The build procedure

From a clean checkout, with the prerequisites above satisfied and
`android/keystore.properties` in place (§4):

```bash
npm ci
npm run build                       # -> www/
npx cap sync android                # -> android/app/src/main/assets/public
cd android
JAVA_HOME="/c/Program Files/Android/openjdk/jdk-21.0.8" ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

Verify what came out before shipping it — the APK is signed and minified, and both
are silent when wrong:

```bash
SDK=$LOCALAPPDATA/Android/Sdk
"$SDK/build-tools/36.1.0/apksigner" verify --print-certs --verbose app-release.apk
"$SDK/build-tools/36.1.0/aapt2" dump badging app-release.apk | head -1
```

## 3. Version scheme

| Field | Value | Meaning |
| --- | --- | --- |
| `applicationId` | `com.glacier.notes` | Fixed since M01. Identical in `capacitor.config.ts`, `android/app/build.gradle` and `strings.xml`. Changing it makes every installed copy a different app. |
| `versionCode` | integer, monotonic | Bumped for **every** artefact that reaches a device, never reused, never decremented. Android refuses to install a lower one over a higher one. |
| `versionName` | semver | The human-facing string. `SettingsPage` reads it through `App.getInfo().version` (`settings.page.ts:300`) and renders it in Settings › About, so it is user-visible and should not be a build number. |

Both live in `android/app/build.gradle`'s `defaultConfig`. `versionCode` and
`versionName` move independently: a rebuild for a signing or packaging fix bumps
only the code.

## 4. Release signing

The keystore is a private key. Losing it or leaking it are both unrecoverable in
different directions, so the wiring keeps it entirely outside the working tree.

### Creating the keystore

Once, on a machine the developer controls, outside any repository:

```bash
keytool -genkeypair -v \
  -keystore "$USERPROFILE/.android-keystores/glacier-notes-release.jks" \
  -alias glacier-notes -keyalg RSA -keysize 4096 -validity 10000 \
  -storetype PKCS12
```

The distinguished-name fields prompted for are embedded in the certificate and are
readable by anyone who inspects the APK. With PKCS12 the key password is the store
password.

### Pointing the build at it

`android/keystore.properties` — gitignored at `.gitignore:82`, never committed:

```properties
storeFile=C:/Users/<your-user>/.android-keystores/glacier-notes-release.jks
storePassword=...
keyAlias=glacier-notes
keyPassword=...
```

`storeFile` is read by the same properties parser as `sdk.dir`, so the same two
rules apply: no environment-variable expansion, and forward slashes are the
simplest way to write a Windows path here. A relative path would be resolved
against `android/app/`, which is inside the working tree — use an absolute one, so
that a mistyped path fails loudly instead of quietly pointing somewhere committable.

`android/app/build.gradle` reads it **only if it exists**, and applies
`signingConfig` to the release build type only in that case. This is deliberate: a
fresh clone with no keystore still configures and still builds, producing an
unsigned release APK, rather than failing with a configuration error that looks
like a broken project. The corollary is the failure mode — **a missing or
misspelled `keystore.properties` does not fail the build, it silently produces an
unsigned APK.** `apksigner verify` in §2 is what catches that, which is why it is
part of the procedure and not an optional extra.

`.gitignore` covers `*.jks`, `*.keystore` and `/android/keystore.properties`
(lines 80–82). Nothing about signing is committed.

### Storage and backup responsibility

- **Back the keystore up somewhere the working tree is not**, and keep the password with it but not beside it.
- **If the keystore is lost, there is no upgrade path.** Android identifies an app by `applicationId` *and* signing certificate. A build signed with a different key cannot install over an existing one — it is refused, not merged. Recovery means a new `applicationId`, and every user manually exporting to `.glacier.json`, uninstalling, installing the new package and importing. This is the single most consequential sentence in this document.
- The certificate's SHA-256 fingerprint, printed by `apksigner verify --print-certs`, is the identity to compare against when in doubt about which key built an APK.

## 5. R8

`minifyEnabled true` on the release build type, `proguard-android.txt` plus
`android/app/proguard-rules.pro`. `docs/hardening.md` §9 deferred this to M16
because Capacitor is reflected into and a wrong strip is invisible until runtime.

`shrinkResources` is deliberately **off**. It shrinks Android resources only and
never `assets/public`, where the entire web bundle lives, so the size it would
recover is small next to a failure mode that appears only when a page is opened on
a device.

### Why the keep rules exist

Capacitor's core AAR ships consumer rules
(`node_modules/@capacitor/android/capacitor/proguard-rules.pro`) that keep every
`@CapacitorPlugin` class and everything extending `com.getcapacitor.Plugin`. A
plugin that arrives as an AAR therefore needs nothing from us.

**A plugin included as a Gradle project does not get that.** Consumer rules
propagate through `consumerProguardFiles`, and `@capacitor-community/sqlite` —
included as `implementation project(':capacitor-community-sqlite')` — declares
none. Its own `proguardFiles` entry applies to building the library, not to the app
that consumes it. Every rule in `android/app/proguard-rules.pro` exists for that
gap or for code reached from JNI, which R8 cannot see at all.

`MainActivity` is named as a string in the manifest and registers `DocumentsPlugin`
by class literal, so both are kept explicitly rather than relying on the consumer
rule reaching into the app module.

### `mapping.txt` is an artefact, not a leftover

`android/app/build/outputs/mapping/release/mapping.txt` is the only thing that can
turn a stack trace from a shipped APK back into source symbols. It is under
`build/` and therefore gitignored, and `./gradlew clean` deletes it.

**Archive it next to every APK handed to anyone.** An APK without its mapping file
is one whose crashes cannot be read, and the file cannot be regenerated later —
a rebuild produces different names.

If R8 ever wants a rule that is missing, AGP writes exactly what it needs to
`android/app/build/outputs/mapping/release/missing_rules.txt`. Read that file
rather than guessing, and add each rule with a comment naming the dependency it
is for.

## 6. Release evidence

All rows *observed* on `Pixel_9_Pro_XL` (Android 16, API 36, `emulator-5554`) against
the signed release APK built from this tree.

### Deviation from the milestone text

M16 asks for installation on a **physical** device. There was none available, so the
whole pass ran on the emulator. This is recorded rather than glossed: an emulator
exercises the same ART, the same WebView and the same SAF implementation, but it does
not exercise a vendor's document provider, a vendor's photo picker, or real storage
pressure. Nothing found here depended on emulation, and nothing below is inferred —
every row was executed.

Two things a **release** APK makes impossible on a production emulator image, and both
are correct rather than obstacles: `run-as` is refused (*"package not debuggable"*), and
`adb root` is refused (*"adbd cannot run as root in production builds"*). M15 read the
database directly with structural SQL; that is not available here. **The export file is
the instrument instead** — a `.glacier.json` export is a complete dump of every entity,
so comparing two exports is a stronger statement about user-visible data than a row
count, and it is what a user's backup would actually contain.

### The artefact

| Property | Value |
| --- | --- |
| File | `app-release.apk`, 9.17 MB |
| `package` | `com.glacier.notes`, `versionCode='1'`, `versionName='1.0.0'` |
| `minSdkVersion` / `targetSdkVersion` | 24 / 36 |
| `application-label` | `Glacier Notes` |
| Signature | v2 (APK Signature Scheme v2); v1, v3, v3.1, v4 absent |
| Certificate | `CN=Cracksoldier, OU=Private, O=Private, L=Vienna, ST=Vienna, C=AT`, RSA 4096 |
| Certificate SHA-256 | `465466d1d25a16a43d3bada1ebdb20bb125d76704230ce7af285b3d50fb44440` |
| Permissions | `VIBRATE`, `com.glacier.notes.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` — and nothing else |
| `allowBackup` | `false`; `dataExtractionRules` present; `android:debuggable` absent |
| `mapping.txt` | 6.52 MB |

v2-only is sufficient at `minSdk 24` — v1 (JAR signing) is only needed below API 24,
and v3 exists for key *rotation*, which cannot help in the scenario §4 warns about
(rotation needs the old key; losing it is still terminal).

**R8 did not change the permission set.** The two entries are exactly the two M15
established, verified again on the minified, signed artefact.

### R8 needed one round of rules

The first `assembleRelease` **failed** at `:app:minifyReleaseWithR8` with six missing
classes — Error Prone and JSR-305 annotations referenced by Google Tink, which arrives
through `androidx.security:security-crypto`, a dependency of the SQLite plugin's
encrypted-database mode this app does not use. They are compile-time-only annotations,
absent from the runtime classpath by design.

The six `-dontwarn` lines now in `proguard-rules.pro` are copied verbatim from
`missing_rules.txt`, not invented. With them the build succeeds, and nothing else was
needed: no keep rule had to be guessed, and no runtime failure appeared afterwards.

### Behaviour on device

| Check | Observed |
| --- | --- |
| **Fresh install** | Installs clean. Cold start reaches the note list with the *"No notes yet"* empty state — not the load-error state, which is what a broken SQLite plugin would render. No `FATAL`, no `ClassNotFoundException`, no `UnsatisfiedLinkError`. |
| **R8 runtime integrity** | The full feature surface renders on the minified build: desktop note colours, a checklist with a struck-through completed item, UTF-8 (`Straßenkarte`), an embedded image served through `glacier-img://`, bold Markdown, and a label chip. Archived and trashed notes correctly absent from the list. |
| **Desktop → Android** | The desktop fixture picked through the real SAF document picker. Preview read *"2 notebooks · 6 notes · 1 labels · 1 images"* — identical to the desktop's own `envelopeCounts` over the same file — and no conflict was reported. Import applied cleanly. |
| **Android → desktop** | The APK's export replayed through the desktop's own compiled `validateEnvelope` / `detectConflicts` / `applyImportEnvelope` (desktop commit `e217a7a`). Accepted and fully restored: 2 notebooks, 6 notes (4 active, 1 archived, 1 trashed), 1 label, 1 image, 1 pinned, 1 coloured, 1 checklist note with 2 items of which 1 completed, 1 label link — and the image byte-identical at 70 bytes. |
| **Import — add as copies** | Re-importing a conflicting file duplicated every note; nothing overwritten. |
| **Import — replace existing** | Same file, replace strategy: a confirmation step appears first (*"Overwrite existing notes? … This cannot be undone."*), then the collection stayed the same size instead of growing — matching IDs overwritten in place. |
| **Upgrade, same key** | A `versionCode 2` / `1.0.1` build installed over `versionCode 1` with `adb install -r`. `firstInstallTime` unchanged, only `lastUpdateTime` moved: an in-place upgrade. |
| **Upgrade, data intact** | Exports taken before and after the upgrade are **identical apart from `exportedAt`** — same note ids, same `updatedAt` values, same image base64. Nothing was lost, and nothing was silently rewritten. |
| **Wrong key refused** | The same `versionCode 2` APK re-signed with a throwaway key: `INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.glacier.notes signatures do not match newer version`. This, not the row above, is what proves the signing identity gates upgrades. |
| **Airplane mode** | Cold start with airplane mode on: full note list, images, icons and fonts all render, no fallback glyphs, no network error in logcat. The release APK holds no `INTERNET` permission, so this confirms rather than tests. |
| **Backup posture** | `dumpsys backup` does not list `com.glacier.notes` as a backup participant. |
| **Themes and languages** | Dark and light both correct; English and German both complete. Switching to German also switches date formatting (`05.09.2026, 12:31`). Settings › About shows *"Glacier Notes for Android — Version 1.0.1"* from `App.getInfo()`, the Font Awesome CC BY 4.0 attribution, and the local-only disclosure — in both languages. |
| **Uninstall really removes everything** | After uninstall and reinstall the app returns to English defaults with an empty collection, which is the observable form of the claim in `RELEASE_NOTES.md`. |

## 7. Accepted residual risks

Extends `docs/hardening.md` §9; the `minifyEnabled false` entry there is resolved by
this milestone.

- **Emulator-only validation**, per §6.
- **Runtime language switching leaves stale accessibility names.** Switching language in Settings updates the visible text everywhere, but some Ionic controls keep the *previous* language in their accessibility name until the page is rebuilt — a cold start in German shows no English at all, while switching to German in a running app leaves `Open navigation menu` and `Delete trashed notes after` behind. The cause is the same one M15 documented from the other side: Ionic's `inheritAttributes` copies `aria-label` onto the inner native element once at component init and does not re-copy when the bound value changes, so the node that reaches the accessibility tree is stale. Visible text is unaffected, no data is involved, and it self-heals on navigation or restart. Not fixed here because the fix belongs in how the app feeds `aria-label` to Ionic controls generally, which is a change to every page rather than a release task.
- **`shrinkResources` is off**, per §5 — a deliberate size-for-safety trade.
- **v2-only signature block**, per §6 — sufficient at `minSdk 24`.
- **The `sqlcipher-android` and `security-crypto` graph is still linked in** although v1 uses neither, per `docs/hardening.md` §9. M16 adds one observation: it is also the *only* thing that made R8 fail, and the six `-dontwarn` rules exist solely to carry dependencies the app never calls.
