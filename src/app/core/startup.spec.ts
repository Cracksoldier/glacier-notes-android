import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { DATABASE_ADAPTER } from './database/database-adapter';
import { NodeSqliteAdapter } from './database/node-sqlite.adapter';
import { runMigrations } from './database/migrations/migration-runner';
import { IMAGE_FILE_STORE } from './images/image-file-store';
import { MemoryImageFileStore } from './images/memory-image-file-store';
import { MemoryPreferencesAdapter } from './preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from './preferences/preferences-adapter';
import { SETTINGS_STORAGE_KEY } from './preferences/settings.store';
import { provideStartup } from './startup';

const DAY_MS = 86_400_000;

describe('provideStartup', () => {
  let adapter: NodeSqliteAdapter;

  /** A trashed note, deleted `days` ago, written before the app ever starts. */
  async function seedTrashedNote(id: string, days: number): Promise<void> {
    const [notebook] = await adapter.query<{ id: string }>('SELECT id FROM notebooks');
    const when = new Date(Date.now() - days * DAY_MS).toISOString();
    await adapter.run(
      `INSERT INTO notes (id, notebook_id, type, title, content, created_at, updated_at, deleted_at)
       VALUES (?, ?, 'text', '', '', ?, ?, ?)`,
      [id, notebook?.id ?? '', when, when, when],
    );
  }

  beforeEach(async () => {
    adapter = new NodeSqliteAdapter();
    await adapter.open();
    await runMigrations(adapter);
  });

  /**
   * The regression this file exists for. Angular starts every initializer
   * before awaiting any of them, so a purge registered after the database
   * initializer still observed a database reporting `initializing` and settings
   * still holding their defaults — and silently deleted nothing.
   *
   * A seven-day window over a note trashed ten days ago fails under either
   * half of that: an unopened database purges nothing, and unloaded settings
   * leave the default thirty-day window, which keeps the note.
   */
  it('purges expired trash against the stored window, not the defaults', async () => {
    await seedTrashedNote('stale', 10);
    await seedTrashedNote('fresh', 3);
    TestBed.configureTestingModule({
      providers: [
        { provide: DATABASE_ADAPTER, useValue: adapter },
        { provide: IMAGE_FILE_STORE, useValue: new MemoryImageFileStore() },
        {
          provide: PREFERENCES_ADAPTER,
          useValue: new MemoryPreferencesAdapter({
            [SETTINGS_STORAGE_KEY]: JSON.stringify({ trashAutoPurgeDays: 7 }),
          }),
        },
        provideStartup(),
      ],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;

    const remaining = await adapter.query<{ id: string }>('SELECT id FROM notes ORDER BY id');
    expect(remaining).toEqual([{ id: 'fresh' }]);
  });
});
