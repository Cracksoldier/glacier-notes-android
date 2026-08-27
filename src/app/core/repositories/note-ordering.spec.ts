import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Note } from '../models/note';
import { createTestRepositories, type TestRepositories } from './testing';

/**
 * The read path runs four statements over an identical `page` CTE, so the
 * window's `ORDER BY` has to be a *total* order or the four executions can
 * disagree about which notes the page contains. These specs pin both halves:
 * the order itself, and the fact that a windowed page still assembles correctly.
 */

const START = Date.UTC(2026, 0, 1);
let elapsed = 0;

function tick(): void {
  elapsed += 60_000;
  vi.setSystemTime(START + elapsed);
}

describe('note ordering', () => {
  let repos: TestRepositories;

  beforeEach(async () => {
    elapsed = 0;
    vi.useFakeTimers();
    vi.setSystemTime(START);
    repos = await createTestRepositories();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await repos.adapter.close();
  });

  function create(title: string) {
    return repos.notes.create({ notebookId: repos.defaultNotebookId, type: 'text', title });
  }

  const titles = (notes: readonly Note[]) => notes.map((note) => note.title);

  it('puts pinned notes above unpinned ones, newest first within each group', async () => {
    const oldest = await create('oldest');
    tick();
    await create('middle');
    tick();
    await create('newest');
    tick();
    await repos.notes.setPinned(oldest.id, true);

    expect(titles(await repos.notes.list({ kind: 'active' }))).toEqual([
      'oldest',
      'newest',
      'middle',
    ]);
  });

  it('applies the same pinned-first order to archived, notebook and label views', async () => {
    const label = await repos.labels.create('Work');
    const plain = await create('plain');
    tick();
    const special = await create('special');
    tick();
    await repos.notes.setPinned(special.id, true);
    tick();
    await repos.notes.setLabels(plain.id, [label.id]);
    await repos.notes.setLabels(special.id, [label.id]);

    expect(titles(await repos.notes.list({ kind: 'label', labelId: label.id }))).toEqual([
      'special',
      'plain',
    ]);
    expect(
      titles(await repos.notes.list({ kind: 'notebook', notebookId: repos.defaultNotebookId })),
    ).toEqual(['special', 'plain']);

    await repos.notes.setArchived(plain.id, true);
    await repos.notes.setArchived(special.id, true);
    expect(titles(await repos.notes.list({ kind: 'archived' }))).toEqual(['special', 'plain']);
  });

  it('excludes archived and trashed notes from notebook and label views', async () => {
    const label = await repos.labels.create('Work');
    const archived = await create('archived');
    const trashed = await create('trashed');
    await repos.notes.setLabels(archived.id, [label.id]);
    await repos.notes.setLabels(trashed.id, [label.id]);
    await repos.notes.setArchived(archived.id, true);
    await repos.notes.trash(trashed.id);

    expect(await repos.notes.list({ kind: 'label', labelId: label.id })).toEqual([]);
    expect(
      await repos.notes.list({ kind: 'notebook', notebookId: repos.defaultNotebookId }),
    ).toEqual([]);
  });

  // Without the `id` tiebreaker SQLite is free to return equal-`updated_at`
  // rows in any order, and the four page executions could each pick a different
  // one. The clock is frozen here precisely to force the tie.
  it('breaks ties on id, so repeated calls agree', async () => {
    for (let index = 0; index < 5; index++) {
      await create(`note-${index}`);
    }

    const first = await repos.notes.list({ kind: 'active' });
    const second = await repos.notes.list({ kind: 'active' });

    expect(first.map((note) => note.id)).toEqual(second.map((note) => note.id));
    expect(first.map((note) => note.id)).toEqual(
      [...first.map((note) => note.id)].sort().reverse(),
    );
  });

  // A documented deviation: `trash()` does not bump `updatedAt`, so ordering the
  // bin by it would scatter recently-deleted notes among old ones.
  it('orders the trash by deletion time, not by last edit', async () => {
    const older = await create('older');
    tick();
    const newer = await create('newer');
    tick();
    await repos.notes.trash(newer.id);
    tick();
    await repos.notes.trash(older.id);

    expect(titles(await repos.notes.list({ kind: 'trashed' }))).toEqual(['older', 'newer']);
  });

  it('keeps a windowed page and its junction rows in agreement', async () => {
    const label = await repos.labels.create('Work');
    for (let index = 0; index < 5; index++) {
      const note = await repos.notes.create({
        notebookId: repos.defaultNotebookId,
        type: 'checklist',
        title: `note-${index}`,
        checklist: [
          { id: crypto.randomUUID(), text: `item-${index}`, checked: false, sortOrder: 0 },
        ],
      });
      await repos.notes.setLabels(note.id, [label.id]);
      tick();
    }

    const all = await repos.notes.list({ kind: 'active' });
    const page = await repos.notes.list({ kind: 'active' }, { limit: 2, offset: 1 });

    expect(page).toEqual(all.slice(1, 3));
    for (const note of page) {
      expect(note.checklist?.map((entry) => entry.text)).toEqual([
        `item-${note.title.split('-')[1]}`,
      ]);
      expect(note.labels).toEqual([label.id]);
    }
  });
});
