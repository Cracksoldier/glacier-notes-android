# Settings and localization (M03)

How the app stores its configuration and how it speaks English and German.
`docs/desktop-audit.md` §4 holds the desktop values these are derived from.

## Localization

The desktop's own `I18nService` (`src/app/core/i18n/i18n.service.ts`) is ported
verbatim into `src/app/core/localization/`. It is a `computed` over
`SettingsStore.language()` that picks the `de` or `en` constant map, plus `t()`
with `{name}` placeholder substitution and `formatDate()` via `Intl`.

`@angular/localize` was ruled out because it needs one build per locale, so the
language could not change without a restart. `@ngx-translate/core` was ruled out
because it adds a dependency and an async loader while giving up the
compile-time key checking that `TranslationKey` provides under `strictTemplates`.

Templates call the service directly — `{{ i18n.t('sidebar.trash') }}` — rather
than going through a pipe. A pure pipe memoizes on input identity and would
never re-evaluate when the language changes under `OnPush`; an impure one would
re-run every change-detection pass. Reading `table()` inside the template's
reactive consumer marks the view dirty exactly when the language changes.

### Where the strings come from

`en.ts` reuses the desktop's key names and wording wherever an equivalent
exists, so the two apps stay in step and the German is ported rather than
authored. Keys under `placeholder.*` and `a11y.*`, plus `sidebar.notes`,
`sidebar.allNotes/allNotebooks/allLabels`, `settings.appearance` and
`settings.themeSystem`, have **no desktop counterpart** — the desktop is
pointer-driven and reaches those destinations differently. Their German is
authored here.

`de.ts` is typed `Record<TranslationKey, string>`, so a missing key fails the
build; `translations.spec.ts` covers the case that typing misses — a duplicated
literal key, which silently drops the earlier entry.

## Settings

`src/app/core/preferences/settings.model.ts` defines the stored shape:

| Field | Values | Default | Provenance |
| --- | --- | --- | --- |
| `themeMode` | `dark \| light \| system` | `dark` | desktop `theme`, widened by `system` for Android |
| `language` | `en \| de` | device locale | desktop `language` |
| `noteLayout` | `list \| grid` | `list` | Android-only; spec §18. The desktop is masonry-only. |
| `sortOrder` | `updatedDesc` | `updatedDesc` | the desktop's single order; M11 widens the union |
| `lastSelectedNotebookId` | UUID or `null` | `null` | desktop `lastSelectedNotebookId` |

Deliberately absent: `closeToTray` and `quickNoteShortcut` are desktop-only;
`trashAutoPurgeDays` and `moveCheckedToBottom` are real desktop settings but
belong with the features that read them (M08, M09).

Device language is read once from `navigator.language` and only when nothing is
stored. The resolved choice is then persisted, so changing the device locale
later does not move the app — this is the desktop's behaviour.

## Storage

One key, `settings`, holding one JSON object: a single bridge round-trip at
startup, written atomically, versionable later. `SettingsStore.snapshot()`
enumerates the persisted fields by name rather than spreading state, so the key
set is a whitelist by construction — that is what keeps note data out of
preferences, and `settings.store.spec.ts` asserts it.

Stored JSON is untrusted (preferences are writable via `adb`), so
`sanitizeSettings` validates each field independently and falls back per-field
rather than discarding the whole record.

`PREFERENCES_ADAPTER` is an injection token so specs can substitute
`MemoryPreferencesAdapter`; jsdom's `localStorage` leaks between spec files in a
worker. On the dev server no substitute is needed: the Capacitor plugin's own
web implementation persists to `localStorage` under the `CapacitorStorage.`
prefix, so `npm start` behaves the same across reloads as the device does across
restarts.

`SettingsStore.init()` runs as a `provideAppInitializer`, so Angular holds the
first render until the stored values are in place and there is no flash of the
wrong theme or language. The persistence effect reads state *before* its
`loaded()` guard — returning early first would leave the effect tracking only
`loaded`, and later setters would never write.

`ThemeService` keeps everything M02 gave it — the body class, the
`prefers-color-scheme` watcher and the status-bar glyph logic described in
`docs/design-system.md` — but no longer owns the value: `mode` is now
`SettingsStore.themeMode` and the setters delegate.

## Local-only, never exported

Every field above lives only on this device. The desktop's export envelope
(`electron/transfer-core.ts`) carries notes, notebooks, labels and images —
**settings are not part of it** (`docs/desktop-audit.md` §4). Nothing here
travels in a `.glacier.json` file, in either direction, and the Settings screen
says so. Import must never write to these keys.
