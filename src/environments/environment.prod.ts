import { CapacitorSqliteAdapter } from '../app/core/database/capacitor-sqlite.adapter';
import type { DatabaseAdapter } from '../app/core/database/database-adapter';
import { CapacitorImageFileStore } from '../app/core/images/capacitor-image-file-store';
import type { ImageFileStore } from '../app/core/images/image-file-store';

export const environment = {
  production: true,
};

/**
 * Deliberately has no browser fallback. A release build only ever runs inside
 * the Android WebView, and an in-memory database that silently loses every note
 * on reload is the worst possible failure mode to ship.
 */
export function createDatabaseAdapter(): DatabaseAdapter {
  return new CapacitorSqliteAdapter();
}

/** No fallback either, and for the same reason. */
export function createImageFileStore(): ImageFileStore {
  return new CapacitorImageFileStore();
}
