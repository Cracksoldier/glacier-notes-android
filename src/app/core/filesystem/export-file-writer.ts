import { InjectionToken } from '@angular/core';

/**
 * The seam through which an export reaches storage, for the same reason
 * `ImageFileStore` exists: a plugin call inside `ExportService` would make the
 * whole service unrunnable under jsdom, and the write destination is exactly the
 * part M14 replaces.
 *
 * M12 writes app-private files as an internal harness. M14 owns the real
 * destination — the Android save dialog and the share sheet — and will add an
 * implementation here rather than changing `ExportService`.
 */
export interface ExportFileWriter {
  /**
   * Writes UTF-8 text under `fileName`, replacing any previous file of that
   * name, and answers with a human-readable location for the UI. Rejects when
   * the write fails, which the caller reports as a storage error.
   */
  write(fileName: string, contents: string): Promise<void>;
}

export const EXPORT_FILE_WRITER = new InjectionToken<ExportFileWriter>('ExportFileWriter');
