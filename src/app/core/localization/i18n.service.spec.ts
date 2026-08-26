import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryPreferencesAdapter } from '../preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../preferences/preferences-adapter';
import { SettingsStore } from '../preferences/settings.store';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    });
  });

  it('translates through the language the settings store holds', () => {
    const i18n = TestBed.inject(I18nService);
    const settings = TestBed.inject(SettingsStore);

    expect(i18n.t('sidebar.trash')).toBe('Trash');

    settings.setLanguage('de');

    expect(i18n.t('sidebar.trash')).toBe('Papierkorb');
  });

  it('substitutes named parameters', () => {
    const i18n = TestBed.inject(I18nService);

    expect(i18n.t('settings.dateSample', { date: '26 Aug 2026' })).toContain('26 Aug 2026');
  });

  it('formats dates for the selected locale', () => {
    const i18n = TestBed.inject(I18nService);
    const settings = TestBed.inject(SettingsStore);
    const iso = '2026-03-05T14:30:00.000Z';

    const english = i18n.formatDate(iso);
    settings.setLanguage('de');
    const german = i18n.formatDate(iso);

    expect(english).not.toBe(german);
    expect(german).toContain('2026');
  });

  it('reflects the language on the document element', () => {
    TestBed.inject(I18nService);
    const settings = TestBed.inject(SettingsStore);
    TestBed.tick();

    expect(document.documentElement.lang).toBe('en');

    settings.setLanguage('de');
    TestBed.tick();

    expect(document.documentElement.lang).toBe('de');
  });
});
