import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetMediaQueries, setMediaQueryMatches } from '../../../test-setup';
import { MemoryPreferencesAdapter } from './memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from './preferences-adapter';
import { SETTINGS_STORAGE_KEY, SettingsStore } from './settings.store';
import { ThemeService } from './theme.service';

const PREFERS_DARK = '(prefers-color-scheme: dark)';

function provideStoredSettings(stored?: Record<string, unknown>): void {
  const seed: Record<string, string> = stored
    ? { [SETTINGS_STORAGE_KEY]: JSON.stringify(stored) }
    : {};
  TestBed.configureTestingModule({
    providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter(seed) }],
  });
}

function themeClasses(): string[] {
  return [...document.body.classList].filter((name) => name.startsWith('theme-'));
}

describe('ThemeService', () => {
  beforeEach(() => {
    resetMediaQueries();
    document.body.className = '';
    provideStoredSettings();
  });

  afterEach(() => {
    resetMediaQueries();
    document.body.className = '';
  });

  it('defaults to dark, matching desktop', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.mode()).toBe('dark');
    expect(service.resolved()).toBe('dark');
    expect(themeClasses()).toEqual(['theme-dark']);
  });

  it('applies exactly one theme class when the mode changes', () => {
    const service = TestBed.inject(ThemeService);

    service.setMode('light');
    TestBed.tick();

    expect(themeClasses()).toEqual(['theme-light']);
  });

  it('toggles between the two concrete themes', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();
    expect(service.mode()).toBe('light');

    service.toggle();
    expect(service.mode()).toBe('dark');
  });

  it('resolves system mode from prefers-color-scheme', () => {
    setMediaQueryMatches(PREFERS_DARK, false);
    const service = TestBed.inject(ThemeService);

    service.setMode('system');
    TestBed.tick();

    expect(service.resolved()).toBe('light');
    expect(themeClasses()).toEqual(['theme-light']);
  });

  it('follows later prefers-color-scheme changes while in system mode', () => {
    setMediaQueryMatches(PREFERS_DARK, false);
    const service = TestBed.inject(ThemeService);
    service.setMode('system');
    TestBed.tick();

    setMediaQueryMatches(PREFERS_DARK, true);
    TestBed.tick();

    expect(service.resolved()).toBe('dark');
    expect(themeClasses()).toEqual(['theme-dark']);
  });

  it('ignores the system preference when a concrete mode is chosen', () => {
    setMediaQueryMatches(PREFERS_DARK, true);
    const service = TestBed.inject(ThemeService);

    service.setMode('light');
    setMediaQueryMatches(PREFERS_DARK, true);
    TestBed.tick();

    expect(service.resolved()).toBe('light');
  });

  it('picks up the stored mode, so the choice survives a restart', async () => {
    TestBed.resetTestingModule();
    provideStoredSettings({ themeMode: 'light' });
    await TestBed.inject(SettingsStore).init();
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.mode()).toBe('light');
    expect(themeClasses()).toEqual(['theme-light']);
  });
});
