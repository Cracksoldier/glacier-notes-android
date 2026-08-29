import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryPreferencesAdapter } from './memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from './preferences-adapter';
import { SETTINGS_STORAGE_KEY, SettingsStore } from './settings.store';

function configure(stored?: string): MemoryPreferencesAdapter {
  const adapter = new MemoryPreferencesAdapter(
    stored === undefined ? {} : { [SETTINGS_STORAGE_KEY]: stored },
  );
  TestBed.configureTestingModule({
    providers: [{ provide: PREFERENCES_ADAPTER, useValue: adapter }],
  });
  return adapter;
}

async function persisted(adapter: MemoryPreferencesAdapter): Promise<Record<string, unknown>> {
  const raw = await adapter.get(SETTINGS_STORAGE_KEY);
  return JSON.parse(raw ?? '{}');
}

describe('SettingsStore', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts on the desktop defaults', () => {
    configure();
    const store = TestBed.inject(SettingsStore);

    expect(store.loaded()).toBe(false);
    expect(store.themeMode()).toBe('dark');
    expect(store.language()).toBe('en');
    expect(store.noteLayout()).toBe('list');
    expect(store.sortOrder()).toBe('updatedDesc');
    expect(store.lastSelectedNotebookId()).toBeNull();
  });

  it('resolves the device language on first launch', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-AT');
    configure();
    const store = TestBed.inject(SettingsStore);
    await store.init();

    expect(store.language()).toBe('de');
  });

  it('reads stored settings back', async () => {
    configure(JSON.stringify({ themeMode: 'light', language: 'de', noteLayout: 'grid' }));
    const store = TestBed.inject(SettingsStore);
    await store.init();

    expect(store.themeMode()).toBe('light');
    expect(store.language()).toBe('de');
    expect(store.noteLayout()).toBe('grid');
  });

  it('falls back to defaults for unparsable or invalid stored values', async () => {
    configure('not json at all');
    const store = TestBed.inject(SettingsStore);
    await store.init();

    expect(store.themeMode()).toBe('dark');

    TestBed.resetTestingModule();
    configure(JSON.stringify({ themeMode: 'neon', language: 42 }));
    const second = TestBed.inject(SettingsStore);
    await second.init();

    expect(second.themeMode()).toBe('dark');
    expect(second.language()).toBe('en');
  });

  it('leaves stored values alone until init has run', async () => {
    const adapter = configure(JSON.stringify({ themeMode: 'light' }));
    TestBed.inject(SettingsStore);
    TestBed.tick();

    expect(await persisted(adapter)).toEqual({ themeMode: 'light' });
  });

  it('persists a changed setting', async () => {
    const adapter = configure();
    const store = TestBed.inject(SettingsStore);
    await store.init();

    store.setLanguage('de');
    TestBed.tick();

    expect((await persisted(adapter))['language']).toBe('de');
  });

  it('writes only lightweight configuration, never note data', async () => {
    const adapter = configure();
    const store = TestBed.inject(SettingsStore);
    await store.init();

    store.setThemeMode('light');
    store.setLastSelectedNotebookId('cf5b0f4a-6a5f-4f4e-9d3e-6a2b0d1f9c77');
    TestBed.tick();

    expect(Object.keys(await persisted(adapter)).sort()).toEqual([
      'language',
      'lastSelectedNotebookId',
      'noteLayout',
      'sortOrder',
      'themeMode',
      'trashAutoPurgeDays',
    ]);
  });

  /**
   * `snapshot()` enumerates fields by name, so a new setting that is not listed
   * there reads back fine in the session that set it and silently reverts on the
   * next launch. This is the only check that would catch that.
   */
  it('round-trips the trash auto-purge window', async () => {
    const adapter = configure();
    const store = TestBed.inject(SettingsStore);
    await store.init();

    store.setTrashAutoPurgeDays(7);
    TestBed.tick();

    expect((await persisted(adapter))['trashAutoPurgeDays']).toBe(7);
  });

  it('falls back to the default for a window that is not a whole number of days', async () => {
    for (const value of [-1, 1.5, 4000, 'soon', null]) {
      configure(JSON.stringify({ trashAutoPurgeDays: value }));
      const store = TestBed.inject(SettingsStore);
      await store.init();

      expect(store.trashAutoPurgeDays()).toBe(30);
      TestBed.resetTestingModule();
    }
  });
});
