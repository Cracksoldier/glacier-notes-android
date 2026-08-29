import { Injectable } from '@angular/core';

/**
 * The single seam through which purged image ids reach the file system.
 *
 * M08 deletes notes in four places — discarding an empty note, deleting one
 * forever, emptying the trash, and the startup auto-purge — and each ends with
 * image ids that no longer have a referent. There are no image *files* until
 * M10, so this collects them and stops.
 *
 * It exists now rather than at M10 so those four call sites are written once.
 * M10 replaces the body; the desktop's rule for it is in
 * `docs/desktop-audit.md` §6 — unlink a file only when it still exists *and*
 * `isImageReferenced()` is false, where "referenced" is the union of a note's
 * `imageIds` and any `glacier-img://` mention in its body. That check must run
 * against the whole collection, since two notes can reference one image.
 */
@Injectable({ providedIn: 'root' })
export class ImageGcService {
  collect(imageIds: readonly string[]): Promise<void> {
    void imageIds;
    return Promise.resolve();
  }
}
