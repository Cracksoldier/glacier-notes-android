import { describe, expect, it } from 'vitest';

import { MemoryImageFileStore } from './memory-image-file-store';

describe('MemoryImageFileStore', () => {
  it('hands back a data URL carrying the media type it was written with', async () => {
    const store = new MemoryImageFileStore();
    await store.write('a', 'QUJD', 'image/png');

    expect(store.url('a')).toBe('data:image/png;base64,QUJD');
  });

  it('answers with an empty string for an id it has never seen', () => {
    expect(new MemoryImageFileStore().url('missing')).toBe('');
  });

  it('lists what it holds and forgets what it deletes', async () => {
    const store = new MemoryImageFileStore();
    await store.write('a', 'QQ==', 'image/png');
    await store.write('b', 'Qg==', 'image/png');
    await store.delete('a');

    expect(await store.list()).toEqual(['b']);
    expect(store.url('a')).toBe('');
  });

  /** The sweep deletes files it may already have deleted; that must not throw. */
  it('tolerates deleting an id that is not there', async () => {
    await expect(new MemoryImageFileStore().delete('missing')).resolves.toBeUndefined();
  });
});
