import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CapacitorShareGateway } from './capacitor-share-gateway';

const share = vi.hoisted(() => ({ share: vi.fn() }));
const fs = vi.hoisted(() => ({
  writeFile: vi.fn(),
  getUri: vi.fn(),
  readdir: vi.fn(),
  deleteFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('@capacitor/share', () => ({ Share: share }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: fs,
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));

describe('CapacitorShareGateway', () => {
  const gateway = new CapacitorShareGateway();

  beforeEach(() => {
    share.share.mockReset().mockResolvedValue(undefined);
    fs.writeFile.mockReset().mockResolvedValue(undefined);
    fs.getUri.mockReset().mockResolvedValue({ uri: 'file:///cache/share/e.glacier.json' });
    fs.readdir.mockReset().mockResolvedValue({ files: [] });
    fs.deleteFile.mockReset().mockResolvedValue(undefined);
    fs.mkdir.mockReset().mockResolvedValue(undefined);
  });

  it('shares a note as text without staging anything', async () => {
    await expect(
      gateway.shareText({ title: 'Trip', text: 'Trip\n\nmilk', dialogTitle: 'Share' }),
    ).resolves.toEqual({ status: 'shared' });

    expect(share.share).toHaveBeenCalledWith({
      title: 'Trip',
      text: 'Trip\n\nmilk',
      dialogTitle: 'Share',
    });
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  /**
   * The plugin rejects with "Share canceled" on dismissal, which is the common
   * case and not an error the user needs told about.
   */
  it('reports a dismissed chooser as dismissed', async () => {
    share.share.mockRejectedValue(new Error('Share canceled'));

    await expect(
      gateway.shareText({ title: '', text: 'body', dialogTitle: 'Share' }),
    ).resolves.toEqual({ status: 'dismissed' });
  });

  it('stages the export as UTF-8 and hands the share sheet its file URL', async () => {
    await expect(
      gateway.shareExport({ fileName: 'e.glacier.json', contents: '{"a":1}' }),
    ).resolves.toEqual({ status: 'shared' });

    expect(fs.writeFile).toHaveBeenCalledWith({
      directory: 'CACHE',
      path: 'share/e.glacier.json',
      data: '{"a":1}',
      encoding: 'utf8',
    });
    expect(share.share).toHaveBeenCalledWith({ files: ['file:///cache/share/e.glacier.json'] });
  });

  /**
   * Sweep before, never after: the receiver's URI grant outlives the chooser, so
   * deleting once `Share.share()` resolves would break the very case the feature
   * exists for.
   */
  it('deletes the previously staged file before staging the next one', async () => {
    fs.readdir.mockResolvedValue({ files: [{ name: 'old.glacier.json' }] });
    const order: string[] = [];
    fs.deleteFile.mockImplementation(() => {
      order.push('delete');
      return Promise.resolve();
    });
    fs.writeFile.mockImplementation(() => {
      order.push('write');
      return Promise.resolve();
    });

    await gateway.shareExport({ fileName: 'e.glacier.json', contents: '{}' });

    expect(fs.deleteFile).toHaveBeenCalledWith({
      directory: 'CACHE',
      path: 'share/old.glacier.json',
    });
    expect(order).toEqual(['delete', 'write']);
  });

  it('leaves nothing staged after a sweep', async () => {
    fs.readdir.mockResolvedValue({ files: [{ name: 'a' }, { name: 'b' }] });

    await gateway.sweep();

    expect(fs.deleteFile).toHaveBeenCalledTimes(2);
    expect(share.share).not.toHaveBeenCalled();
  });

  it('treats a missing share directory as nothing to sweep', async () => {
    fs.readdir.mockRejectedValue(new Error('ENOENT /data/user/0/com.glacier.notes/cache/share'));

    await expect(gateway.sweep()).resolves.toBeUndefined();
    expect(fs.deleteFile).not.toHaveBeenCalled();
  });

  /**
   * The distinction the two try blocks exist for: nothing was ever offered, so
   * calling this a dismissal would tell the user they changed their mind.
   */
  it('reports a staging failure as failed rather than dismissed', async () => {
    fs.writeFile.mockRejectedValue(new Error('ENOSPC'));

    await expect(
      gateway.shareExport({ fileName: 'e.glacier.json', contents: '{}' }),
    ).resolves.toEqual({ status: 'failed' });
    expect(share.share).not.toHaveBeenCalled();
  });
});
