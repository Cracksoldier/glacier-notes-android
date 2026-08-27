import type { Note } from './note';

/**
 * Desktop `ImageAsset` (`electron/storage/models.ts`) — no note back-reference,
 * no size, no timestamp (`docs/desktop-audit.md` §1 delta 8). The bytes live in
 * app-private files; only this metadata is stored relationally.
 */
export interface ImageAsset {
  id: string;
  mimeType: string;
  /** Absent, never null, when the original filename is unknown. */
  fileName?: string;
}

/** GIF is included — the Android specification omits it (§1 delta 11). */
export const IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** `electron/transfer-core.ts:58`. */
export const IMAGE_REF_PATTERN = /glacier-img:\/\/([0-9a-f-]{36})/g;

/**
 * An image counts as referenced if it is listed in `imageIds` **or** merely
 * mentioned in the Markdown body. Both halves matter: the relational
 * `note_images` junction only knows about the first, which is why deleting an
 * image row is `ON DELETE RESTRICT` rather than a cascade.
 */
export function referencedImageIds(note: Note): string[] {
  const ids = new Set(note.imageIds);
  for (const match of note.content.matchAll(IMAGE_REF_PATTERN)) {
    ids.add(match[1]);
  }
  return [...ids];
}
