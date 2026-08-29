import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { NotesStore } from '../notes/notes.store';
import { NotebookPrompts } from './notebook-prompts';
import { NotebooksStore } from './notebooks.store';

/**
 * An Ionic overlay cannot be presented under jsdom, so the controller is
 * replaced by one that answers immediately. What is being tested is the wiring
 * between the overlay's answer and the store — the layer where the dismissal
 * payload shape and the note-list refresh live, neither of which the pure
 * `notebook-dispositions` spec can reach.
 */
class FakeAlertController {
  answer: { data?: unknown; role?: string } = { role: 'cancel' };

  create(): Promise<{ present: () => Promise<void>; onDidDismiss: () => Promise<unknown> }> {
    return Promise.resolve({
      present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve(this.answer),
    });
  }
}

describe('NotebookPrompts', () => {
  let repositories: TestRepositories;
  let alerts: FakeAlertController;
  let prompts: NotebookPrompts;
  let notebooks: NotebooksStore;
  let notes: NotesStore;

  beforeEach(async () => {
    alerts = new FakeAlertController();
    TestBed.configureTestingModule({
      providers: [
        { provide: AlertController, useValue: alerts },
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
      ],
    });
    repositories = await createTestRepositories();
    prompts = TestBed.inject(NotebookPrompts);
    notebooks = TestBed.inject(NotebooksStore);
    notes = TestBed.inject(NotesStore);
    await notebooks.load();
    await notes.load();
  });

  afterEach(async () => {
    await repositories.adapter.close();
  });

  describe('deleting a notebook that holds notes', () => {
    it('moves them into the chosen notebook and refreshes the note list', async () => {
      const work = await notebooks.create('Work');
      await repositories.notes.create({ notebookId: work.id, type: 'text', title: 'Standup' });
      await notes.load();

      // Ionic wraps a radio group's value in `{ values }`; reading `data`
      // directly silently matched no choice and deleted nothing.
      alerts.answer = { data: { values: repositories.defaultNotebookId }, role: 'confirm' };
      await prompts.delete(work);

      expect(notebooks.notebooks().map((notebook) => notebook.name)).toEqual(['Notes']);
      const [moved] = notes.notes();
      expect(moved?.notebookId).toBe(repositories.defaultNotebookId);
    });

    it('purges them and drops them from the note list', async () => {
      const work = await notebooks.create('Work');
      await repositories.notes.create({ notebookId: work.id, type: 'text', title: 'Standup' });
      await notes.load();

      alerts.answer = { data: { values: 'purge' }, role: 'confirm' };
      await prompts.delete(work);

      expect(notes.notes()).toEqual([]);
    });

    it('keeps the notebook when the dialog is cancelled', async () => {
      const work = await notebooks.create('Work');
      await repositories.notes.create({ notebookId: work.id, type: 'text' });

      alerts.answer = { data: { values: 'purge' }, role: 'cancel' };
      await prompts.delete(work);

      expect(notebooks.find(work.id)).toBeDefined();
    });
  });

  it('deletes an empty notebook behind a plain confirmation', async () => {
    const work = await notebooks.create('Work');

    alerts.answer = { role: 'confirm' };
    await prompts.delete(work);

    expect(notebooks.find(work.id)).toBeUndefined();
  });
});
