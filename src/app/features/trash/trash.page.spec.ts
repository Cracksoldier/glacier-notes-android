import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { LabelsStore } from '../labels/labels.store';
import { NotePrompts } from '../notes/note-prompts';
import { NotesStore } from '../notes/notes.store';
import { TrashPage } from './trash.page';

describe('TrashPage', () => {
  let repositories: TestRepositories;
  const prompts = { actions: vi.fn(), confirmEmptyTrash: vi.fn() };

  beforeEach(async () => {
    for (const spy of Object.values(prompts)) {
      spy.mockReset().mockResolvedValue(undefined);
    }
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

  /** See `ArchivePage`'s spec: the view is selected on entry, so the spec enters. */
  async function render(): Promise<ComponentFixture<TrashPage>> {
    const fixture = TestBed.createComponent(TrashPage);
    fixture.componentInstance.ionViewWillEnter();
    await TestBed.inject(NotesStore).load();
    fixture.detectChanges();
    return fixture;
  }

  async function trashed(title: string): Promise<string> {
    const note = await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      title,
    });
    await repositories.notes.trash(note.id);
    return note.id;
  }

  it('shows the empty state, and no empty-trash button, when the trash is empty', async () => {
    await repositories.notes.create({ notebookId: repositories.defaultNotebookId, type: 'text' });

    const host: HTMLElement = (await render()).nativeElement;

    expect(host.querySelector('app-empty-state')?.textContent).toContain(
      'Deleted notes appear here',
    );
    expect(host.querySelector('ion-buttons[slot="end"]')).toBeNull();
  });

  // The trash is ordered by `deleted_at DESC`, which a Pinned heading would
  // contradict, so the grouping the other lists use is switched off here.
  it('lists trashed notes flat, without the pinned grouping', async () => {
    const sticky = await trashed('Sticky');
    await repositories.notes.setPinned(sticky, true);
    await trashed('Plain');
    await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      title: 'Active',
    });

    const host: HTMLElement = (await render()).nativeElement;

    expect(host.querySelectorAll('app-note-card')).toHaveLength(2);
    expect(host.querySelectorAll('.notes__heading')).toHaveLength(0);
    expect(host.textContent).not.toContain('Active');
  });

  it('states the purge window, and says nothing when it is disabled', async () => {
    await trashed('Filed');
    const settings = TestBed.inject(SettingsStore);

    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.trash__notice')?.textContent).toContain('after 30 days');

    settings.setTrashAutoPurgeDays(0);
    fixture.detectChanges();

    expect(host.querySelector('.trash__notice')).toBeNull();
  });

  it('offers the trashed action set for a card', async () => {
    const id = await trashed('Filed');
    const fixture = await render();

    fixture.componentInstance.showActions(await repositories.notes.get(id));

    expect(prompts.actions).toHaveBeenCalledWith(expect.objectContaining({ id }), 'trashed');
  });

  it('asks before emptying the trash, telling the confirmation how much is at stake', async () => {
    await trashed('One');
    await trashed('Two');
    const fixture = await render();

    fixture.componentInstance.emptyTrash();

    expect(prompts.confirmEmptyTrash).toHaveBeenCalledWith(2);
  });
});
