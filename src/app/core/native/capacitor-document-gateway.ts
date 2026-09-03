import type { DocumentGateway, OpenDocumentResult, SaveDocumentResult } from './document-gateway';
import { Documents, type DocumentsPlugin } from './documents.plugin';

const MIME_JSON = 'application/json';

/** The error code `DocumentsPlugin.java` rejects a file past its size cap with. */
const TOO_LARGE = 'too-large';

export class CapacitorDocumentGateway implements DocumentGateway {
  /**
   * The plugin is a parameter rather than a module reference because the Angular
   * unit-test builder refuses `vi.mock` on a relative import, and a Capacitor
   * plugin proxy cannot be spied on either — so this is the only seam a spec has.
   */
  constructor(private readonly plugin: DocumentsPlugin = Documents) {}

  async open(): Promise<OpenDocumentResult> {
    try {
      const response = await this.plugin.openDocument();
      if (response.cancelled || response.text === undefined) {
        return { status: 'cancelled' };
      }
      return { status: 'opened', document: { name: response.name ?? null, text: response.text } };
    } catch (error) {
      // Only the code is read. The message is the plugin's own constant today,
      // but it is the one value here that a future provider error could put a
      // path into, so it is never read, stored or logged.
      return codeOf(error) === TOO_LARGE ? { status: 'too-large' } : { status: 'failed' };
    }
  }

  async save(fileName: string, contents: string): Promise<SaveDocumentResult> {
    try {
      const response = await this.plugin.createDocument({
        fileName,
        mimeType: MIME_JSON,
        data: contents,
      });
      return response.cancelled
        ? { status: 'cancelled' }
        : { status: 'saved', name: response.name ?? null };
    } catch {
      return { status: 'failed' };
    }
  }
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}
