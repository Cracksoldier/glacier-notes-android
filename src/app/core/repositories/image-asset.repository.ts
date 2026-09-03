import { Injectable, inject } from '@angular/core';

import type { ImageAsset } from '../models/image-asset';
import { queryImageAsset, queryImageAssetIds, queryUnreferencedImageIds } from './image-queries';
import { deleteImageAsset, insertImageAsset } from './image-writes';
import { RepositoryContext } from './repository-context';
import { EntityNotFoundError } from './repository-errors';

/**
 * Image **metadata** only. The bytes live in app-private files and are M10's;
 * this table exists so `note_images` has something to point at and so an export
 * can name a mime type without opening the file.
 *
 * There is no `create`: ids come from the caller, because the file is written
 * under `<id>` before the row exists and the two must agree.
 *
 * The statements themselves live in `image-queries.ts` and `image-writes.ts`, so
 * M13's import can compose them inside its own transaction; what this class adds
 * is the queue turn.
 */
@Injectable({ providedIn: 'root' })
export class ImageAssetRepository {
  private readonly context = inject(RepositoryContext);

  find(id: string): Promise<ImageAsset | undefined> {
    return this.context.read('images.find', (adapter) => queryImageAsset(adapter, id));
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
    return this.context.read('images.listIds', queryImageAssetIds);
  }

  /** See `queryUnreferencedImageIds` for why this predicate is load-bearing. */
  unreferenced(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.context.read('images.unreferenced', (adapter) =>
      queryUnreferencedImageIds(adapter, ids),
    );
  }

  insert(asset: ImageAsset): Promise<void> {
    return this.context.write('images.insert', (adapter) => insertImageAsset(adapter, asset));
  }

  delete(id: string): Promise<void> {
    return this.context.write('images.delete', (adapter) => deleteImageAsset(adapter, id));
  }
}
