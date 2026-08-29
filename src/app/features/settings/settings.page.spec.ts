import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { NotebooksStore } from '../notebooks/notebooks.store';
import { SettingsPage } from './settings.page';

function segmentLabels(host: HTMLElement, index: number): (string | undefined)[] {
  const segment = host.querySelectorAll('ion-segment')[index];
  return [...segment.querySelectorAll('ion-label')].map((el) => el.textContent?.trim());
}

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let repositories: TestRepositories;
  let notebooks: NotebooksStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    }).compileComponents();
    repositories = await createTestRepositories();
    notebooks = TestBed.inject(NotebooksStore);
    await notebooks.load();

    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
  });

  afterEach(async () => {
    await repositories.adapter.close();
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

  it('lists the notebooks a new note could default into', () => {
    const host: HTMLElement = fixture.nativeElement;
    const options = [...host.querySelectorAll('ion-select-option')].map((el) =>
      el.textContent?.trim(),
    );

    expect(options).toEqual(['Notes']);
    expect(host.querySelector<HTMLElement & { value: string }>('ion-select')?.value).toBe(
      repositories.defaultNotebookId,
    );
  });

  it('writes a new default notebook to app_state rather than to settings', async () => {
    const work = await notebooks.create('Work');
    fixture.detectChanges();

    fixture.componentInstance.onDefaultNotebookChange(
      new CustomEvent('ionChange', { detail: { value: work.id } }),
    );
    await Promise.resolve();

    expect(await repositories.notebooks.getDefaultId()).toBe(work.id);
    expect(TestBed.inject(SettingsStore).snapshot()).not.toHaveProperty('defaultNotebookId');
  });

  it('states that settings never leave the device', () => {
    const host: HTMLElement = fixture.nativeElement;

    expect(host.textContent).toContain('.glacier.json');
  });
});
