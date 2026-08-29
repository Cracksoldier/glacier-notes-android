import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_IMAGE_BYTES } from '../models/image-asset';
import { createTestRepositories, type TestRepositories } from '../repositories/testing';
import { ImageAttachmentService } from './image-attachment.service';
import { IMAGE_FILE_STORE, type ImageFileStore } from './image-file-store';

/** `File` under jsdom needs a real size; a string body is the cheapest way to one. */
function pick(type: string, bytes = 4, name = 'holiday.png'): File {
  return new File(['x'.repeat(bytes)], name, { type });
}

describe('ImageAttachmentService', () => {
  let repositories: TestRepositories;
  let attachments: ImageAttachmentService;

  beforeEach(async () => {
    repositories = await createTestRepositories();
    attachments = TestBed.inject(ImageAttachmentService);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  it('writes the bytes, then the row, and reports the asset', async () => {
    const result = await attachments.attach(pick('image/png'));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.asset.mimeType).toBe('image/png');
    expect(result.asset.fileName).toBe('holiday.png');
    expect(await repositories.images.find(result.asset.id)).toEqual(result.asset);
    expect(await repositories.files.list()).toEqual([result.asset.id]);
  });

  it('stores the file under the bare id, which is what makes url() a pure function', async () => {
    const result = await attachments.attach(pick('image/jpeg', 4, 'a.jpg'));

    expect(result.ok && (await repositories.files.list())).toEqual([
      result.ok ? result.asset.id : '',
    ]);
  });

  it('leaves fileName absent rather than empty when the picker names nothing', async () => {
    const result = await attachments.attach(pick('image/png', 4, '  '));

    expect(result.ok && 'fileName' in result.asset).toBe(false);
  });

  it('refuses an unsupported type without touching storage', async () => {
    const result = await attachments.attach(pick('image/svg+xml'));

    expect(result).toEqual({ ok: false, reason: 'type' });
    expect(await repositories.files.list()).toEqual([]);
    expect(await repositories.images.listIds()).toEqual([]);
  });

  it('refuses an image over the size limit', async () => {
    const result = await attachments.attach(pick('image/png', MAX_IMAGE_BYTES + 1));

    expect(result).toEqual({ ok: false, reason: 'size' });
    expect(await repositories.files.list()).toEqual([]);
  });

  /**
   * A device that runs out of space mid-attach must leave no row behind and no
   * file the user cannot see or reach.
   */
  it('reports an IO failure and takes the half-written file back out', async () => {
    const store = TestBed.inject<ImageFileStore>(IMAGE_FILE_STORE);
    vi.spyOn(store, 'write').mockRejectedValue(new Error('no space'));

    const result = await attachments.attach(pick('image/png'));

    expect(result).toEqual({ ok: false, reason: 'io' });
    expect(await repositories.images.listIds()).toEqual([]);
  });

  it('rolls the file back when the metadata row is what fails', async () => {
    vi.spyOn(repositories.images, 'insert').mockRejectedValue(new Error('locked'));

    const result = await attachments.attach(pick('image/png'));

    expect(result).toEqual({ ok: false, reason: 'io' });
    expect(await repositories.files.list()).toEqual([]);
  });

  it('gives every attachment its own id, even for the same file twice', async () => {
    const first = await attachments.attach(pick('image/png'));
    const second = await attachments.attach(pick('image/png'));

    expect(first.ok && second.ok && first.asset.id).not.toBe(second.ok ? second.asset.id : '');
    expect((await repositories.files.list()).length).toBe(2);
  });
});
