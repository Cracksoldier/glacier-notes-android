import type { ExportDestination, ExportFileWriter, ExportWriteOutcome } from './export-file-writer';

/** The dev server's and every spec's export destination. */
export class MemoryExportFileWriter implements ExportFileWriter {
  readonly files = new Map<string, string>();
  /** Which button produced each file, so a spec can assert the destination. */
  readonly destinations = new Map<string, ExportDestination>();

  write(
    fileName: string,
    contents: string,
    destination: ExportDestination,
  ): Promise<ExportWriteOutcome> {
    this.files.set(fileName, contents);
    this.destinations.set(fileName, destination);
    return Promise.resolve('written');
  }
}
