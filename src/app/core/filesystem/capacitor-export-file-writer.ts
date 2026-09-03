import type { DocumentGateway } from '../native/document-gateway';
import type { ShareGateway } from '../native/share-gateway';
import type { ExportDestination, ExportFileWriter, ExportWriteOutcome } from './export-file-writer';

/**
 * Both real destinations, and nothing else.
 *
 * M12 wrote to `Directory.Data` as an internal harness; that is gone. A save
 * goes through `ACTION_CREATE_DOCUMENT`, so the file lands wherever the user
 * pointed the dialog and outlives an uninstall, and a share goes through the
 * system chooser. Neither needs a storage permission.
 *
 * A share is never `'cancelled'`: by the time the chooser is up the file has
 * been staged and offered, and the plugin's dismissal signal is not worth
 * trusting — it rejects on `RESULT_CANCELED && !stopped`, so backgrounding the
 * app with the chooser open reports a later dismissal as a delivery. Only the
 * save dialog, which returns `RESULT_CANCELED` unambiguously, can be.
 */
export class CapacitorExportFileWriter implements ExportFileWriter {
  constructor(
    private readonly documents: DocumentGateway,
    private readonly shares: ShareGateway,
  ) {}

  async write(
    fileName: string,
    contents: string,
    destination: ExportDestination,
  ): Promise<ExportWriteOutcome> {
    if (destination === 'share') {
      const outcome = await this.shares.shareExport({ fileName, contents });
      if (outcome.status === 'failed') {
        throw new Error('share failed');
      }
      return 'written';
    }

    const result = await this.documents.save(fileName, contents);
    switch (result.status) {
      case 'saved':
        return 'written';
      case 'cancelled':
        return 'cancelled';
      case 'failed':
        throw new Error('save failed');
    }
  }
}
