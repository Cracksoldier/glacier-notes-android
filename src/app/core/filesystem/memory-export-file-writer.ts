import type { ExportFileWriter } from './export-file-writer';

/** The dev server's and every spec's export destination. */
export class MemoryExportFileWriter implements ExportFileWriter {
  readonly files = new Map<string, string>();

  write(fileName: string, contents: string): Promise<void> {
    this.files.set(fileName, contents);
    return Promise.resolve();
  }
}
