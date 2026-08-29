import { provideRouter } from '@angular/router';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { NotebooksStore } from '../notebooks/notebooks.store';
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
  async function render(notebookId?: string): Promise<ComponentFixture<NotesPage>> {
    const fixture = TestBed.createComponent(NotesPage);
    if (notebookId !== undefined) {
      fixture.componentRef.setInput('notebookId', notebookId);
      await TestBed.inject(NotebooksStore).load();
    }
    fixture.detectChanges();
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

  describe('filtered to one notebook', () => {
    it('shows only that notebook, under its name', async () => {
      const work = await repositories.notebooks.create('Work');
      await repositories.notes.create({
        notebookId: repositories.defaultNotebookId,
        type: 'text',
        title: 'Groceries',
      });
      await repositories.notes.create({ notebookId: work.id, type: 'text', title: 'Standup' });

      const host: HTMLElement = (await render(work.id)).nativeElement;

      expect(host.querySelector('ion-title')?.textContent).toContain('Work');
      expect(host.querySelectorAll('app-note-card')).toHaveLength(1);
      expect(host.textContent).toContain('Standup');
      expect(host.textContent).not.toContain('Groceries');
    });

    it('uses the notebook empty state rather than the all-notes hint', async () => {
      const work = await repositories.notebooks.create('Work');

      const host: HTMLElement = (await render(work.id)).nativeElement;

      expect(host.querySelector('app-empty-state')?.textContent).toContain(
        'This notebook is empty',
      );
    });

    it('records the notebook as the last selected one', async () => {
      const work = await repositories.notebooks.create('Work');
      const settings = TestBed.inject(SettingsStore);

      await render(work.id);

      expect(settings.lastSelectedNotebookId()).toBe(work.id);
    });
  });

  it('writes the layout toggle through to the settings store', async () => {
    const settings = TestBed.inject(SettingsStore);
    await repositories.notes.create({ notebookId: repositories.defaultNotebookId, type: 'text' });
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    // Queried by position: once Ionic hydrates an `ion-button` it moves the
    // aria-* attributes off the host onto its inner native button, so an
    // `[aria-label=...]` selector only matches before hydration.
    const toggle = host.querySelector<HTMLElement>('ion-buttons[slot="end"] ion-button');

    expect(settings.noteLayout()).toBe('list');

    toggle?.click();
    fixture.detectChanges();

    expect(settings.noteLayout()).toBe('grid');
    expect(host.querySelector('.notes')?.classList).toContain('notes--grid');
  });
});
