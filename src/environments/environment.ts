// This file is replaced during a production build by `environment.prod.ts`
// (see the `fileReplacements` array in `angular.json`).
//
// That replacement is what keeps sql.js out of the APK: nothing reachable from
// `environment.prod.ts` references `sqljs.adapter.ts`, so it is never bundled.

import { Capacitor } from '@capacitor/core';

import { CapacitorSqliteAdapter } from '../app/core/database/capacitor-sqlite.adapter';
import type { DatabaseAdapter } from '../app/core/database/database-adapter';
import { SqlJsAdapter } from '../app/core/database/sqljs.adapter';
import { CapacitorImageFileStore } from '../app/core/images/capacitor-image-file-store';
import type { ImageFileStore } from '../app/core/images/image-file-store';
import { MemoryImageFileStore } from '../app/core/images/memory-image-file-store';

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

/** Split for the same reason, and along the same line, as the database. */
export function createImageFileStore(): ImageFileStore {
  return Capacitor.isNativePlatform() ? new CapacitorImageFileStore() : new MemoryImageFileStore();
}
