import { describe, expect, it } from 'vitest';

import { LATEST_VERSION } from './migrations';
import { runMigrations } from './migrations/migration-runner';
import { SqlJsAdapter } from './sqljs.adapter';

// The dev-server backend is otherwise unexercised — specs run on `node:sqlite`
// and the device runs the plugin — so a break here would only surface as a
// broken `npm start`.
describe('SqlJsAdapter', () => {
  it('runs the real schema, so the dev server behaves like the device', async () => {
    const adapter = new SqlJsAdapter();
    await adapter.open();
    await runMigrations(adapter);

    expect(await adapter.query('SELECT name FROM notebooks')).toEqual([{ name: 'Notes' }]);
    expect(await adapter.query('PRAGMA user_version')).toEqual([{ user_version: LATEST_VERSION }]);
  });

  it('holds nothing across instances, so it cannot be mistaken for storage', async () => {
    const first = new SqlJsAdapter();
    await first.open();
    await runMigrations(first);

    const second = new SqlJsAdapter();
    await second.open();

    expect(await second.query("SELECT name FROM sqlite_schema WHERE name = 'notebooks'")).toEqual(
      [],
    );
  });

  it('rejects rather than throwing synchronously when it is not open', async () => {
    await expect(new SqlJsAdapter().query('SELECT 1')).rejects.toThrow('Database is not open');
  });
});
