import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

import type { ImageFileStore } from './image-file-store';

const IMAGE_DIR = 'images';

/**
 * `Directory.Data` is `context.getFilesDir()` — application-private, readable by
 * nothing else on the device, and reachable without any storage permission. The
 * plugin's own manifest declares no permissions at all, so nothing enters the
 * merged manifest either.
 */
export class CapacitorImageFileStore implements ImageFileStore {
  private base = '';

  async init(): Promise<void> {
    try {
      await Filesystem.mkdir({ directory: Directory.Data, path: IMAGE_DIR, recursive: true });
    } catch {
      // Already there. The plugin rejects rather than treating mkdir as
      // idempotent, and there is nothing else to do about it.
    }
    const { uri } = await Filesystem.getUri({ directory: Directory.Data, path: IMAGE_DIR });
    this.base = uri.replace(/^file:\/\//, '');
  }

  async write(id: string, base64: string): Promise<void> {
    // No `encoding`: that is what tells the plugin the payload is base64 and
    // must be decoded to bytes rather than written as text.
    await Filesystem.writeFile({ directory: Directory.Data, path: this.path(id), data: base64 });
  }

  async delete(id: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ directory: Directory.Data, path: this.path(id) });
    } catch {
      // Already gone, which is the state the caller wanted.
    }
  }

  async list(): Promise<string[]> {
    try {
      const { files } = await Filesystem.readdir({ directory: Directory.Data, path: IMAGE_DIR });
      return files.map((file) => file.name);
    } catch {
      return [];
    }
  }

  /**
   * `<serverUrl>/_capacitor_file_/<absolute path>`, which the WebView streams
   * straight off disk. Same origin as the app document, so the CSP's
   * `img-src 'self'` already covers it — and unlike a `blob:` or `data:` URL it
   * moves no bytes across the bridge.
   */
  url(id: string): string {
    return Capacitor.convertFileSrc(`${this.base}/${id}`);
  }

  private path(id: string): string {
    return `${IMAGE_DIR}/${id}`;
  }
}
