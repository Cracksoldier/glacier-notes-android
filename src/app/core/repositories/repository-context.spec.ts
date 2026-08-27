import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SqlValue } from '../database/sql-value';
import { ConstraintViolationError, EntityNotFoundError } from './repository-errors';
import { createTestRepositories, type TestRepositories } from './testing';

describe('RepositoryContext', () => {
  let repos: TestRepositories;

  beforeEach(async () => {
    repos = await createTestRepositories();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repos.adapter.close();
  });

  function create(title: string) {
    return repos.notes.create({ notebookId: repos.defaultNotebookId, type: 'text', title });
  }

  it('rolls back everything a failed write touched', async () => {
    const label = await repos.labels.create('Work');
    const note = await create('unchanged');

    const original = repos.adapter.run.bind(repos.adapter);
    vi.spyOn(repos.adapter, 'run').mockImplementation(
      async (sql: string, params?: readonly SqlValue[]) => {
        if (sql.startsWith('INSERT INTO note_labels')) {
          throw new Error('interrupted');
        }
        return original(sql, params);
      },
    );

    await expect(repos.notes.setLabels(note.id, [label.id])).rejects.toThrow();
    vi.restoreAllMocks();

    // The `DELETE FROM note_labels` and the `UPDATE notes` both ran before the
    // failing insert, so an un-rolled-back note would come back with a bumped
    // `updatedAt` and nothing to show for it.
    expect(await repos.notes.get(note.id)).toEqual(note);
  });

  // `withTransaction` guards nesting per *adapter*, not per call stack, so two
  // merely-interleaved root operations would collide without the queue. M06's
  // debounced autosave landing during a list refresh is exactly this shape.
  it('serializes overlapping operations instead of rejecting them', async () => {
    const inFlight = [create('one'), create('two'), create('three')];

    const notes = await Promise.all(inFlight);

    expect(new Set(notes.map((note) => note.id)).size).toBe(3);
    expect(await repos.notes.list({ kind: 'active' })).toHaveLength(3);
  });

  it('keeps running after an operation fails', async () => {
    const failing = repos.notes.get(crypto.randomUUID());
    const succeeding = create('after');

    await expect(failing).rejects.toBeInstanceOf(EntityNotFoundError);
    expect((await succeeding).title).toBe('after');
  });

  // The three adapters report constraint failures in three different shapes, so
  // there is no engine-independent way for a caller to read one. It gets the
  // operation name and the original error, and nothing that looks like a code.
  it('wraps adapter errors but lets repository errors through untouched', async () => {
    const id = crypto.randomUUID();
    await repos.images.insert({ id, mimeType: 'image/png' });

    await expect(repos.images.insert({ id, mimeType: 'image/png' })).rejects.toBeInstanceOf(
      ConstraintViolationError,
    );
    await expect(repos.notes.get(crypto.randomUUID())).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it('names the operation on the error it wraps', async () => {
    const id = crypto.randomUUID();
    await repos.images.insert({ id, mimeType: 'image/png' });

    await expect(repos.images.insert({ id, mimeType: 'image/png' })).rejects.toMatchObject({
      operation: 'images.insert',
    });
  });
});
