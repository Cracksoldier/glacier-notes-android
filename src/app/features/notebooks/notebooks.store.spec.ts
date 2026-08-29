import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookNotEmptyError } from '../../core/repositories/repository-errors';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { NotebooksStore } from './notebooks.store';

describe('NotebooksStore', () => {
  let repositories: TestRepositories;
  let store: NotebooksStore;

  beforeEach(async () => {
    repositories = await createTestRepositories();
    store = TestBed.inject(NotebooksStore);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  it('loads the seeded notebook and the default it points at', async () => {
    await store.load();

    expect(store.status()).toBe('ready');
    expect(store.notebooks().map((notebook) => notebook.id)).toEqual([
      repositories.defaultNotebookId,
    ]);
    expect(store.defaultId()).toBe(repositories.defaultNotebookId);
    expect(store.defaultNotebook()?.id).toBe(repositories.defaultNotebookId);
  });

  it('reports an error instead of throwing when the read fails', async () => {
    vi.spyOn(repositories.notebooks, 'list').mockRejectedValue(new Error('disk gone'));

    await store.load();

    expect(store.status()).toBe('error');
    expect(store.notebooks()).toEqual([]);
  });

  // `list()` orders by sort_order and `create()` takes the next one, so appending
  // locally has to agree with what a reload would produce.
  it('appends a new notebook where a reload would put it', async () => {
    await store.load();
    await store.create('Work');
    await store.create('Home');

    const local = store.notebooks().map((notebook) => notebook.id);
    await store.load();

    expect(store.notebooks().map((notebook) => notebook.id)).toEqual(local);
  });

  it('renames in place and persists', async () => {
    await store.load();
    const work = await store.create('Work');

    await store.rename(work.id, 'Projects');

    expect(store.find(work.id)?.name).toBe('Projects');
    expect((await repositories.notebooks.get(work.id)).name).toBe('Projects');
  });

  it('removes an empty notebook outright', async () => {
    await store.load();
    const work = await store.create('Work');

    await store.remove(work.id);

    expect(store.find(work.id)).toBeUndefined();
  });

  /**
   * The delete UI depends on this error carrying the count: it calls `remove`
   * with no disposition first, and the refusal is what tells it how many notes
   * the dialog must mention. A change to the error's shape breaks that flow.
   */
  it('refuses a non-empty notebook with the count the dialog needs', async () => {
    await store.load();
    const work = await store.create('Work');
    await repositories.notes.create({ notebookId: work.id, type: 'text' });
    await repositories.notes.create({ notebookId: work.id, type: 'text' });

    const error = await store.remove(work.id).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(NotebookNotEmptyError);
    expect((error as NotebookNotEmptyError).noteCount).toBe(2);
    expect(store.find(work.id)).toBeDefined();
  });

  it('purges the notes when told to', async () => {
    await store.load();
    const work = await store.create('Work');
    const doomed = await repositories.notes.create({ notebookId: work.id, type: 'text' });

    await store.remove(work.id, { notes: 'purge' });

    expect(store.find(work.id)).toBeUndefined();
    expect(await repositories.notes.find(doomed.id)).toBeUndefined();
  });

  it('moves the notes when told to', async () => {
    await store.load();
    const work = await store.create('Work');
    const kept = await repositories.notes.create({ notebookId: work.id, type: 'text' });

    await store.remove(work.id, { notes: 'moveTo', targetId: repositories.defaultNotebookId });

    expect(store.find(work.id)).toBeUndefined();
    expect((await repositories.notes.get(kept.id)).notebookId).toBe(repositories.defaultNotebookId);
  });

  it('keeps the notebook in the list when the delete fails', async () => {
    await store.load();
    const work = await store.create('Work');
    vi.spyOn(repositories.notebooks, 'delete').mockRejectedValue(new Error('locked'));

    await expect(store.remove(work.id)).rejects.toThrow();

    expect(store.find(work.id)).toBeDefined();
  });

  it('moves the default and persists it', async () => {
    await store.load();
    const work = await store.create('Work');

    await store.setDefault(work.id);

    expect(store.defaultId()).toBe(work.id);
    expect(await repositories.notebooks.getDefaultId()).toBe(work.id);
  });
});
