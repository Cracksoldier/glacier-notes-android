import { Injectable, inject } from '@angular/core';

import type { ImageAsset } from '../models/image-asset';
import { ImageAssetRepository } from '../repositories/image-asset.repository';
import { IMAGE_FILE_STORE } from './image-file-store';
import {
  base64FromDataUrl,
  type PickRejection,
  pickedFileName,
  validatePick,
} from './image-picking';

export type AttachFailure = PickRejection | 'io';

export type AttachResult = { ok: true; asset: ImageAsset } | { ok: false; reason: AttachFailure };

/**
 * Turns a file the system picker handed the WebView into a stored image.
 *
 * The order is fixed: bytes, then metadata row, then — by the caller — the note
 * patch that references it. `note_images.image_id` is `ON DELETE RESTRICT`, so a
 * junction row can never precede the asset row it points at, and a file always
 * exists before anything claims it does.
 */
@Injectable({ providedIn: 'root' })
export class ImageAttachmentService {
  private readonly files = inject(IMAGE_FILE_STORE);
  private readonly images = inject(ImageAssetRepository);

  async attach(file: File): Promise<AttachResult> {
    const rejection = validatePick(file);
    if (rejection) {
      return { ok: false, reason: rejection };
    }

    const fileName = pickedFileName(file.name);
    const asset: ImageAsset = {
      id: crypto.randomUUID(),
      mimeType: file.type,
      ...(fileName !== undefined && { fileName }),
    };

    try {
      await this.files.write(asset.id, await readAsBase64(file), asset.mimeType);
      await this.images.insert(asset);
    } catch {
      // Nothing is logged: the message could carry the file name, and a partial
      // write leaves at most one orphan file, which the startup sweep collects.
      await this.files.delete(asset.id);
      return { ok: false, reason: 'io' };
    }

    return { ok: true, asset };
  }
}

/**
 * `FileReader` rather than `btoa` over a spread `Uint8Array`: a 10 MB image is
 * ten million arguments, which overflows the call stack.
 */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => resolve(base64FromDataUrl(String(reader.result)));
    reader.readAsDataURL(file);
  });
}
