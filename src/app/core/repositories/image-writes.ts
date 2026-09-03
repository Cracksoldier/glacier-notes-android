import type { DatabaseAdapter } from '../database/database-adapter';
import { imageAssetToRow } from '../database/row-mapper';
import type { ImageAsset } from '../models/image-asset';

/**
 * Image **metadata** writes as plain functions, opening no transaction — same
 * contract as `note-writes.ts`. The bytes are the file store's, and the file is
 * always written before the row so the two never disagree about what exists.
 */

export async function insertImageAsset(adapter: DatabaseAdapter, asset: ImageAsset): Promise<void> {
  const row = imageAssetToRow(asset);
  await adapter.run('INSERT INTO image_assets (id, mime_type, file_name) VALUES (?, ?, ?)', [
    row.id,
    row.mime_type,
    row.file_name,
  ]);
}

/**
 * Fails while any note still declares the image: `note_images.image_id` is
 * `ON DELETE RESTRICT`. That is deliberate — the junction cannot see images
 * referenced only as `glacier-img://` in a body, so it must not be allowed to
 * decide on its own that a file is unused.
 */
export async function deleteImageAsset(adapter: DatabaseAdapter, id: string): Promise<void> {
  await adapter.run('DELETE FROM image_assets WHERE id = ?', [id]);
}
