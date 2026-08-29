import { Injectable, inject } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { ImageGcService } from '../images/image-gc.service';
import { SettingsStore } from '../preferences/settings.store';
import { NoteRepository } from '../repositories/note.repository';

/**
 * The desktop's startup trash purge (`electron/main.ts:266`, audit §6), ported
 * with its 30-day default and its `0 disables` escape hatch.
 *
 * It runs as an app initializer rather than from `DatabaseService.init()`,
 * which M04 requires to do nothing but open and migrate. Awaiting it here
 * reproduces the desktop's "before the UI is available" ordering, and the cost
 * is one indexed query over `idx_notes_trashed` that normally returns nothing.
 */
@Injectable({ providedIn: 'root' })
export class TrashMaintenanceService {
  private readonly database = inject(DatabaseService);
  private readonly settings = inject(SettingsStore);
  private readonly notes = inject(NoteRepository);
  private readonly imageGc = inject(ImageGcService);

  /**
   * Like the database initializer it cannot reject: this deletes notes, and a
   * failure to delete them is never worth blanking the screen over. The next
   * launch tries again.
   */
  async runStartupPurge(): Promise<void> {
    if (this.database.status() !== 'ready') {
      return;
    }
    try {
      await this.imageGc.collect(await this.notes.purgeExpired(this.settings.trashAutoPurgeDays()));
    } catch (error) {
      // Safe to log: ids and counts only, never note content.
      console.error('[glacier] trash auto-purge failed', error);
    }
  }
}
