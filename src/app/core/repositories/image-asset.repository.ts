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

  /** Every id in the table, for M10's startup orphan sweep. */
  listIds(): Promise<string[]> {
    return this.context.read('images.listIds', async (adapter) => {
      const rows = await adapter.query<{ id: string }>('SELECT id FROM image_assets');
      return rows.map((row) => row.id);
    });
  }

  /**
   * Which of `ids` no note references any more — the database-side twin of
   * `referencedImageIds()`, and the *only* thing allowed to authorize deleting
   * an image file.
   *
   * The two `NOT EXISTS` clauses are the two halves the model describes: the
   * `note_images` junction, and a bare `glacier-img://<id>` left in a body. The
   * `LIKE` mirrors the desktop's `content.includes(imageId)` and needs no
   * `ESCAPE`, since a UUID contains neither `%` nor `_`.
   *
   * This predicate and `referencedImageIds()` must move together, the same way
   * `compareActiveNotes` and the `ORDER BY` in `note-queries.ts` do.
   */
  unreferenced(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.context.read('images.unreferenced', async (adapter) => {
      const placeholders = ids.map(() => '?').join(', ');
      const rows = await adapter.query<{ id: string }>(
        `SELECT id FROM image_assets
          WHERE id IN (${placeholders})
            AND NOT EXISTS (SELECT 1 FROM note_images WHERE image_id = image_assets.id)
            AND NOT EXISTS (SELECT 1 FROM notes WHERE content LIKE '%' || image_assets.id || '%')`,
        [...ids],
      );
      return rows.map((row) => row.id);
    });
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
