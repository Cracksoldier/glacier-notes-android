import type { DocumentGateway, OpenDocumentResult, SaveDocumentResult } from './document-gateway';

const MIME_JSON = 'application/json';
const ACCEPT = 'application/json,.json,.glacier.json';

/**
 * The dev server's half of the seam. It is a convenience — the device is the
 * contract — but it has to exist, because every spec runs under jsdom and
 * `Documents` is native-only.
 */
export class BrowserDocumentGateway implements DocumentGateway {
  async open(): Promise<OpenDocumentResult> {
    const file = await pickFile();
    if (file === null) {
      return { status: 'cancelled' };
    }
    try {
      return { status: 'opened', document: { name: file.name, text: await readAsText(file) } };
    } catch {
      return { status: 'failed' };
    }
  }

  save(fileName: string, contents: string): Promise<SaveDocumentResult> {
    const url = URL.createObjectURL(new Blob([contents], { type: MIME_JSON }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    // A browser download reports nothing back, so this can only ever claim the
    // optimistic outcome.
    return Promise.resolve({ status: 'saved', name: fileName });
  }
}

/** Chromium fires `cancel` on a dismissed file input, which is its SAF-cancel. */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // No `capture` attribute, for the reason `docs/images.md` gives.
    input.accept = ACCEPT;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

/** `FileReader` rather than `Blob.text()`, matching `ImageAttachmentService`. */
function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}
