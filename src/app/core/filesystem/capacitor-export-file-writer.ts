import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

import type { ExportFileWriter } from './export-file-writer';

/**
 * `Directory.Data` is `context.getFilesDir()` — app-private and reachable with
 * no storage permission, which is the whole reason M12 can ship an exporter
 * without the document picker M14 owns. The file is retrievable over
 * `adb exec-out run-as` for verification and is not visible to a file manager.
 *
 * `Encoding.UTF8` is mandatory here and is the opposite of the image store's
 * deliberate omission of it: without it the plugin would read this JSON as
 * base64 and reject it.
 */
export class CapacitorExportFileWriter implements ExportFileWriter {
  async write(fileName: string, contents: string): Promise<void> {
    await Filesystem.writeFile({
      directory: Directory.Data,
      path: fileName,
      data: contents,
      encoding: Encoding.UTF8,
    });
  }
}
