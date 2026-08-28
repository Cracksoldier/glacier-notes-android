import { provideRouter } from '@angular/router';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { NotesPage } from './notes.page';
import { NotesStore } from './notes.store';

describe('NotesPage', () => {
  let repositories: TestRepositories;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
      ],
    });
    repositories = await createTestRepositories();
  });

  afterEach(async () => {
    await repositories.adapter.close();
  });

  /**
   * The page loads in its constructor, so the fixture is only meaningful once
   * that read has settled; awaiting a second load is the deterministic way to
   * get there.
   */
  async function render(): Promise<ComponentFixture<NotesPage>> {
    const fixture = TestBed.createComponent(NotesPage);
    await TestBed.inject(NotesStore).load();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state when there are no notes', async () => {
    const host: HTMLElement = (await render()).nativeElement;

    expect(host.querySelector('app-empty-state')?.textContent).toContain('No notes yet');
    expect(host.querySelectorAll('app-note-card')).toHaveLength(0);
  });

  it('renders a card per note, titles included', async () => {
    await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      title: 'Groceries',
    });

    const host: HTMLElement = (await render()).nativeElement;

    expect(host.querySelector('app-empty-state')).toBeNull();
    expect(host.querySelectorAll('app-note-card')).toHaveLength(1);
    expect(host.textContent).toContain('Groceries');
  });

  it('puts pinned notes in their own section above the others', async () => {
    const sticky = await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      title: 'Sticky',
    });
    await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      title: 'Plain',
    });
    await repositories.notes.setPinned(sticky.id, true);

    const host: HTMLElement = (await render()).nativeElement;

    const headings = [...host.querySelectorAll('.notes__heading')].map((el) =>
      el.textContent?.trim(),
    );
    expect(headings).toEqual(['Pinned', 'Others']);

    const columns = host.querySelectorAll('.notes__column');
    expect(columns[0]?.textContent).toContain('Sticky');
    expect(columns[1]?.textContent).toContain('Plain');
  });

  it('omits both headings when nothing is pinned', async () => {
    await repositories.notes.create({ notebookId: repositories.defaultNotebookId, type: 'text' });

    const host: HTMLElement = (await render()).nativeElement;

    expect(host.querySelectorAll('.notes__heading')).toHaveLength(0);
  });

  it('writes the layout toggle through to the settings store', async () => {
    const settings = TestBed.inject(SettingsStore);
    await repositories.notes.create({ notebookId: repositories.defaultNotebookId, type: 'text' });
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    const toggle = host.querySelector<HTMLElement>('ion-button[aria-label="Note layout"]');

    expect(settings.noteLayout()).toBe('list');

    toggle?.click();
    fixture.detectChanges();

    expect(settings.noteLayout()).toBe('grid');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.notes')?.classList).toContain('notes--grid');
  });
});
