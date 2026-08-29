import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SqlValue } from '../database/sql-value';
import { QUEUE_STALL_TIMEOUT_MS, RepositoryContext } from './repository-context';
import {
  ConstraintViolationError,
  EntityNotFoundError,
  RepositoryDeadlockError,
} from './repository-errors';
import { createTestRepositories, type TestRepositories } from './testing';

describe('RepositoryContext', () => {
  let repos: TestRepositories;

  beforeEach(async () => {
    repos = await createTestRepositories();
  });

  afterEach(async () => {
    vi.useRealTimers();
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

  // Re-entering the context queues an operation behind itself, which without the
  // watchdog hangs forever with no error anywhere. M12's bulk import is exactly
  // where the `*-writes.ts` convention that prevents this gets broken.
  it('turns a re-entrant call into a named error rather than a silent hang', async () => {
    vi.useFakeTimers();
    const context = TestBed.inject(RepositoryContext);

    const outer = context.read('outer', async () => {
      await context.read('inner', () => Promise.resolve('never'));
      return 'unreachable';
    });

    await vi.advanceTimersByTimeAsync(QUEUE_STALL_TIMEOUT_MS);

    await expect(outer).rejects.toBeInstanceOf(RepositoryDeadlockError);
    await expect(outer).rejects.toMatchObject({ blocked: 'inner', running: 'outer' });
  });

  it('does not trip the watchdog on an operation that is merely slow', async () => {
    vi.useFakeTimers();
    const context = TestBed.inject(RepositoryContext);

    let release: () => void = () => undefined;
    const slow = context.read('slow', () => {
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const queued = context.read('queued', () => Promise.resolve('done'));

    await vi.advanceTimersByTimeAsync(QUEUE_STALL_TIMEOUT_MS - 1);
    release();

    await expect(slow).resolves.toBeUndefined();
    await expect(queued).resolves.toBe('done');
  });

  it('names the operation on the error it wraps', async () => {
    const id = crypto.randomUUID();
    await repos.images.insert({ id, mimeType: 'image/png' });

    await expect(repos.images.insert({ id, mimeType: 'image/png' })).rejects.toMatchObject({
      operation: 'images.insert',
    });
  });
});
