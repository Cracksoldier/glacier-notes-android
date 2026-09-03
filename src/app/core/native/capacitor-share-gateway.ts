import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import type { ShareExportInput, ShareGateway, ShareOutcome, ShareTextInput } from './share-gateway';

/**
 * Under `Directory.Cache`, which `res/xml/file_paths.xml` already maps with
 * `<cache-path path="." />` — the authority `@capacitor/share` resolves a
 * `file:` URL through is `${applicationId}.fileprovider`, which the manifest
 * already declares. Neither file needs a change.
 */
const SHARE_DIR = 'share';

export class CapacitorShareGateway implements ShareGateway {
  async shareText(input: ShareTextInput): Promise<ShareOutcome> {
    try {
      await Share.share({
        title: input.title,
        text: input.text,
        dialogTitle: input.dialogTitle,
      });
      return { status: 'shared' };
    } catch {
      // The Android plugin rejects with "Share canceled" on dismissal. The
      // message is never read: a FileProvider misconfiguration rejects through
      // the same path with a message containing an absolute path.
      return { status: 'dismissed' };
    }
  }

  async shareExport(input: ShareExportInput): Promise<ShareOutcome> {
    let uri: string;
    try {
      // Sweeping first, not last: see `sweep()`.
      await this.sweep();
      await this.ensureDir();
      const path = `${SHARE_DIR}/${input.fileName}`;
      await Filesystem.writeFile({
        directory: Directory.Cache,
        path,
        data: input.contents,
        // Without it the plugin treats the JSON as base64 — the same trap
        // `CapacitorImageFileStore` documents from the other direction.
        encoding: Encoding.UTF8,
      });
      ({ uri } = await Filesystem.getUri({ directory: Directory.Cache, path }));
    } catch {
      // A separate try from the share below: staging having failed means nothing
      // was offered at all, which must not be reported as a dismissal.
      return { status: 'failed' };
    }

    try {
      // A `file:` URL is all `@capacitor/share` accepts; it converts it itself
      // via `FileProvider.getUriForFile`. No `dialogTitle`: Android's own
      // chooser title is already localized, and this layer has no `I18nService`.
      await Share.share({ files: [uri] });
      return { status: 'shared' };
    } catch {
      return { status: 'dismissed' };
    }
  }

  /**
   * Called before a share and at startup, never after one.
   *
   * The receiving app's URI grant outlives the chooser: a mail client reads the
   * stream when the user hits Send, minutes later. Deleting when `Share.share()`
   * resolves therefore corrupts exactly the case the feature exists for, and
   * there is no callback that means "the receiver has finished" — the chosen
   * component is reported when it is *chosen*. A timer would be arbitrary and
   * would not survive process death. Sweeping at each entry instead bounds the
   * file's life to the next share or the next launch, never leaves more than
   * one, and cannot race a reader.
   */
  async sweep(): Promise<void> {
    let names: string[];
    try {
      const { files } = await Filesystem.readdir({ directory: Directory.Cache, path: SHARE_DIR });
      names = files.map((file) => file.name);
    } catch {
      // No directory yet, which is the state the caller wanted.
      return;
    }
    for (const name of names) {
      try {
        await Filesystem.deleteFile({
          directory: Directory.Cache,
          path: `${SHARE_DIR}/${name}`,
        });
      } catch {
        // The next sweep tries again.
      }
    }
  }

  private async ensureDir(): Promise<void> {
    try {
      await Filesystem.mkdir({ directory: Directory.Cache, path: SHARE_DIR, recursive: true });
    } catch {
      // Already there. The plugin rejects rather than treating mkdir as
      // idempotent, exactly as `CapacitorImageFileStore.init()` notes.
    }
  }
}
