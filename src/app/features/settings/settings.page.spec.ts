import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '../../core/database/database.service';
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

function selectOptions(host: HTMLElement, index: number): (string | undefined)[] {
  const select = host.querySelectorAll('ion-select')[index];
  return [...select.querySelectorAll('ion-select-option')].map((el) => el.textContent?.trim());
}

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let repositories: TestRepositories;
  let notebooks: NotebooksStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideRouter([]),
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
      ],
    }).compileComponents();
    repositories = await createTestRepositories();
    notebooks = TestBed.inject(NotebooksStore);
    await notebooks.load();

    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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

    expect(selectOptions(host, 0)).toEqual(['Notes']);
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

  it('offers the desktop default plus an off switch for the trash purge window', () => {
    const host: HTMLElement = fixture.nativeElement;

    expect(selectOptions(host, 2)).toEqual([
      'Never',
      '7 days',
      '14 days',
      '30 days',
      '60 days',
      '90 days',
    ]);
    expect(TestBed.inject(SettingsStore).trashAutoPurgeDays()).toBe(30);
  });

  it('writes a chosen purge window to settings', () => {
    fixture.componentInstance.onTrashAutoPurgeChange(
      new CustomEvent('ionChange', { detail: { value: 0 } }),
    );

    expect(TestBed.inject(SettingsStore).trashAutoPurgeDays()).toBe(0);
  });

  it('states that settings never leave the device', () => {
    const host: HTMLElement = fixture.nativeElement;

    expect(host.textContent).toContain('.glacier.json');
  });

  it('offers the three sort orders and starts on the desktop default', () => {
    const host: HTMLElement = fixture.nativeElement;

    expect(selectOptions(host, 1)).toEqual(['Last edited', 'Date created', 'Title']);
    expect(TestBed.inject(SettingsStore).sortOrder()).toBe('updatedDesc');
  });

  it('writes a chosen sort order to settings', () => {
    fixture.componentInstance.onSortOrderChange(
      new CustomEvent('ionChange', { detail: { value: 'titleAsc' } }),
    );

    expect(TestBed.inject(SettingsStore).sortOrder()).toBe('titleAsc');
  });

  // The Font Awesome CC BY 4.0 licence requires the credit to be in the app, not
  // only in the repository (docs/design-system.md).
  it('carries the icon attribution', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Font Awesome Free, licensed CC BY 4.0',
    );
  });

  describe('the database diagnostic', () => {
    it('is absent while the database is fine', () => {
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Diagnostics');
    });

    // Every list page shows the same generic message, so this is the only place
    // the engine's own words reach the user.
    it('names the failure when the database could not be opened', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(repositories.adapter, 'open').mockRejectedValue(new Error('file is not a database'));

      await TestBed.inject(DatabaseService).init();
      fixture.detectChanges();

      const host: HTMLElement = fixture.nativeElement;
      expect(host.textContent).toContain('Diagnostics');
      expect(host.textContent).toContain('file is not a database');
    });
  });
});
