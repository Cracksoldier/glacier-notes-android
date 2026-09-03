import type { ShareExportInput, ShareGateway, ShareOutcome, ShareTextInput } from './share-gateway';

const MIME_JSON = 'application/json';

/**
 * `navigator.share` where the browser has it, an `<a download>` otherwise. As
 * with `BrowserDocumentGateway` this exists so the dev server and jsdom have
 * something to run, not because a browser is a supported target.
 */
export class BrowserShareGateway implements ShareGateway {
  async shareText(input: ShareTextInput): Promise<ShareOutcome> {
    if (!navigator.share) {
      return { status: 'failed' };
    }
    try {
      await navigator.share({ title: input.title, text: input.text });
      return { status: 'shared' };
    } catch {
      return { status: 'dismissed' };
    }
  }

  shareExport(input: ShareExportInput): Promise<ShareOutcome> {
    const url = URL.createObjectURL(new Blob([input.contents], { type: MIME_JSON }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = input.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return Promise.resolve({ status: 'shared' });
  }

  /** Nothing is staged, so there is nothing to sweep. */
  sweep(): Promise<void> {
    return Promise.resolve();
  }
}
