import { DOCUMENT, Injectable, type Signal, computed, effect, inject, signal } from '@angular/core';

import { PREFERENCES_ADAPTER } from './preferences-adapter';
import {
  type LanguageCode,
  type NoteLayout,
  type NoteSortOrder,
  type Settings,
  type ThemeMode,
  defaultSettings,
  sanitizeSettings,
} from './settings.model';

export const SETTINGS_STORAGE_KEY = 'settings';

/**
 * The single source of truth for the app's lightweight configuration. Note
 * records never live here -- snapshot() below enumerates the persisted fields
 * by name, so nothing can leak into preferences by accident.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly adapter = inject(PREFERENCES_ADAPTER);
  private readonly document = inject(DOCUMENT);

  private readonly state = signal<Settings>(defaultSettings(this.deviceLocale()));
  private readonly isLoaded = signal(false);

  readonly loaded: Signal<boolean> = this.isLoaded.asReadonly();

  readonly themeMode: Signal<ThemeMode> = this.field((s) => s.themeMode);
  readonly language: Signal<LanguageCode> = this.field((s) => s.language);
  readonly noteLayout: Signal<NoteLayout> = this.field((s) => s.noteLayout);
  readonly sortOrder: Signal<NoteSortOrder> = this.field((s) => s.sortOrder);
  readonly lastSelectedNotebookId: Signal<string | null> = this.field(
    (s) => s.lastSelectedNotebookId,
  );
  readonly trashAutoPurgeDays: Signal<number> = this.field((s) => s.trashAutoPurgeDays);
  readonly moveCheckedToBottom: Signal<boolean> = this.field((s) => s.moveCheckedToBottom);

  constructor() {
    effect(() => {
      // Read before the guard: returning early would leave the effect tracking
      // only isLoaded, so later setters would never persist.
      const value = JSON.stringify(this.snapshot());
      // Writing before init() lands would persist the defaults over whatever is
      // already stored.
      if (!this.isLoaded()) {
        return;
      }
      void this.adapter.set(SETTINGS_STORAGE_KEY, value);
    });
  }

  /** Runs as an app initializer, so the first render already has real values. */
  async init(): Promise<void> {
    const stored = await this.adapter.get(SETTINGS_STORAGE_KEY);
    if (stored !== null) {
      this.state.set(sanitizeSettings(parse(stored), this.deviceLocale()));
    }
    this.isLoaded.set(true);
  }

  setThemeMode(themeMode: ThemeMode): void {
    this.state.update((s) => ({ ...s, themeMode }));
  }

  setLanguage(language: LanguageCode): void {
    this.state.update((s) => ({ ...s, language }));
  }

  setNoteLayout(noteLayout: NoteLayout): void {
    this.state.update((s) => ({ ...s, noteLayout }));
  }

  setSortOrder(sortOrder: NoteSortOrder): void {
    this.state.update((s) => ({ ...s, sortOrder }));
  }

  setLastSelectedNotebookId(lastSelectedNotebookId: string | null): void {
    this.state.update((s) => ({ ...s, lastSelectedNotebookId }));
  }

  setTrashAutoPurgeDays(trashAutoPurgeDays: number): void {
    this.state.update((s) => ({ ...s, trashAutoPurgeDays }));
  }

  setMoveCheckedToBottom(moveCheckedToBottom: boolean): void {
    this.state.update((s) => ({ ...s, moveCheckedToBottom }));
  }

  snapshot(): Settings {
    const state = this.state();
    return {
      themeMode: state.themeMode,
      language: state.language,
      noteLayout: state.noteLayout,
      sortOrder: state.sortOrder,
      lastSelectedNotebookId: state.lastSelectedNotebookId,
      trashAutoPurgeDays: state.trashAutoPurgeDays,
      moveCheckedToBottom: state.moveCheckedToBottom,
    };
  }

  /**
   * Only consulted when nothing is stored. Once resolved the choice is
   * persisted, so changing the device locale later does not move the app --
   * this is the desktop's behaviour.
   */
  private deviceLocale(): string {
    return this.document.defaultView?.navigator.language ?? 'en';
  }

  private field<T>(select: (settings: Settings) => T): Signal<T> {
    return computed(() => select(this.state()));
  }
}

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
