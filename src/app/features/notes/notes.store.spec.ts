import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
import type { NoteView } from '../../core/repositories/note-queries';
import { NoteRepository } from '../../core/repositories/note.repository';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { compareNotes } from './note-sort';
import { NotesStore } from './notes.store';

describe('NotesStore', () => {
  let repositories: TestRepositories;
  let store: NotesStore;

  beforeEach(async () => {
    // The store reads `SettingsStore.sortOrder()` to decide display order.
    TestBed.configureTestingModule({
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    });
    repositories = await createTestRepositories();
    store = TestBed.inject(NotesStore);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  describe('load', () => {
    it('starts empty and becomes ready', async () => {
      await store.load();

      expect(store.notes()).toEqual([]);
      expect(store.status()).toBe('ready');
    });

    it('reports an error instead of throwing when the read fails', async () => {
      vi.spyOn(repositories.notes, 'list').mockRejectedValue(new Error('disk gone'));

      await store.load();

      expect(store.status()).toBe('error');
      expect(store.notes()).toEqual([]);
    });
  });

  describe('createNote', () => {
    it('creates a text note in the default notebook and adds it to the list', async () => {
      await store.load();

      const note = await store.createNote('text');

      expect(note.notebookId).toBe(repositories.defaultNotebookId);
      expect(note.type).toBe('text');
      expect(store.notes().map((entry) => entry.id)).toEqual([note.id]);
    });

    it('creates into the notebook being viewed rather than the default one', async () => {
      const work = await repositories.notebooks.create('Work');
      await store.setView({ kind: 'notebook', notebookId: work.id });

      const note = await store.createNote('text');

      expect(note.notebookId).toBe(work.id);
    });

    it('creates a checklist note with no items rather than a missing array', async () => {
      await store.load();

      const note = await store.createNote('checklist');

      expect(note.type).toBe('checklist');
      expect(note.checklist).toEqual([]);
    });
  });

  describe('setView', () => {
    it('narrows the list to one notebook', async () => {
      const work = await repositories.notebooks.create('Work');
      const inWork = await repositories.notes.create({ notebookId: work.id, type: 'text' });
      const elsewhere = await repositories.notes.create({
        notebookId: repositories.defaultNotebookId,
        type: 'text',
      });

      await store.setView({ kind: 'notebook', notebookId: work.id });
      expect(store.notes().map((note) => note.id)).toEqual([inWork.id]);

      await store.setView({ kind: 'active' });
      expect(store.notes().map((note) => note.id)).toContain(elsewhere.id);
    });
  });

  describe('moveNote', () => {
    it('drops the note from the notebook view it left', async () => {
      const work = await repositories.notebooks.create('Work');
      await store.setView({ kind: 'notebook', notebookId: work.id });
      const note = await store.createNote('text');

      await store.moveNote(note.id, repositories.defaultNotebookId);

      expect(store.notes()).toEqual([]);
      expect((await repositories.notes.get(note.id)).notebookId).toBe(
        repositories.defaultNotebookId,
      );
    });

    it('keeps the note in the active view, which spans every notebook', async () => {
      const work = await repositories.notebooks.create('Work');
      const note = await store.createNote('text');

      await store.moveNote(note.id, work.id);

      expect(store.notes().map((entry) => entry.id)).toEqual([note.id]);
      expect(store.notes()[0]?.notebookId).toBe(work.id);
    });

    // A background autosave swallows its failure; an explicit move must not.
    it('rethrows a failed move', async () => {
      const note = await store.createNote('text');
      vi.spyOn(repositories.notes, 'move').mockRejectedValue(new Error('gone'));

      await expect(store.moveNote(note.id, repositories.defaultNotebookId)).rejects.toThrow();
    });
  });

  describe('save', () => {
    it('replaces the note in place', async () => {
      const note = await store.createNote('text');

      await store.save(note.id, { title: 'Groceries', content: '- milk' });

      const [stored] = store.notes();
      expect(stored?.title).toBe('Groceries');
      expect(stored?.content).toBe('- milk');
      expect(store.notes()).toHaveLength(1);
    });

    it('persists through the repository, not just the signal', async () => {
      const note = await store.createNote('text');

      await store.save(note.id, { title: 'Groceries' });

      expect((await repositories.notes.get(note.id)).title).toBe('Groceries');
    });

    it('lifts an edited note back to the top of the list', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.UTC(2026, 0, 1));
      const first = await store.createNote('text');
      vi.advanceTimersByTime(60_000);
      const second = await store.createNote('text');

      expect(store.notes().map((note) => note.id)).toEqual([second.id, first.id]);

      vi.advanceTimersByTime(60_000);
      await store.save(first.id, { title: 'edited' });

      expect(store.notes().map((note) => note.id)).toEqual([first.id, second.id]);
      vi.useRealTimers();
    });

    // The editor writes through the store from either view, so a save that
    // happens to move nothing must not disturb a notebook view either.
    it('keeps a saved note in the notebook view it still belongs to', async () => {
      const work = await repositories.notebooks.create('Work');
      await store.setView({ kind: 'notebook', notebookId: work.id });
      const note = await store.createNote('text');

      await store.save(note.id, { title: 'Sprint plan' });

      expect(store.notes().map((entry) => entry.id)).toEqual([note.id]);
    });

    it('flags a failed write and keeps the previous list', async () => {
      const note = await store.createNote('text');
      vi.spyOn(repositories.notes, 'update').mockRejectedValue(new Error('no space'));

      const saved = await store.save(note.id, { title: 'lost?' });

      expect(saved).toBe(false);
      expect(store.saveFailed()).toBe(true);
      expect(store.notes()).toHaveLength(1);
    });

    // The editor keeps its own `dirty` flag set on `false` so the edit survives
    // to the next flush instead of being discarded on exit.
    it('reports whether the write landed', async () => {
      const note = await store.createNote('text');

      await expect(store.save(note.id, { title: 'kept' })).resolves.toBe(true);
    });

    it('clears the failure flag on the next successful write', async () => {
      const note = await store.createNote('text');
      const update = vi
        .spyOn(repositories.notes, 'update')
        .mockRejectedValueOnce(new Error('no space'));

      await store.save(note.id, { title: 'first try' });
      expect(store.saveFailed()).toBe(true);

      update.mockRestore();
      await store.save(note.id, { title: 'second try' });

      expect(store.saveFailed()).toBe(false);
    });
  });

  describe('discard', () => {
    it('purges the note and drops it from the list', async () => {
      const note = await store.createNote('text');

      await store.discard(note.id);

      expect(store.notes()).toEqual([]);
      expect(await repositories.notes.find(note.id)).toBeUndefined();
    });
  });

  describe('partitioning', () => {
    it('splits pinned notes from the rest', async () => {
      const plain = await store.createNote('text');
      const sticky = await store.createNote('text');
      await repositories.notes.setPinned(sticky.id, true);
      await store.load();

      expect(store.pinned().map((note) => note.id)).toEqual([sticky.id]);
      expect(store.unpinned().map((note) => note.id)).toEqual([plain.id]);
    });
  });

  // The replace-vs-reload split of `docs/labels-and-organization.md`: an action
  // that cannot change view membership patches the list in place, and every
  // action that can re-runs the query rather than re-deciding the `WHERE` in
  // TypeScript.
  describe('organizing', () => {
    it('re-sorts a pinned note without re-reading the list', async () => {
      const sticky = await store.createNote('text');
      await store.createNote('text');
      const list = vi.spyOn(repositories.notes, 'list');

      await store.setPinned(sticky.id, true);

      expect(store.notes()[0]?.id).toBe(sticky.id);
      expect(store.pinned().map((note) => note.id)).toEqual([sticky.id]);
      expect(list).not.toHaveBeenCalled();
    });

    it('colours a note in place, and clears the colour again', async () => {
      const note = await store.createNote('text');
      const list = vi.spyOn(repositories.notes, 'list');

      await store.setColor(note.id, 'teal');
      expect(store.notes()[0]?.color).toBe('teal');

      await store.setColor(note.id, undefined);
      expect('color' in (store.notes()[0] ?? {})).toBe(false);
      expect(list).not.toHaveBeenCalled();
    });

    it('drops an archived note from the active view and finds it in the archive', async () => {
      const note = await store.createNote('text');

      await store.setArchived(note.id, true);
      expect(store.notes()).toEqual([]);

      await store.setView({ kind: 'archived' });
      expect(store.notes().map((entry) => entry.id)).toEqual([note.id]);

      await store.setArchived(note.id, false);
      expect(store.notes()).toEqual([]);
    });

    it('moves a note to the trash and back', async () => {
      const note = await store.createNote('text');

      await store.trash(note.id);
      expect(store.notes()).toEqual([]);

      await store.setView({ kind: 'trashed' });
      expect(store.notes().map((entry) => entry.id)).toEqual([note.id]);

      await store.restore(note.id);
      expect(store.notes()).toEqual([]);
      expect((await repositories.notes.get(note.id)).deletedAt).toBeUndefined();
    });

    it('drops a note from a label view once the label is taken off it', async () => {
      const label = await repositories.labels.create('Work');
      const note = await store.createNote('text');
      await store.setLabels(note.id, [label.id]);

      await store.setView({ kind: 'label', labelId: label.id });
      expect(store.notes().map((entry) => entry.id)).toEqual([note.id]);

      await store.setLabels(note.id, []);
      expect(store.notes()).toEqual([]);
    });

    it('deletes one note forever and empties the whole trash', async () => {
      const single = await store.createNote('text');
      const rest = await store.createNote('text');
      await store.trash(single.id);
      await store.trash(rest.id);
      await store.setView({ kind: 'trashed' });

      await store.deleteForever(single.id);
      expect(store.notes().map((entry) => entry.id)).toEqual([rest.id]);

      await store.emptyTrash();
      expect(store.notes()).toEqual([]);
      expect(await repositories.notes.find(rest.id)).toBeUndefined();
    });

    // Ionic caches pages, so every list page re-asserts its view on entry.
    it('ignores a repeat of the view it already holds', async () => {
      await store.setView({ kind: 'archived' });
      const list = vi.spyOn(repositories.notes, 'list');

      await store.setView({ kind: 'archived' });

      expect(list).not.toHaveBeenCalled();
    });

    // `/notes` asks for the active view the store already starts on, so a guard
    // that only compared views would leave the app opening on a blank list.
    it('still performs the very first load of the view it starts on', async () => {
      await repositories.notes.create({
        notebookId: repositories.defaultNotebookId,
        type: 'text',
      });

      await store.setView({ kind: 'active' });

      expect(store.status()).toBe('ready');
      expect(store.notes()).toHaveLength(1);
    });

    // The store is shared by the notes, archive and trash pages, so rows held
    // over the load would render inside the new page, wired to its actions.
    it('does not hold the old view rows while the new view loads', async () => {
      await repositories.notes.create({
        notebookId: repositories.defaultNotebookId,
        type: 'text',
      });
      await store.setView({ kind: 'active' });

      const pending = store.setView({ kind: 'trashed' });

      expect(store.notes()).toEqual([]);
      await pending;
    });

    // A same-view refresh backs every archive, trash and label action; blanking
    // there would flash the list away and back on each one.
    it('does not blank the list on a refresh of the view it already holds', async () => {
      await repositories.notes.create({
        notebookId: repositories.defaultNotebookId,
        type: 'text',
      });
      await store.setView({ kind: 'active' });

      const pending = store.load();

      expect(store.notes()).toHaveLength(1);
      await pending;
    });

    it('retries a view whose load failed rather than treating it as held', async () => {
      const list = vi
        .spyOn(repositories.notes, 'list')
        .mockRejectedValueOnce(new Error('disk gone'));

      await store.setView({ kind: 'archived' });
      expect(store.status()).toBe('error');

      await store.setView({ kind: 'archived' });

      expect(list).toHaveBeenCalledTimes(2);
      expect(store.status()).toBe('ready');
    });
  });

  describe('the display comparator', () => {
    it('agrees with the repository ordering under the default sort order', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.UTC(2026, 0, 1));
      const notes = TestBed.inject(NoteRepository);

      // Two notes share an updatedAt so the id tiebreaker is exercised, and one
      // is pinned so the leading key is too.
      const a = await notes.create({ notebookId: repositories.defaultNotebookId, type: 'text' });
      const b = await notes.create({ notebookId: repositories.defaultNotebookId, type: 'text' });
      vi.advanceTimersByTime(60_000);
      const c = await notes.create({ notebookId: repositories.defaultNotebookId, type: 'text' });
      await notes.setPinned(b.id, true);
      vi.useRealTimers();

      const view: NoteView = { kind: 'active' };
      const fromSql = await notes.list(view);
      const fromTs = [...fromSql]
        .sort(() => Math.random() - 0.5)
        .sort(compareNotes(view, 'updatedDesc'));

      expect(fromTs.map((note) => note.id)).toEqual(fromSql.map((note) => note.id));
      expect(fromSql).toHaveLength(3);
      expect(fromSql[0]?.id).toBe(b.id);
      expect([a.id, c.id]).toContain(fromSql[1]?.id);
    });

    it('re-sorts on a settings change without re-reading the list', async () => {
      const notes = TestBed.inject(NoteRepository);
      const settings = TestBed.inject(SettingsStore);
      for (const title of ['Zebra', 'Äpfel', 'Apfel']) {
        await notes.create({ notebookId: repositories.defaultNotebookId, type: 'text', title });
      }
      await store.setView({ kind: 'active' });
      const list = vi.spyOn(notes, 'list');

      settings.setSortOrder('titleAsc');

      // `Äpfel` beside `Apfel` rather than after `Zebra` is the whole reason
      // this ordering cannot live in SQL.
      expect(store.notes().map((note) => note.title)).toEqual(['Apfel', 'Äpfel', 'Zebra']);
      expect(list).not.toHaveBeenCalled();
    });

    // `trash()` deliberately does not bump `updatedAt`, so any sort key other
    // than deletion time would scatter recently-deleted notes among old ones.
    it('leaves the trash on deletion order whatever the sort order says', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.UTC(2026, 0, 1));
      const notes = TestBed.inject(NoteRepository);
      const settings = TestBed.inject(SettingsStore);
      const apfel = await notes.create({
        notebookId: repositories.defaultNotebookId,
        type: 'text',
        title: 'Apfel',
      });
      const zebra = await notes.create({
        notebookId: repositories.defaultNotebookId,
        type: 'text',
        title: 'Zebra',
      });
      await notes.trash(apfel.id);
      vi.advanceTimersByTime(60_000);
      await notes.trash(zebra.id);
      vi.useRealTimers();
      settings.setSortOrder('titleAsc');

      await store.setView({ kind: 'trashed' });

      expect(store.notes().map((note) => note.title)).toEqual(['Zebra', 'Apfel']);
    });
  });
});
