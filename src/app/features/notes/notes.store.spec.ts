import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NoteRepository } from '../../core/repositories/note.repository';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { compareActiveNotes, NotesStore } from './notes.store';

describe('NotesStore', () => {
  let repositories: TestRepositories;
  let store: NotesStore;

  beforeEach(async () => {
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

  describe('createTextNote', () => {
    it('creates a text note in the default notebook and adds it to the list', async () => {
      await store.load();

      const note = await store.createTextNote();

      expect(note.notebookId).toBe(repositories.defaultNotebookId);
      expect(note.type).toBe('text');
      expect(store.notes().map((entry) => entry.id)).toEqual([note.id]);
    });
  });

  describe('save', () => {
    it('replaces the note in place', async () => {
      const note = await store.createTextNote();

      await store.save(note.id, { title: 'Groceries', content: '- milk' });

      const [stored] = store.notes();
      expect(stored?.title).toBe('Groceries');
      expect(stored?.content).toBe('- milk');
      expect(store.notes()).toHaveLength(1);
    });

    it('persists through the repository, not just the signal', async () => {
      const note = await store.createTextNote();

      await store.save(note.id, { title: 'Groceries' });

      expect((await repositories.notes.get(note.id)).title).toBe('Groceries');
    });

    it('lifts an edited note back to the top of the list', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.UTC(2026, 0, 1));
      const first = await store.createTextNote();
      vi.advanceTimersByTime(60_000);
      const second = await store.createTextNote();

      expect(store.notes().map((note) => note.id)).toEqual([second.id, first.id]);

      vi.advanceTimersByTime(60_000);
      await store.save(first.id, { title: 'edited' });

      expect(store.notes().map((note) => note.id)).toEqual([first.id, second.id]);
      vi.useRealTimers();
    });

    it('flags a failed write and keeps the previous list', async () => {
      const note = await store.createTextNote();
      vi.spyOn(repositories.notes, 'update').mockRejectedValue(new Error('no space'));

      await store.save(note.id, { title: 'lost?' });

      expect(store.saveFailed()).toBe(true);
      expect(store.notes()).toHaveLength(1);
    });

    it('clears the failure flag on the next successful write', async () => {
      const note = await store.createTextNote();
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
      const note = await store.createTextNote();

      await store.discard(note.id);

      expect(store.notes()).toEqual([]);
      expect(await repositories.notes.find(note.id)).toBeUndefined();
    });
  });

  describe('partitioning', () => {
    it('splits pinned notes from the rest', async () => {
      const plain = await store.createTextNote();
      const sticky = await store.createTextNote();
      await repositories.notes.setPinned(sticky.id, true);
      await store.load();

      expect(store.pinned().map((note) => note.id)).toEqual([sticky.id]);
      expect(store.unpinned().map((note) => note.id)).toEqual([plain.id]);
    });
  });

  describe('compareActiveNotes', () => {
    it('agrees with the repository ordering', async () => {
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

      const fromSql = await notes.list({ kind: 'active' });
      const fromTs = [...fromSql].sort(() => Math.random() - 0.5).sort(compareActiveNotes);

      expect(fromTs.map((note) => note.id)).toEqual(fromSql.map((note) => note.id));
      expect(fromSql).toHaveLength(3);
      expect(fromSql[0]?.id).toBe(b.id);
      expect([a.id, c.id]).toContain(fromSql[1]?.id);
    });
  });
});
