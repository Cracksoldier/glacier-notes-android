import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentGateway, SaveDocumentResult } from '../native/document-gateway';
import type { ShareGateway, ShareOutcome } from '../native/share-gateway';
import { CapacitorExportFileWriter } from './capacitor-export-file-writer';

describe('CapacitorExportFileWriter', () => {
  const documents = {
    open: vi.fn(),
    save: vi.fn<DocumentGateway['save']>(),
  };
  const shares = {
    shareText: vi.fn(),
    shareExport: vi.fn<ShareGateway['shareExport']>(),
    sweep: vi.fn(),
  };
  const writer = new CapacitorExportFileWriter(documents, shares);

  beforeEach(() => {
    documents.save.mockReset();
    shares.shareExport.mockReset();
  });

  function saves(result: SaveDocumentResult): void {
    documents.save.mockResolvedValue(result);
  }

  function sharesAs(outcome: ShareOutcome): void {
    shares.shareExport.mockResolvedValue(outcome);
  }

  it('sends a save to the document gateway and a share to the share sheet', async () => {
    saves({ status: 'saved', name: 'e.glacier.json' });
    sharesAs({ status: 'shared' });

    await expect(writer.write('e.glacier.json', '{}', 'save')).resolves.toBe('written');
    expect(documents.save).toHaveBeenCalledWith('e.glacier.json', '{}');
    expect(shares.shareExport).not.toHaveBeenCalled();

    await expect(writer.write('e.glacier.json', '{}', 'share')).resolves.toBe('written');
    expect(shares.shareExport).toHaveBeenCalledWith({
      fileName: 'e.glacier.json',
      contents: '{}',
    });
  });

  it('reports a dismissed save dialog as cancelled rather than throwing', async () => {
    saves({ status: 'cancelled' });

    await expect(writer.write('e.glacier.json', '{}', 'save')).resolves.toBe('cancelled');
  });

  /**
   * The file is staged and offered before the chooser appears, so a dismissal
   * there still means the export itself succeeded — unlike a save, where nothing
   * was written at all.
   */
  it('counts a dismissed share chooser as written', async () => {
    sharesAs({ status: 'dismissed' });

    await expect(writer.write('e.glacier.json', '{}', 'share')).resolves.toBe('written');
  });

  it('throws on either kind of failure, so ExportService reports one', async () => {
    saves({ status: 'failed' });
    await expect(writer.write('e.glacier.json', '{}', 'save')).rejects.toThrow();

    sharesAs({ status: 'failed' });
    await expect(writer.write('e.glacier.json', '{}', 'share')).rejects.toThrow();
  });
});
