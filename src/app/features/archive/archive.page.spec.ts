import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { LabelsStore } from '../labels/labels.store';
import { NotePrompts } from '../notes/note-prompts';
import { NotesStore } from '../notes/notes.store';
import { ArchivePage } from './archive.page';

describe('ArchivePage', () => {
  let repositories: TestRepositories;
  const prompts = { actions: vi.fn() };

  beforeEach(async () => {
    prompts.actions.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
        { provide: NotePrompts, useValue: prompts },
      ],
    });
    repositories = await createTestRepositories();
    await TestBed.inject(LabelsStore).load();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  /**
   * The view is selected on entry rather than in the constructor, so the spec
   * enters too; awaiting a second load is the deterministic way to reach a
   * settled fixture.
   */
  async function render(): Promise<ComponentFixture<ArchivePage>> {
    const fixture = TestBed.createComponent(ArchivePage);
    fixture.componentInstance.ionViewWillEnter();
    await TestBed.inject(NotesStore).load();
    fixture.detectChanges();
    return fixture;
  }

  async function archived(title: string): Promise<string> {
    const note = await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      title,
    });
    await repositories.notes.setArchived(note.id, true);
    return note.id;
  }

  it('shows the empty state when nothing is archived', async () => {
    await repositories.notes.create({ notebookId: repositories.defaultNotebookId, type: 'text' });

    const host: HTMLElement = (await render()).nativeElement;

    expect(host.querySelector('app-empty-state')?.textContent).toContain(
      'Archived notes appear here',
    );
    expect(host.querySelectorAll('app-note-card')).toHaveLength(0);
  });

  it('lists archived notes only, keeping the pinned grouping', async () => {
    await archived('Filed');
    const sticky = await archived('Sticky');
    await repositories.notes.setPinned(sticky, true);
    await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      title: 'Active',
    });

    const host: HTMLElement = (await render()).nativeElement;

    expect(host.querySelectorAll('app-note-card')).toHaveLength(2);
    expect(host.textContent).not.toContain('Active');
    expect(
      [...host.querySelectorAll('.notes__heading')].map((el) => el.textContent?.trim()),
    ).toEqual(['Pinned', 'Others']);
  });

  it('offers the archived action set for a card', async () => {
    const id = await archived('Filed');
    const fixture = await render();

    fixture.componentInstance.showActions(await repositories.notes.get(id));

    expect(prompts.actions).toHaveBeenCalledWith(expect.objectContaining({ id }), 'archived');
  });
});
