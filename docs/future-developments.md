# Potential future developments

Ideas that have been analysed but **not** decided, and that all sit outside the
fixed v1 constraints. Nothing here is scheduled, and nothing here may be started
without an explicit spec amendment — see "Constraint status" in each section.

This is a parking area, not a plan. A section only earns a milestone once the
constraint it violates has been reopened deliberately.

## 1. Biometrics

Analysed 2026-09-04. Not decided.

### 1.1 What is actually present today

We do **not** have a biometrics feature. We have the library on the classpath and
nothing else.

`@capacitor-community/sqlite` declares three dependencies unconditionally
(`node_modules/@capacitor-community/sqlite/android/build.gradle:58-69`):

- `androidx.biometric:biometric:1.1.0`
- `net.zetetic:sqlcipher-android:4.17.0`
- `androidx.security:security-crypto:1.1.0-alpha06`

They ship in the APK whether or not any of it is called. Nothing in `src/`
calls any of it: `CapacitorSqliteAdapter` opens
`createConnection(db, false, 'no-encryption', 1, false)`
(`src/app/core/database/capacitor-sqlite.adapter.ts:41`) — encryption off, mode
`no-encryption`.

M15 removed the two permissions `androidx.biometric` merged into the manifest,
with `tools:node="remove"` markers
(`android/app/src/main/AndroidManifest.xml:56-57`, rationale in
`docs/hardening.md` §1). The unused SQLCipher AAR is recorded there as an
accepted residual risk (§9). Re-enabling any of the below reverses an M15
deliverable and puts `USE_BIOMETRIC` back in the release manifest.

### 1.2 The plugin's own hook is not an app lock

In `CapacitorSQLite.java:81-130` the `androidBiometric.biometricAuth` option is
read *only* when `isEncryption` is true, and it gates exactly one thing: the
retrieval of the **SQLCipher passphrase** from the encrypted shared preferences.

So "just switch on what we already have" is not a lock screen. It is a decision
to encrypt the database.

### 1.3 Candidate features

| # | Feature | What it protects against | What it does not | Cost |
| --- | --- | --- | --- | --- |
| 1 | **App lock** — prompt on launch and on resume before the UI renders | Someone holding your already-unlocked phone | Anything at rest; a pulled `.db` file is still readable | Needs a separate plugin or a small native bridge in the shape of `android/app/src/main/java/com/glacier/notes/DocumentsPlugin.java`. No crypto, no migration. |
| 2 | **Encrypted database**, passphrase behind the biometric prompt | Offline extraction of the database file (rooted device, `adb` backup, physical access) | Image bytes in `files/images/`, which stay plain files; exports, which are plaintext by design | `isEncryption: true` + `androidBiometric` in `capacitor.config.ts`, plus a migration of every existing install. Carries the data-loss risk in §1.4. |
| 3 | **Gate on sensitive actions** — export, share, empty trash, replace-by-ID import | An unencrypted backup leaving the device unnoticed; destructive taps | Reading notes at all | Same bridge as #1, no crypto, smallest blast radius. |
| 4 | **Per-note "locked" notes** | Shoulder-surfing a single note while the app is open | The database file, unless combined with #2 | Cuts across `notes.search_text`, card previews, the note list and export — the widest change of the four. |

### 1.4 Deciding factors

**The encrypted-database path carries a real data-loss risk.** The plugin builds
its master key with `setUserAuthenticationRequired(true, VALIDITY_DURATION)`
(`CapacitorSQLite.java:95-97`, with `VALIDITY_DURATION = 5`). Android invalidates
AndroidKeyStore keys created that way when biometric enrollment changes — adding
a fingerprint can make the stored passphrase undecryptable. With no cloud sync
and `.glacier.json` as the only backup mechanism, that means losing every note on
a device whose owner did nothing wrong.

**And its guarantee is device-dependent.** When no biometric is enrolled the same
code falls back to an *unauthenticated* master key (`:119-122`), so on some
devices the passphrase is protected by hardware-bound user auth and on others it
is not, with no visible difference in the app.

**Encryption would be partial either way.** Image bytes live as plain files under
`files/images/` (`docs/images.md`), and every export is plaintext `.glacier.json`
because the desktop has to read it (`docs/import-export.md`). Encrypting only the
database buys less than it appears to.

**An app lock is the honest fit.** It matches what biometrics actually delivers —
"prove it is you, on this device, right now" — and needs no crypto, no migration
and no risk to existing notes. Its costs are bounded and known: `USE_BIOMETRIC`
returns to the release manifest, and lock-on-resume has to be reconciled with the
editor's flush-on-background so a pending autosave is not stranded behind a
prompt.

### 1.5 Notes from reading the plugin source

- `UtilsBiometric.checkBiometricIsAvailable()` authenticates with
  `BIOMETRIC_STRONG | DEVICE_CREDENTIAL`, so the device PIN is an accepted
  fallback. Good for accessibility — a user who cannot use a fingerprint sensor
  is not locked out.
- The same class emits **Toasts** and logs under the tag `"MY_APP_TAG"` on every
  branch. Anything built on it would need those silenced to stay inside
  "never log note content" and to not look unfinished.
- `USE_FINGERPRINT` has been deprecated since API 28; only `USE_BIOMETRIC` would
  be needed.

### 1.6 Constraint status

Every option above reopens a settled decision:

- `GLACIER_NOTES_ANDROID_SPECIFICATION.md:38` and `:1354`, and §19.1 at `:1053`
- `GLACIER_NOTES_ANDROID_MILESTONES.md` §2, item 7
- `CLAUDE.md`, "Fixed v1 constraints": *"No PIN, biometrics, SQLCipher, or export
  encryption."*

All four name biometrics explicitly as excluded. This is a v2 conversation with a
specification amendment, not an addition to M16.

### 1.7 Recommendation if pursued

App lock (#1), possibly with the sensitive-action gate (#3). No database
encryption.
