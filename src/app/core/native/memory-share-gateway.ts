import type { ShareExportInput, ShareGateway, ShareOutcome, ShareTextInput } from './share-gateway';

/**
 * Records what was offered instead of offering it, in the shape
 * `MemoryExportFileWriter` established. What is worth asserting about a share is
 * the text that left the app, and there is no other way to see it: the real
 * gateway hands everything to an Android chooser.
 */
export class MemoryShareGateway implements ShareGateway {
  readonly texts: ShareTextInput[] = [];
  readonly exports: ShareExportInput[] = [];
  sweeps = 0;

  /** Set to make the next call report something other than a clean share. */
  outcome: ShareOutcome = { status: 'shared' };

  shareText(input: ShareTextInput): Promise<ShareOutcome> {
    this.texts.push(input);
    return Promise.resolve(this.outcome);
  }

  shareExport(input: ShareExportInput): Promise<ShareOutcome> {
    this.exports.push(input);
    return Promise.resolve(this.outcome);
  }

  sweep(): Promise<void> {
    this.sweeps++;
    return Promise.resolve();
  }
}
