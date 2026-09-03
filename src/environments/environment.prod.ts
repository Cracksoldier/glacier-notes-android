import { inject } from '@angular/core';

import { CapacitorSqliteAdapter } from '../app/core/database/capacitor-sqlite.adapter';
import type { DatabaseAdapter } from '../app/core/database/database-adapter';
import { CapacitorExportFileWriter } from '../app/core/filesystem/capacitor-export-file-writer';
import type { ExportFileWriter } from '../app/core/filesystem/export-file-writer';
import { CapacitorImageFileStore } from '../app/core/images/capacitor-image-file-store';
import type { ImageFileStore } from '../app/core/images/image-file-store';
import { CapacitorDocumentGateway } from '../app/core/native/capacitor-document-gateway';
import { CapacitorShareGateway } from '../app/core/native/capacitor-share-gateway';
import { DOCUMENT_GATEWAY, type DocumentGateway } from '../app/core/native/document-gateway';
import { SHARE_GATEWAY, type ShareGateway } from '../app/core/native/share-gateway';

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

export function createExportFileWriter(): ExportFileWriter {
  return new CapacitorExportFileWriter(inject(DOCUMENT_GATEWAY), inject(SHARE_GATEWAY));
}

export function createDocumentGateway(): DocumentGateway {
  return new CapacitorDocumentGateway();
}

export function createShareGateway(): ShareGateway {
  return new CapacitorShareGateway();
}
