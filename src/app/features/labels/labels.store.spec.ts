import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { LabelsStore } from './labels.store';

describe('LabelsStore', () => {
  let repositories: TestRepositories;
  let store: LabelsStore;

  beforeEach(async () => {
    repositories = await createTestRepositories();
    store = TestBed.inject(LabelsStore);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  it('starts empty — migration 001 seeds a notebook, but no labels', async () => {
    await store.load();

    expect(store.status()).toBe('ready');
    expect(store.labels()).toEqual([]);
  });

  it('reports an error instead of throwing when the read fails', async () => {
    vi.spyOn(repositories.labels, 'list').mockRejectedValue(new Error('disk gone'));

    await store.load();

    expect(store.status()).toBe('error');
    expect(store.labels()).toEqual([]);
  });

  /**
   * `LabelRepository.list` sorts with `localeCompare` in TypeScript rather than
   * in SQL, because SQLite's default collation compares bytes. Inserting locally
   * has to land a label where a reload would put it, umlauts included.
   */
  it('inserts a new label where a reload would put it', async () => {
    await store.load();
    await store.create('Zebra');
    await store.create('ähnlich');
    await store.create('Arbeit');

    const local = store.labels().map((label) => label.name);
    await store.load();

    expect(store.labels().map((label) => label.name)).toEqual(local);
    expect(local).toEqual(['ähnlich', 'Arbeit', 'Zebra']);
  });

  it('re-sorts after a rename', async () => {
    await store.load();
    const zebra = await store.create('Zebra');
    await store.create('Arbeit');

    await store.rename(zebra.id, 'Aal');

    expect(store.labels().map((label) => label.name)).toEqual(['Aal', 'Arbeit']);
    expect((await repositories.labels.get(zebra.id)).name).toBe('Aal');
  });

  it('drops a removed label from the list', async () => {
    await store.load();
    const work = await store.create('Work');

    await store.remove(work.id);

    expect(store.find(work.id)).toBeUndefined();
  });

  // Cards resolve ids to names on every render, and a card can outlive a label
  // deleted from the drawer.
  it('resolves names in the order given and skips ids it does not know', async () => {
    await store.load();
    const work = await store.create('Work');
    const home = await store.create('Home');

    expect(store.names([home.id, 'gone', work.id])).toEqual(['Home', 'Work']);
  });
});
