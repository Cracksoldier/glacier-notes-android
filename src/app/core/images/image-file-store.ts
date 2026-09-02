import { InjectionToken } from '@angular/core';

/**
 * The whole surface the rest of the app is allowed to see of image bytes. Two
 * implementations exist — Capacitor's Filesystem on device, an in-memory map in
 * specs and on the plain dev server — and nothing above `core/images` may reach
 * past this interface to a plugin, for the same reason `DatabaseAdapter` exists.
 *
 * A file is named after its image id with no extension, which is the contract
 * `ImageAssetRepository` already documents. That is what lets `url()` be
 * synchronous and pure: a note card resolving three thumbnails must not have to
 * read `image_assets` first.
 */
export interface ImageFileStore {
  /** Creates the directory and resolves whatever `url()` needs. */
  init(): Promise<void>;

  /**
   * `mimeType` is only used by the in-memory store, which has no path to hand
   * out and answers with a `data:` URL instead. On device the bytes describe
   * themselves.
   */
  write(id: string, base64: string, mimeType: string): Promise<void>;

  /**
   * The bytes back out as bare base64 — no `data:` prefix, so it drops straight
   * into an export envelope's `base64` field. `null` when the file is gone,
   * which the exporter treats as a hard error rather than an omission.
   */
  read(id: string): Promise<string | null>;

  /** Succeeds when the file is already gone. */
  delete(id: string): Promise<void>;

  /** The ids currently on disk, for the startup orphan sweep. */
  list(): Promise<string[]>;

  /** Valid only after `init()`. Says nothing about whether the file exists. */
  url(id: string): string;
}

export const IMAGE_FILE_STORE = new InjectionToken<ImageFileStore>('ImageFileStore');
