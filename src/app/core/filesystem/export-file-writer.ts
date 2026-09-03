import { InjectionToken } from '@angular/core';

/** Where the user asked the export to go. There is a button for each. */
export type ExportDestination = 'save' | 'share';

/** A dismissed system dialog is an outcome, not a failure. */
export type ExportWriteOutcome = 'written' | 'cancelled';

/**
 * The seam through which an export reaches storage, for the same reason
 * `ImageFileStore` exists: a plugin call inside `ExportService` would make the
 * whole service unrunnable under jsdom.
 *
 * M14 filled it in. `CapacitorExportFileWriter` is now a dispatcher over the two
 * gateways in `core/native` — the Android save dialog and the share sheet — and
 * `ExportService` still knows nothing about either.
 */
export interface ExportFileWriter {
  /**
   * Puts UTF-8 text where `destination` says, under `fileName`. Resolves
   * `'cancelled'` when the user backed out of the system dialog, in which case
   * nothing was written and nothing failed. Rejects only when the write itself
   * failed, which the caller reports as a storage error.
   */
  write(
    fileName: string,
    contents: string,
    destination: ExportDestination,
  ): Promise<ExportWriteOutcome>;
}

export const EXPORT_FILE_WRITER = new InjectionToken<ExportFileWriter>('ExportFileWriter');
