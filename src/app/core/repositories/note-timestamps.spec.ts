import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestRepositories, type TestRepositories } from './testing';

/**
 * The `updatedAt` matrix, which is a contract rather than an implementation
 * detail: it drives the default sort order, so an operation that bumps it moves
 * the note to the top of every list. Each case here cites the desktop behaviour
 * it reproduces; `docs/repositories.md` collects them in one table.
 */

const START = Date.UTC(2026, 0, 1);
let elapsed = 0;

function tick(): void {
  elapsed += 60_000;
  vi.setSystemTime(START + elapsed);
}

describe('updatedAt', () => {
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

  function create() {
    return repos.notes.create({ notebookId: repos.defaultNotebookId, type: 'text' });
  }

  it('is left alone by trash, so restoring does not reshuffle the note', async () => {
    const note = await create();
    tick();

    const trashed = await repos.notes.trash(note.id);

    expect(trashed.updatedAt).toBe(note.updatedAt);
    expect(trashed.deletedAt).toBeDefined();
  });

  it('is bumped by restore, which also drops the key entirely', async () => {
    const note = await create();
    await repos.notes.trash(note.id);
    tick();

    const restored = await repos.notes.restore(note.id);

    expect(restored.updatedAt).not.toBe(note.updatedAt);
    expect('deletedAt' in restored).toBe(false);
  });

  // Both route through `update()` on the desktop (`note-store.ts:54,59`).
  it('is bumped by pinning and by archiving', async () => {
    const note = await create();
    tick();
    const pinned = await repos.notes.setPinned(note.id, true);
    tick();
    const archived = await repos.notes.setArchived(note.id, true);

    expect(pinned.updatedAt).not.toBe(note.updatedAt);
    expect(archived.updatedAt).not.toBe(pinned.updatedAt);
  });

  it('is bumped by moving to another notebook', async () => {
    const note = await create();
    const target = await repos.notebooks.create('Work');
    tick();

    expect((await repos.notes.move(note.id, target.id)).updatedAt).not.toBe(note.updatedAt);
  });

  // `stripLabel` (`note-repo.ts:165-172`) rewrites the notes without touching
  // their timestamps, so cleaning up a label does not reorder the whole grid.
  it('is left alone when a label is deleted out from under a note', async () => {
    const label = await repos.labels.create('Work');
    const note = await create();
    const tagged = await repos.notes.setLabels(note.id, [label.id]);
    tick();

    await repos.labels.delete(label.id);

    const after = await repos.notes.get(note.id);
    expect(after.updatedAt).toBe(tagged.updatedAt);
    expect(after.labels).toEqual([]);
  });
});
