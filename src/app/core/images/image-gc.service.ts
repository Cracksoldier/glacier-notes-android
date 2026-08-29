import { Injectable, inject } from '@angular/core';

import { ImageAssetRepository } from '../repositories/image-asset.repository';
import { IMAGE_FILE_STORE } from './image-file-store';

/**
 * The single seam through which orphaned image ids reach the file system.
 *
 * Five places end with image ids that may no longer have a referent: discarding
 * an empty note, deleting one forever, emptying the trash, the startup
 * auto-purge, and removing an image from a note in the editor. Each hands them
 * here rather than deciding for itself, because "no longer referenced" is a
 * question about the whole collection — two notes can reference one image.
 *
 * The desktop's rule (`docs/desktop-audit.md` §6): unlink a file only when
 * `isImageReferenced()` is false, where referenced means the union of a note's
 * `imageIds` and any `glacier-img://` mention in its body.
 * `ImageAssetRepository.unreferenced()` answers exactly that.
 */
@Injectable({ providedIn: 'root' })
export class ImageGcService {
  private readonly images = inject(ImageAssetRepository);
  private readonly files = inject(IMAGE_FILE_STORE);

  /**
   * Row first, file second. The row is guarded by `note_images`'
   * `ON DELETE RESTRICT`, so a still-claimed image throws before anything
   * touches the disk; the reverse order would leave a row pointing at nothing.
   * A file that survives its row is collected by the next `sweep()`.
   */
  async collect(imageIds: readonly string[]): Promise<void> {
    for (const id of await this.images.unreferenced(imageIds)) {
      await this.images.delete(id);
      await this.files.delete(id);
    }
  }

  /**
   * Startup reconciliation, for the states no single operation can clean up:
   * an app killed between writing the bytes and saving the note that would have
   * referenced them, or between deleting a row and deleting its file.
   *
   * Deliberately one `try` around the whole thing. If the database cannot be
   * read the sweep must abort rather than continue with an empty id list, which
   * would read as "nothing is referenced" and delete every file on disk.
   */
  async sweep(): Promise<void> {
    try {
      await this.collect(await this.images.listIds());
      const known = new Set(await this.images.listIds());
      for (const id of await this.files.list()) {
        if (!known.has(id)) {
          await this.files.delete(id);
        }
      }
    } catch (error) {
      // Safe to log: ids and counts only, never note content or file names.
      console.error('[glacier] image sweep failed', error);
    }
  }
}
