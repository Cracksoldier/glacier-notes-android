import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImageAsset } from '../models/image-asset';
import { createTestRepositories, type TestRepositories } from '../repositories/testing';
import { ImageGcService } from './image-gc.service';

describe('ImageGcService', () => {
  let repositories: TestRepositories;
  let gc: ImageGcService;

  /** One stored image: metadata row plus bytes, exactly as an attach leaves it. */
  async function storeImage(id: string): Promise<ImageAsset> {
    const asset: ImageAsset = { id, mimeType: 'image/png' };
    await repositories.files.write(id, 'QUJD', asset.mimeType);
    await repositories.images.insert(asset);
    return asset;
  }

  async function noteWith(patch: { content?: string; imageIds?: string[] }): Promise<string> {
    const note = await repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
    });
    await repositories.notes.update(note.id, patch);
    return note.id;
  }

  beforeEach(async () => {
    repositories = await createTestRepositories();
    gc = TestBed.inject(ImageGcService);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  describe('collect', () => {
    it('deletes the row and the file of an image nothing points at', async () => {
      const asset = await storeImage('orphan');

      await gc.collect([asset.id]);

      expect(await repositories.images.find(asset.id)).toBeUndefined();
      expect(await repositories.files.list()).toEqual([]);
    });

    /** The half `note_images` knows about. */
    it('keeps an image a note declares in its imageIds', async () => {
      const asset = await storeImage('claimed');
      await noteWith({ imageIds: [asset.id] });

      await gc.collect([asset.id]);

      expect(await repositories.images.find(asset.id)).toBeDefined();
      expect(await repositories.files.list()).toEqual([asset.id]);
    });

    /**
     * The half the junction cannot see, and the reason deleting an image row is
     * `ON DELETE RESTRICT` rather than a cascade.
     */
    it('keeps an image mentioned only in a body', async () => {
      const asset = await storeImage('11111111-2222-3333-4444-555555555555');
      await noteWith({ content: `![a](glacier-img://${asset.id})` });

      await gc.collect([asset.id]);

      expect(await repositories.images.find(asset.id)).toBeDefined();
    });

    it('collects one image and leaves the other in the same pass', async () => {
      const kept = await storeImage('kept');
      const dropped = await storeImage('dropped');
      await noteWith({ imageIds: [kept.id] });

      await gc.collect([kept.id, dropped.id]);

      expect(await repositories.images.listIds()).toEqual([kept.id]);
      expect(await repositories.files.list()).toEqual([kept.id]);
    });

    it('does nothing when handed no ids', async () => {
      await storeImage('untouched');

      await gc.collect([]);

      expect(await repositories.files.list()).toEqual(['untouched']);
    });
  });

  describe('sweep', () => {
    it('collects an image whose note was purged while the app was closed', async () => {
      await storeImage('leftover');

      await gc.sweep();

      expect(await repositories.images.listIds()).toEqual([]);
      expect(await repositories.files.list()).toEqual([]);
    });

    /** A kill between deleting the row and unlinking the file leaves this. */
    it('deletes a file that has no metadata row', async () => {
      await repositories.files.write('ghost', 'QUJD', 'image/png');

      await gc.sweep();

      expect(await repositories.files.list()).toEqual([]);
    });

    it('leaves a referenced image and its file alone', async () => {
      const asset = await storeImage('in-use');
      await noteWith({ imageIds: [asset.id] });

      await gc.sweep();

      expect(await repositories.files.list()).toEqual([asset.id]);
    });

    /**
     * The whole sweep is one `try` for this: an unreadable database must abort
     * it, because an empty id list reads as "nothing is referenced" and would
     * take every file on the device with it.
     */
    it('aborts without deleting anything when the database cannot be read', async () => {
      await storeImage('safe');
      vi.spyOn(repositories.images, 'listIds').mockRejectedValue(new Error('closed'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await gc.sweep();

      expect(await repositories.files.list()).toEqual(['safe']);
    });
  });
});
