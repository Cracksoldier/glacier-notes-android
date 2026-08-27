import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EntityNotFoundError } from './repository-errors';
import { createTestRepositories, type TestRepositories } from './testing';

describe('LabelRepository', () => {
  let repos: TestRepositories;

  beforeEach(async () => {
    repos = await createTestRepositories();
  });

  afterEach(async () => {
    await repos.adapter.close();
  });

  // SQLite's default collation compares bytes, which would put `Zebra` first.
  // The sidebar order has to match `label-repo.ts:32`, which uses localeCompare.
  it('sorts by name the way the desktop does, not the way SQLite would', async () => {
    for (const name of ['Zebra', 'ähnlich', 'Apfel']) {
      await repos.labels.create(name);
    }

    expect((await repos.labels.list()).map((label) => label.name)).toEqual([
      'ähnlich',
      'Apfel',
      'Zebra',
    ]);
  });

  it('allows two labels to share a name, as the desktop does', async () => {
    await repos.labels.create('Work');
    await repos.labels.create('Work');

    expect(await repos.labels.list()).toHaveLength(2);
  });

  it('renames without inventing a timestamp', async () => {
    const label = await repos.labels.create('Wrok');

    expect(await repos.labels.rename(label.id, 'Work')).toEqual({ id: label.id, name: 'Work' });
    expect(await repos.labels.get(label.id)).toEqual({ id: label.id, name: 'Work' });
  });

  it('strips a deleted label from every note and keeps the notes', async () => {
    const kept = await repos.labels.create('Keep');
    const doomed = await repos.labels.create('Drop');
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
    });
    await repos.notes.setLabels(note.id, [kept.id, doomed.id]);

    await repos.labels.delete(doomed.id);

    expect((await repos.notes.get(note.id)).labels).toEqual([kept.id]);
  });

  it('reports a missing label', async () => {
    await expect(repos.labels.get(crypto.randomUUID())).rejects.toBeInstanceOf(EntityNotFoundError);
    await expect(repos.labels.delete(crypto.randomUUID())).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
  });
});
