import { CapacitorException, ExceptionCode, registerPlugin } from '@capacitor/core';

/** Mirrors `DocumentsPlugin.java`'s `openDocument` response. */
export interface OpenDocumentResponse {
  cancelled: boolean;
  /** `OpenableColumns.DISPLAY_NAME`; absent when the provider has none. */
  name?: string;
  /** Absent when cancelled. */
  text?: string;
}

export interface CreateDocumentOptions {
  fileName: string;
  mimeType?: string;
  data: string;
}

export interface CreateDocumentResponse {
  cancelled: boolean;
  name?: string;
}

export interface DocumentsPlugin {
  openDocument(): Promise<OpenDocumentResponse>;
  createDocument(options: CreateDocumentOptions): Promise<CreateDocumentResponse>;
}

/**
 * Rejects rather than answering `{ cancelled: true }` on purpose: a silent
 * cancellation in a browser would hide a factory that picked the native gateway
 * off the device, which is exactly the mistake this fallback exists to catch.
 */
class UnavailableDocuments implements DocumentsPlugin {
  openDocument(): Promise<OpenDocumentResponse> {
    return Promise.reject(unavailable());
  }

  createDocument(): Promise<CreateDocumentResponse> {
    return Promise.reject(unavailable());
  }
}

function unavailable(): CapacitorException {
  return new CapacitorException('Documents is native-only', ExceptionCode.Unavailable);
}

export const Documents = registerPlugin<DocumentsPlugin>('Documents', {
  web: () => new UnavailableDocuments(),
});
