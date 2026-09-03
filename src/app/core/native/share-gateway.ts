import { InjectionToken } from '@angular/core';

export type ShareOutcome =
  | { status: 'shared' }
  /** The chooser was dismissed, or the receiver could not be determined. */
  | { status: 'dismissed' }
  /** Staging failed and nothing was offered to anything. */
  | { status: 'failed' };

export interface ShareTextInput {
  title: string;
  text: string;
  dialogTitle: string;
}

export interface ShareExportInput {
  fileName: string;
  contents: string;
}

/**
 * The Android share sheet, behind the same kind of seam as `DocumentGateway`.
 *
 * `shareExport` takes the export's *contents* and not a path: staging the
 * temporary file and sweeping it afterwards are this implementation's business,
 * and `ExportService` must not learn that a cache directory exists.
 */
export interface ShareGateway {
  shareText(input: ShareTextInput): Promise<ShareOutcome>;
  shareExport(input: ShareExportInput): Promise<ShareOutcome>;
  /** Drops any staged export. Runs at startup and before each new share. */
  sweep(): Promise<void>;
}

export const SHARE_GATEWAY = new InjectionToken<ShareGateway>('ShareGateway');
