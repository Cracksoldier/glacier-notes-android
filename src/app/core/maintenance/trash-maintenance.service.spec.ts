import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '../database/database.service';
import { ImageGcService } from '../images/image-gc.service';
import { MemoryPreferencesAdapter } from '../preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../preferences/preferences-adapter';
import { SettingsStore } from '../preferences/settings.store';
import { createTestRepositories, type TestRepositories } from '../repositories/testing';
import { TrashMaintenanceService } from './trash-maintenance.service';

const DAY_MS = 86_400_000;

describe('TrashMaintenanceService', () => {
  let repositories: TestRepositories;
  let service: TrashMaintenanceService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    });
    repositories = await createTestRepositories();
    // `createTestRepositories` migrates the adapter itself; the service only
    // reads the status signal, which is otherwise stuck on 'initializing'.
    vi.spyOn(TestBed.inject(DatabaseService), 'status').mockReturnValue('ready');
    service = TestBed.inject(TrashMaintenanceService);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  /** Trashes a note and backdates its `deleted_at`, which no repository method does. */
  async function trashedDaysAgo(days: number): Promise<string> {
    const note = await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
    });
    await repositories.notes.trash(note.id);
    await repositories.adapter.run('UPDATE notes SET deleted_at = ? WHERE id = ?', [
      new Date(Date.now() - days * DAY_MS).toISOString(),
      note.id,
    ]);
    return note.id;
  }

  it('purges only what has outlived the window', async () => {
    const stale = await trashedDaysAgo(31);
    const fresh = await trashedDaysAgo(29);

    await service.runStartupPurge();

    expect(await repositories.notes.find(stale)).toBeUndefined();
    expect(await repositories.notes.find(fresh)).toBeDefined();
  });

  it('leaves an untrashed note alone however old it is', async () => {
    const kept = await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
    });
    await repositories.adapter.run('UPDATE notes SET updated_at = ? WHERE id = ?', [
      new Date(Date.now() - 900 * DAY_MS).toISOString(),
      kept.id,
    ]);

    await service.runStartupPurge();

    expect(await repositories.notes.find(kept.id)).toBeDefined();
  });

  it('purges nothing when the window is disabled', async () => {
    TestBed.inject(SettingsStore).setTrashAutoPurgeDays(0);
    const stale = await trashedDaysAgo(400);

    await service.runStartupPurge();

    expect(await repositories.notes.find(stale)).toBeDefined();
  });

  it('does not touch the database before it is ready', async () => {
    vi.spyOn(TestBed.inject(DatabaseService), 'status').mockReturnValue('error');
    const purge = vi.spyOn(repositories.notes, 'purgeExpired');

    await service.runStartupPurge();

    expect(purge).not.toHaveBeenCalled();
  });

  // A rejected initializer aborts bootstrap, and failing to delete an old note
  // is never worth a white screen.
  it('swallows a failure rather than rejecting the initializer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(repositories.notes, 'purgeExpired').mockRejectedValue(new Error('locked'));

    await expect(service.runStartupPurge()).resolves.toBeUndefined();
  });

  it('hands the freed image ids to the collector M10 will implement', async () => {
    const collect = vi.spyOn(TestBed.inject(ImageGcService), 'collect');
    await trashedDaysAgo(31);

    await service.runStartupPurge();

    expect(collect).toHaveBeenCalledWith([]);
  });
});
