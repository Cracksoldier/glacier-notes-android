import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseAdapter } from './database-adapter';
import { DATABASE_ADAPTER } from './database-adapter';
import { DatabaseService } from './database.service';
import { NodeSqliteAdapter } from './node-sqlite.adapter';

function provideAdapter(adapter: DatabaseAdapter): DatabaseService {
  TestBed.configureTestingModule({
    providers: [{ provide: DATABASE_ADAPTER, useValue: adapter }],
  });
  return TestBed.inject(DatabaseService);
}

describe('DatabaseService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('starts out initializing, before anything has been opened', () => {
    const service = provideAdapter(new NodeSqliteAdapter());

    expect(service.status()).toBe('initializing');
    expect(service.error()).toBeNull();
  });

  it('opens and migrates, reporting ready', async () => {
    const adapter = new NodeSqliteAdapter();
    const service = provideAdapter(adapter);

    await service.init();

    expect(service.status()).toBe('ready');
    const notebooks = await adapter.query<{ name: string }>('SELECT name FROM notebooks');
    expect(notebooks).toEqual([{ name: 'Notes' }]);
  });

  it('records a failure instead of rejecting, so bootstrap still completes', async () => {
    const broken: DatabaseAdapter = {
      open: () => Promise.reject(new Error('disk is on fire')),
      close: () => Promise.resolve(),
      execute: () => Promise.resolve(),
      run: () => Promise.resolve(),
      query: () => Promise.resolve([]),
      beginTransaction: () => Promise.resolve(),
      commitTransaction: () => Promise.resolve(),
      rollbackTransaction: () => Promise.resolve(),
    };
    const service = provideAdapter(broken);

    // An app initializer that rejects aborts bootstrap and leaves a blank screen.
    await expect(service.init()).resolves.toBeUndefined();

    expect(service.status()).toBe('error');
    expect(service.error()).toBe('disk is on fire');
  });

  it('leaves an unmigratable database untouched rather than recreating it', async () => {
    const adapter = new NodeSqliteAdapter();
    await adapter.open();
    await adapter.execute([
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT',
      "INSERT INTO schema_migrations VALUES (99, 'from-the-future', '2027-01-01T00:00:00.000Z')",
      'CREATE TABLE precious (id TEXT PRIMARY KEY) STRICT',
      "INSERT INTO precious VALUES ('keep me')",
    ]);
    const service = provideAdapter(adapter);

    await service.init();

    expect(service.status()).toBe('error');
    const rows = await adapter.query<{ id: string }>('SELECT id FROM precious');
    expect(rows).toEqual([{ id: 'keep me' }]);
  });
});
