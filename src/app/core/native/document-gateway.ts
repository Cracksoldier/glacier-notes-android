import { InjectionToken } from '@angular/core';

/** A picked document, once the platform difference is gone. */
export interface PickedDocument {
  /** `null` when the provider reports no display name. */
  name: string | null;
  text: string;
}

export type OpenDocumentResult =
  | { status: 'opened'; document: PickedDocument }
  | { status: 'cancelled' }
  | { status: 'too-large' }
  | { status: 'failed' };

export type SaveDocumentResult =
  | { status: 'saved'; name: string | null }
  | { status: 'cancelled' }
  | { status: 'failed' };

/**
 * The Storage Access Framework as the rest of the app is allowed to see it, for
 * the same reason `ImageFileStore` and `ExportFileWriter` exist: a plugin call
 * inside a service would make that service unrunnable under jsdom.
 *
 * Cancellation is a status and never a rejection. A dismissed picker is an
 * outcome rather than an error, and a rejected promise would force every caller
 * into a `catch` whose error object is the one value here that could carry a
 * provider path.
 */
export interface DocumentGateway {
  /** `ACTION_OPEN_DOCUMENT` on a device, `<input type="file">` in a browser. */
  open(): Promise<OpenDocumentResult>;
  /** `ACTION_CREATE_DOCUMENT` on a device, an `<a download>` blob in a browser. */
  save(fileName: string, contents: string): Promise<SaveDocumentResult>;
}

export const DOCUMENT_GATEWAY = new InjectionToken<DocumentGateway>('DocumentGateway');
