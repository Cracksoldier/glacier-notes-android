// This file is replaced during a production build by `environment.prod.ts`
// (see the `fileReplacements` array in `angular.json`).
//
// That replacement is what keeps sql.js out of the APK: nothing reachable from
// `environment.prod.ts` references `sqljs.adapter.ts`, so it is never bundled.

import { Capacitor } from '@capacitor/core';

import { CapacitorSqliteAdapter } from '../app/core/database/capacitor-sqlite.adapter';
import type { DatabaseAdapter } from '../app/core/database/database-adapter';
import { SqlJsAdapter } from '../app/core/database/sqljs.adapter';

export const environment = {
  production: false,
};

/**
 * On a device — including a live-reload session against the emulator — this is
 * the real plugin, so development exercises the production code path. Only a
 * plain browser gets the in-memory engine.
 */
export function createDatabaseAdapter(): DatabaseAdapter {
  return Capacitor.isNativePlatform() ? new CapacitorSqliteAdapter() : new SqlJsAdapter();
}
