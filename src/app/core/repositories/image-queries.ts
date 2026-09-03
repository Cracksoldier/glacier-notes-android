import type { DatabaseAdapter } from '../database/database-adapter';
import { imageAssetFromRow } from '../database/row-mapper';
import type { ImageAssetRow } from '../database/rows';
import type { ImageAsset } from '../models/image-asset';

/**
 * Image **metadata** reads as plain functions, opening no transaction, so M13's
 * import can ask what already exists from inside its single `write()`.
 */

export async function queryImageAsset(
  adapter: DatabaseAdapter,
  id: string,
): Promise<ImageAsset | undefined> {
  const [row] = await adapter.query<ImageAssetRow>('SELECT * FROM image_assets WHERE id = ?', [id]);
  return row ? imageAssetFromRow(row) : undefined;
}

export async function queryImageAssetIds(adapter: DatabaseAdapter): Promise<string[]> {
  const rows = await adapter.query<{ id: string }>('SELECT id FROM image_assets');
  return rows.map((row) => row.id);
}

/**
 * Which of `ids` no note references any more — the database-side twin of
 * `referencedImageIds()`, and the *only* thing allowed to authorize deleting an
 * image file.
 *
 * The two `NOT EXISTS` clauses are the two halves the model describes: the
 * `note_images` junction, and a bare `glacier-img://<id>` left in a body. The
 * `LIKE` mirrors the desktop's `content.includes(imageId)` and needs no
 * `ESCAPE`, since a UUID contains neither `%` nor `_`.
 *
 * This predicate and `referencedImageIds()` must move together, the same way
 * `note-sort.ts` and the `ORDER BY` in `note-queries.ts` do.
 */
export async function queryUnreferencedImageIds(
  adapter: DatabaseAdapter,
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await adapter.query<{ id: string }>(
    `SELECT id FROM image_assets
      WHERE id IN (${placeholders})
        AND NOT EXISTS (SELECT 1 FROM note_images WHERE image_id = image_assets.id)
        AND NOT EXISTS (SELECT 1 FROM notes WHERE content LIKE '%' || image_assets.id || '%')`,
    [...ids],
  );
  return rows.map((row) => row.id);
}
