import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SqlValue } from '../database/sql-value';
import { DEFAULT_NOTEBOOK_NAME } from '../models/notebook';
import {
  DefaultNotebookError,
  EntityNotFoundError,
  NotebookNotEmptyError,
} from './repository-errors';
import { createTestRepositories, type TestRepositories } from './testing';

describe('NotebookRepository', () => {
  let repos: TestRepositories;

  beforeEach(async () => {
    repos = await createTestRepositories();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repos.adapter.close();
  });

  function note(notebookId: string, title = 'Note') {
    return repos.notes.create({ notebookId, type: 'text', title });
  }

  it('seeds one notebook and points the default at it', async () => {
    expect(await repos.notebooks.list()).toEqual([
      expect.objectContaining({ id: repos.defaultNotebookId, name: DEFAULT_NOTEBOOK_NAME }),
    ]);
  });

  it('appends new notebooks after the highest sort order', async () => {
    const first = await repos.notebooks.create('Work');
    const second = await repos.notebooks.create('Home');

    expect([first.sortOrder, second.sortOrder]).toEqual([1, 2]);
    expect((await repos.notebooks.list()).map((notebook) => notebook.name)).toEqual([
      DEFAULT_NOTEBOOK_NAME,
      'Work',
      'Home',
    ]);
  });

  it('refuses to delete the default notebook', async () => {
    await expect(repos.notebooks.delete(repos.defaultNotebookId)).rejects.toBeInstanceOf(
      DefaultNotebookError,
    );
  });

  // `notes.notebook_id` is `ON DELETE RESTRICT` and a note with no notebook is
  // not representable, so the caller has to say what should happen instead.
  it('refuses a non-empty notebook when given no disposition', async () => {
    const notebook = await repos.notebooks.create('Work');
    await note(notebook.id);

    await expect(repos.notebooks.delete(notebook.id)).rejects.toBeInstanceOf(NotebookNotEmptyError);
    expect(await repos.notebooks.list()).toHaveLength(2);
  });

  it('refuses to move a notebook’s notes into itself', async () => {
    const notebook = await repos.notebooks.create('Work');
    await note(notebook.id);

    await expect(
      repos.notebooks.delete(notebook.id, { notes: 'moveTo', targetId: notebook.id }),
    ).rejects.toThrow(/its own notes/);
  });

  it('refuses to move notes into a notebook that does not exist', async () => {
    const notebook = await repos.notebooks.create('Work');
    const kept = await note(notebook.id);

    await expect(
      repos.notebooks.delete(notebook.id, { notes: 'moveTo', targetId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
    expect(await repos.notes.get(kept.id)).toEqual(kept);
  });

  // `moveAllFromNotebook` (`note-store.ts:91-99`) spans active, archived and
  // trashed alike — all three hold the foreign key that blocks the delete.
  it('moves archived and trashed notes too', async () => {
    const notebook = await repos.notebooks.create('Work');
    const active = await note(notebook.id, 'active');
    const archived = await note(notebook.id, 'archived');
    const trashed = await note(notebook.id, 'trashed');
    await repos.notes.setArchived(archived.id, true);
    await repos.notes.trash(trashed.id);

    await repos.notebooks.delete(notebook.id, {
      notes: 'moveTo',
      targetId: repos.defaultNotebookId,
    });

    for (const moved of [active, archived, trashed]) {
      expect((await repos.notes.get(moved.id)).notebookId).toBe(repos.defaultNotebookId);
    }
    expect(await repos.notebooks.list()).toHaveLength(1);
  });

  it('purges the notes and reports their images when asked to', async () => {
    const notebook = await repos.notebooks.create('Work');
    const imageId = crypto.randomUUID();
    await repos.images.insert({ id: imageId, mimeType: 'image/png' });
    const doomed = await note(notebook.id);
    await repos.notes.update(doomed.id, { imageIds: [imageId] });

    expect(await repos.notebooks.delete(notebook.id, { notes: 'purge' })).toEqual([imageId]);
    expect(await repos.notes.find(doomed.id)).toBeUndefined();
    expect(await repos.notebooks.list()).toHaveLength(1);
  });

  // The desktop moves the notes and deletes the notebook over two IPC calls, so
  // a failure between them strands the user halfway. One transaction cannot.
  it('leaves every note and the notebook intact when a purge fails partway', async () => {
    const notebook = await repos.notebooks.create('Work');
    const first = await note(notebook.id, 'first');
    const second = await note(notebook.id, 'second');

    const original = repos.adapter.run.bind(repos.adapter);
    let deletions = 0;
    vi.spyOn(repos.adapter, 'run').mockImplementation(
      async (sql: string, params?: readonly SqlValue[]) => {
        if (sql.startsWith('DELETE FROM notes') && ++deletions === 2) {
          throw new Error('interrupted');
        }
        return original(sql, params);
      },
    );

    await expect(repos.notebooks.delete(notebook.id, { notes: 'purge' })).rejects.toThrow();
    vi.restoreAllMocks();

    expect(await repos.notes.get(first.id)).toEqual(first);
    expect(await repos.notes.get(second.id)).toEqual(second);
    expect(await repos.notebooks.get(notebook.id)).toEqual(notebook);
  });

  it('reports a missing notebook rather than silently succeeding', async () => {
    await expect(repos.notebooks.get(crypto.randomUUID())).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
    await expect(repos.notebooks.delete(crypto.randomUUID())).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
  });
});
