import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CapacitorDocumentGateway } from './capacitor-document-gateway';

/**
 * What is worth asserting here is only the translation: that every shape the
 * native side can answer with becomes the right status, and that a rejection's
 * `message` is never carried into one.
 */
const plugin = {
  openDocument: vi.fn(),
  createDocument: vi.fn(),
};

describe('CapacitorDocumentGateway', () => {
  const gateway = new CapacitorDocumentGateway(plugin);

  beforeEach(() => {
    plugin.openDocument.mockReset();
    plugin.createDocument.mockReset();
  });

  describe('open', () => {
    it('carries the text and the display name through', async () => {
      plugin.openDocument.mockResolvedValue({
        cancelled: false,
        name: 'backup.glacier.json',
        text: '{"a":1}',
      });

      await expect(gateway.open()).resolves.toEqual({
        status: 'opened',
        document: { name: 'backup.glacier.json', text: '{"a":1}' },
      });
    });

    /** A provider need not implement `OpenableColumns.DISPLAY_NAME`. */
    it('reports a missing name as null rather than inventing one', async () => {
      plugin.openDocument.mockResolvedValue({ cancelled: false, text: '{}' });

      await expect(gateway.open()).resolves.toEqual({
        status: 'opened',
        document: { name: null, text: '{}' },
      });
    });

    it('reports a dismissed picker as a status, not a rejection', async () => {
      plugin.openDocument.mockResolvedValue({ cancelled: true });

      await expect(gateway.open()).resolves.toEqual({ status: 'cancelled' });
    });

    it('distinguishes a file past the size cap from any other failure', async () => {
      plugin.openDocument.mockRejectedValueOnce({
        code: 'too-large',
        message: '/storage/emulated',
      });
      await expect(gateway.open()).resolves.toEqual({ status: 'too-large' });

      plugin.openDocument.mockRejectedValueOnce({ code: 'read-failed' });
      await expect(gateway.open()).resolves.toEqual({ status: 'failed' });

      plugin.openDocument.mockRejectedValueOnce(new Error('/data/user/0/com.glacier.notes'));
      await expect(gateway.open()).resolves.toEqual({ status: 'failed' });
    });
  });

  describe('save', () => {
    it('sends the JSON MIME type and reports the name the provider gave it', async () => {
      plugin.createDocument.mockResolvedValue({ cancelled: false, name: 'export.glacier.json' });

      await expect(gateway.save('export.glacier.json', '{}')).resolves.toEqual({
        status: 'saved',
        name: 'export.glacier.json',
      });
      expect(plugin.createDocument).toHaveBeenCalledWith({
        fileName: 'export.glacier.json',
        mimeType: 'application/json',
        data: '{}',
      });
    });

    it('reports a dismissed save dialog as cancelled', async () => {
      plugin.createDocument.mockResolvedValue({ cancelled: true });

      await expect(gateway.save('export.glacier.json', '{}')).resolves.toEqual({
        status: 'cancelled',
      });
    });

    it('reports a write failure without surfacing the error', async () => {
      plugin.createDocument.mockRejectedValue(new Error('ENOSPC /storage/emulated/0/Download'));

      await expect(gateway.save('export.glacier.json', '{}')).resolves.toEqual({
        status: 'failed',
      });
    });
  });
});
