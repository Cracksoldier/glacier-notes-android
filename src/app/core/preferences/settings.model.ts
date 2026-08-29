export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';
export type LanguageCode = 'en' | 'de';
export type NoteLayout = 'list' | 'grid';
// The desktop orders notes by updatedAt descending and offers no alternative
// (electron/storage/note-repo.ts). M11 defines the desktop-compatible set.
export type NoteSortOrder = 'updatedDesc';

export interface Settings {
  themeMode: ThemeMode;
  language: LanguageCode;
  noteLayout: NoteLayout;
  sortOrder: NoteSortOrder;
  lastSelectedNotebookId: string | null;
  /** Days a note may sit in the trash before startup purges it; 0 disables. */
  trashAutoPurgeDays: number;
}

/** Ten years. Anything larger is indistinguishable from "never" but harder to reason about. */
const MAX_TRASH_AUTO_PURGE_DAYS = 3650;

const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'system'];
const LANGUAGES: readonly LanguageCode[] = ['en', 'de'];
const NOTE_LAYOUTS: readonly NoteLayout[] = ['list', 'grid'];
const NOTE_SORT_ORDERS: readonly NoteSortOrder[] = ['updatedDesc'];

/** Mirrors the desktop's defaultSettings (electron/storage/models.ts). */
export function defaultSettings(deviceLocale: string): Settings {
  return {
    themeMode: 'dark',
    language: deviceLocale.toLowerCase().startsWith('de') ? 'de' : 'en',
    noteLayout: 'list',
    sortOrder: 'updatedDesc',
    lastSelectedNotebookId: null,
    trashAutoPurgeDays: 30,
  };
}

/**
 * Preferences are writable from outside the app (adb), so stored JSON is
 * untrusted: every field is validated individually and bad ones fall back to
 * their default rather than discarding the whole record.
 */
export function sanitizeSettings(raw: unknown, deviceLocale: string): Settings {
  const defaults = defaultSettings(deviceLocale);
  if (typeof raw !== 'object' || raw === null) {
    return defaults;
  }
  const record = raw as Record<string, unknown>;
  const notebookId = record['lastSelectedNotebookId'];

  return {
    themeMode: pick(record['themeMode'], THEME_MODES, defaults.themeMode),
    language: pick(record['language'], LANGUAGES, defaults.language),
    noteLayout: pick(record['noteLayout'], NOTE_LAYOUTS, defaults.noteLayout),
    sortOrder: pick(record['sortOrder'], NOTE_SORT_ORDERS, defaults.sortOrder),
    lastSelectedNotebookId: typeof notebookId === 'string' ? notebookId : null,
    trashAutoPurgeDays: pickDays(record['trashAutoPurgeDays'], defaults.trashAutoPurgeDays),
  };
}

/**
 * A bad value here would delete notes, so it is rejected rather than coerced:
 * `Number('7 ')` is 7, but a string in this field means the record was not
 * written by this app.
 */
function pickDays(value: unknown, fallback: number): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_TRASH_AUTO_PURGE_DAYS
    ? value
    : fallback;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
