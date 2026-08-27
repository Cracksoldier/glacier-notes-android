import { Injectable, inject } from '@angular/core';

import { imageAssetFromRow, imageAssetToRow } from '../database/row-mapper';
import type { ImageAssetRow } from '../database/rows';
import type { ImageAsset } from '../models/image-asset';
import { RepositoryContext } from './repository-context';
import { EntityNotFoundError } from './repository-errors';

/**
 * Image **metadata** only. The bytes live in app-private files and are M10's;
 * this table exists so `note_images` has something to point at and so an export
 * can name a mime type without opening the file.
 *
 * There is no `create`: ids come from the caller, because the file is written
 * under `<id>` before the row exists and the two must agree.
 */
@Injectable({ providedIn: 'root' })
export class ImageAssetRepository {
  private readonly context = inject(RepositoryContext);

  find(id: string): Promise<ImageAsset | undefined> {
    return this.context.read('images.find', async (adapter) => {
      const [row] = await adapter.query<ImageAssetRow>('SELECT * FROM image_assets WHERE id = ?', [
        id,
      ]);
      return row ? imageAssetFromRow(row) : undefined;
    });
  }

  async get(id: string): Promise<ImageAsset> {
    const asset = await this.find(id);
    if (!asset) {
      throw new EntityNotFoundError('image', id);
    }
    return asset;
  }

  insert(asset: ImageAsset): Promise<void> {
    return this.context.write('images.insert', async (adapter) => {
      const row = imageAssetToRow(asset);
      await adapter.run('INSERT INTO image_assets (id, mime_type, file_name) VALUES (?, ?, ?)', [
        row.id,
        row.mime_type,
        row.file_name,
      ]);
    });
  }

  /**
   * Fails while any note still declares the image: `note_images.image_id` is
   * `ON DELETE RESTRICT`. That is deliberate — the junction cannot see images
   * referenced only as `glacier-img://` in a body, so it must not be allowed to
   * decide on its own that a file is unused.
   */
  delete(id: string): Promise<void> {
    return this.context.write('images.delete', async (adapter) => {
      await adapter.run('DELETE FROM image_assets WHERE id = ?', [id]);
    });
  }
}
