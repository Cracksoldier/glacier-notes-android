import type { ImageFileStore } from './image-file-store';

/**
 * The dev server's and every spec's image storage. Deliberately in memory and
 * deliberately not persisted, for the reason `SqlJsAdapter` is: a browser-only
 * store that half-survives a reload would mislead more than it helps.
 *
 * `url()` answers with a `data:` URL, which `index.html`'s CSP allows.
 */
export class MemoryImageFileStore implements ImageFileStore {
  private readonly files = new Map<string, string>();

  init(): Promise<void> {
    return Promise.resolve();
  }

  write(id: string, base64: string, mimeType: string): Promise<void> {
    this.files.set(id, `data:${mimeType};base64,${base64}`);
    return Promise.resolve();
  }

  read(id: string): Promise<string | null> {
    const stored = this.files.get(id);
    // Stored as a whole `data:` URL so `url()` can be synchronous; the bytes
    // are everything past the comma.
    return Promise.resolve(stored === undefined ? null : stored.slice(stored.indexOf(',') + 1));
  }

  delete(id: string): Promise<void> {
    this.files.delete(id);
    return Promise.resolve();
  }

  list(): Promise<string[]> {
    return Promise.resolve([...this.files.keys()]);
  }

  url(id: string): string {
    return this.files.get(id) ?? '';
  }
}
