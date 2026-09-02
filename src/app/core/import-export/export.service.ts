import { Injectable, inject } from '@angular/core';

import { EXPORT_FILE_WRITER } from '../filesystem/export-file-writer';
import { IMAGE_FILE_STORE } from '../images/image-file-store';
import { referencedImageIds } from '../models/image-asset';
import { CollectionRepository } from '../repositories/collection-snapshot';
import { ImageAssetRepository } from '../repositories/image-asset.repository';
import { validateEnvelope } from './envelope-validation';
import { exportFileName } from './export-filename';
import { collectExport, type ExportedImage, type ExportScope } from './transfer-contract';

// A type alias rather than an interface, so it keeps TypeScript's implicit index
// signature and can be passed straight to `I18nService.t()` as its params.
export type ExportCounts = {
  notebooks: number;
  notes: number;
  labels: number;
  images: number;
};

export type ExportResult =
  | { status: 'saved'; fileName: string; byteLength: number; counts: ExportCounts }
  | { status: 'missing-images'; imageCount: number }
  | { status: 'invalid'; errors: string[] }
  | { status: 'failed' };

/**
 * Produces a `.glacier.json` the desktop app can import unchanged.
 *
 * Nothing reaches storage until the whole envelope is in hand and has validated,
 * so a failure at any step leaves no file behind — there is no partial write to
 * clean up and no half-written export for the user to mistake for a backup.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly collection = inject(CollectionRepository);
  private readonly images = inject(ImageAssetRepository);
  private readonly files = inject(IMAGE_FILE_STORE);
  private readonly writer = inject(EXPORT_FILE_WRITER);

  /** The whole local collection, which is the only scope M12 offers. */
  exportAll(): Promise<ExportResult> {
    return this.export({ kind: 'all' });
  }

  private async export(scope: ExportScope): Promise<ExportResult> {
    let json: string;
    let counts: ExportCounts;
    try {
      const snapshot = await this.collection.snapshot();

      // `collectExport`'s `readImage` is synchronous, mirroring the desktop's
      // `fs.readFileSync`, so every image has to be resolved up front.
      const loaded = new Map<string, Omit<ExportedImage, 'id'>>();
      const missing: string[] = [];
      for (const note of snapshot.notes) {
        for (const id of referencedImageIds(note)) {
          if (loaded.has(id) || missing.includes(id)) continue;
          const asset = await this.images.find(id);
          const base64 = asset === undefined ? null : await this.files.read(id);
          if (asset === undefined || base64 === null) {
            missing.push(id);
            continue;
          }
          loaded.set(id, {
            mimeType: asset.mimeType,
            ...(asset.fileName !== undefined && { fileName: asset.fileName }),
            base64,
          });
        }
      }

      // The desktop skips an unreadable image and writes the file anyway, which
      // produces an envelope its own validator then rejects for a dangling
      // reference. Refusing here is the one deliberate deviation from it: a
      // backup that cannot be restored is worse than no backup.
      if (missing.length > 0) {
        return { status: 'missing-images', imageCount: missing.length };
      }

      const envelope = collectExport(scope, {
        notebooks: snapshot.notebooks,
        notes: snapshot.notes,
        labels: snapshot.labels,
        defaultNotebookId: snapshot.defaultNotebookId,
        readImage: (id) => loaded.get(id) ?? null,
      });

      // Self-check against the same validator the desktop applies on import, so
      // a contract regression fails here rather than on the user's desktop.
      const validation = validateEnvelope(envelope);
      if (!validation.ok) {
        return { status: 'invalid', errors: validation.errors };
      }

      json = JSON.stringify(envelope, null, 2);
      counts = {
        notebooks: envelope.notebooks.length,
        notes: envelope.notes.length,
        labels: envelope.labels.length,
        images: envelope.images.length,
      };
    } catch {
      // Never log the error: a filesystem message can carry a path, and a
      // database one can carry bound note text.
      return { status: 'failed' };
    }

    const fileName = exportFileName();
    try {
      await this.writer.write(fileName, json);
    } catch {
      return { status: 'failed' };
    }
    return { status: 'saved', fileName, byteLength: byteLength(json), counts };
  }
}

/** What lands on disk is UTF-8, so `String.length` would undercount every umlaut. */
function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
