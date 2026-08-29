import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '../models/image-asset';

/** Why an attachment was refused, or `undefined` when it was not. */
export type PickRejection = 'type' | 'size';

/**
 * Both limits come from the desktop (`electron/transfer-core.ts`, audit §1
 * delta 11), so an image attached here always survives a round trip through
 * `.glacier.json` back into the desktop app.
 *
 * The picker's `accept` filter is a hint the system dialog is free to ignore —
 * "Browse" reaches any file on some devices — so this is the check that counts.
 */
export function validatePick(file: { type: string; size: number }): PickRejection | undefined {
  if (!IMAGE_MIME_TYPES.has(file.type)) {
    return 'type';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'size';
  }
  return undefined;
}

/**
 * `ImageAsset.fileName` is optional and must be an absent key rather than an
 * empty string or `null`, per the model's contract.
 */
export function pickedFileName(name: string): string | undefined {
  const trimmed = name.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** The `data:` URL prefix a `FileReader` result carries, up to and including the comma. */
export function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? '' : dataUrl.slice(comma + 1);
}
