import { describe, expect, it } from 'vitest';

import {
  IMAGE_MIME_TYPES,
  IMAGE_REF_PATTERN,
  MAX_IMAGE_BYTES,
  referencedImageIds,
} from './image-asset';
import type { Note } from './note';

function noteWith(content: string, imageIds: string[] = []): Note {
  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    notebookId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
    type: 'text',
    title: '',
    content,
    imageIds,
    pinned: false,
    archived: false,
    labels: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('image constants', () => {
  it('includes GIF, which the Android specification omits', () => {
    expect([...IMAGE_MIME_TYPES].sort()).toEqual([
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });

  it('caps an image at 10 MiB, as the desktop validator does', () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('referencedImageIds', () => {
  it('unions the declared ids with those mentioned in Markdown', () => {
    const declared = '3f2504e0-4f89-41d3-9a0c-0305e82c3311';
    const mentioned = '3f2504e0-4f89-41d3-9a0c-0305e82c3312';
    const note = noteWith(`text ![a](glacier-img://${mentioned}) more`, [declared]);

    expect(referencedImageIds(note).sort()).toEqual([declared, mentioned].sort());
  });

  it('deduplicates an id that is both declared and mentioned', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3311';

    expect(referencedImageIds(noteWith(`![a](glacier-img://${id})`, [id]))).toEqual([id]);
  });

  it('finds every occurrence despite the pattern being global and shared', () => {
    const first = '3f2504e0-4f89-41d3-9a0c-0305e82c3311';
    const second = '3f2504e0-4f89-41d3-9a0c-0305e82c3312';
    const note = noteWith(`glacier-img://${first} glacier-img://${second}`);

    expect(referencedImageIds(note)).toHaveLength(2);
    // A stale lastIndex on the module-level /g regex would break the second call.
    expect(referencedImageIds(note)).toHaveLength(2);
    expect(IMAGE_REF_PATTERN.lastIndex).toBe(0);
  });

  it('returns nothing for a note with no images', () => {
    expect(referencedImageIds(noteWith('plain text'))).toEqual([]);
  });
});
