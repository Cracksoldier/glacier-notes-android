import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CollectionRepository } from './collection-snapshot';
import { createTestRepositories, type TestRepositories } from './testing';

describe('CollectionRepository.snapshot', () => {
  let repos: TestRepositories;
  let collection: CollectionRepository;

  beforeEach(async () => {
    repos = await createTestRepositories();
    collection = TestBed.inject(CollectionRepository);
  });

  afterEach(async () => {
    await repos.adapter.close();
  });

  function create(title: string) {
    return repos.notes.create({ notebookId: repos.defaultNotebookId, type: 'text', title });
  }

  it('covers active, archived and trashed notes, each exactly once', async () => {
    const active = await create('active');
    const archived = await create('archived');
    const trashed = await create('trashed');
    await repos.notes.setArchived(archived.id, true);
    await repos.notes.trash(trashed.id);

    const snapshot = await collection.snapshot();
    const ids = snapshot.notes.map((note) => note.id);

    expect(ids).toHaveLength(3);
    expect(new Set(ids)).toEqual(new Set([active.id, archived.id, trashed.id]));
  });

  it('carries deletedAt on the trashed note and leaves it absent on the others', async () => {
    const trashed = await create('trashed');
    await create('active');
    await repos.notes.trash(trashed.id);

    const snapshot = await collection.snapshot();

    expect(snapshot.notes.find((note) => note.id === trashed.id)?.deletedAt).toBeTypeOf('string');
    expect(snapshot.notes.filter((note) => 'deletedAt' in note)).toHaveLength(1);
  });

  it('reads notebooks, labels and the default notebook id in the same turn', async () => {
    const notebook = await repos.notebooks.create('Second');
    const label = await repos.labels.create('Urgent');

    const snapshot = await collection.snapshot();

    expect(snapshot.notebooks.map((value) => value.id)).toContain(notebook.id);
    expect(snapshot.labels.map((value) => value.id)).toEqual([label.id]);
    expect(snapshot.defaultNotebookId).toBe(repos.defaultNotebookId);
  });

  it('matches what the individual repositories return', async () => {
    await create('one');
    await repos.notebooks.create('Second');
    await repos.labels.create('Urgent');

    const snapshot = await collection.snapshot();

    expect(snapshot.notebooks).toEqual(await repos.notebooks.list());
    expect(snapshot.labels).toEqual(await repos.labels.list());
    expect(snapshot.notes).toEqual(await repos.notes.list({ kind: 'all' }));
  });

  /**
   * The reason the snapshot is one `read()` rather than four repository calls:
   * a write racing it must land wholly before or wholly after, never between two
   * of its four queries where it could produce a note whose notebook is missing.
   */
  it('never tears when a write races it', async () => {
    await create('before');

    const [snapshot] = await Promise.all([
      collection.snapshot(),
      repos.notebooks
        .create('Racing')
        .then((notebook) =>
          repos.notes.create({ notebookId: notebook.id, type: 'text', title: 'racing note' }),
        ),
    ]);

    const notebookIds = new Set(snapshot.notebooks.map((value) => value.id));
    for (const note of snapshot.notes) {
      expect(notebookIds.has(note.notebookId)).toBe(true);
    }
  });

  // The callback composes free functions on purpose; re-entering the queue would
  // stall it until QUEUE_STALL_TIMEOUT_MS and fail as a deadlock.
  it('does not deadlock the repository queue', async () => {
    await expect(collection.snapshot()).resolves.toBeDefined();
    await expect(collection.snapshot()).resolves.toBeDefined();
    await expect(repos.notes.list({ kind: 'all' })).resolves.toBeDefined();
  });
});
