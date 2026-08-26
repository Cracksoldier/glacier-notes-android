import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
import { SettingsPage } from './settings.page';

function segmentLabels(host: HTMLElement, index: number): (string | undefined)[] {
  const segment = host.querySelectorAll('ion-segment')[index];
  return [...segment.querySelectorAll('ion-label')].map((el) => el.textContent?.trim());
}

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
  });

  it('offers the three theme modes and the two languages', () => {
    const host: HTMLElement = fixture.nativeElement;

    expect(segmentLabels(host, 0)).toEqual(['Dark', 'Light', 'System']);
    expect(segmentLabels(host, 1)).toEqual(['English', 'Deutsch']);
  });

  it('translates its own labels when the language changes', () => {
    const host: HTMLElement = fixture.nativeElement;

    TestBed.inject(SettingsStore).setLanguage('de');
    fixture.detectChanges();

    expect(host.querySelector('ion-title')?.textContent).toContain('Einstellungen');
    expect(segmentLabels(host, 0)).toEqual(['Dunkel', 'Hell', 'System']);
  });

  it('states that settings never leave the device', () => {
    const host: HTMLElement = fixture.nativeElement;

    expect(host.textContent).toContain('.glacier.json');
  });
});
