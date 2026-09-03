import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';

/**
 * The one confirmation the import flow raises, in the shape `note-prompts.ts`
 * established: the overlay collects an answer and decides nothing, because an
 * Ionic overlay cannot be instantiated under jsdom and a branch taken inside one
 * is a branch no spec can reach.
 */
@Injectable({ providedIn: 'root' })
export class ImportPrompts {
  private readonly i18n = inject(I18nService);
  private readonly alerts = inject(AlertController);

  /**
   * Replace-existing-by-ID overwrites notes that are already here, and unlike
   * every other destructive action in the app there is no trash to recover them
   * from — the rows are purged and rewritten inside the import transaction.
   */
  async confirmReplace(): Promise<boolean> {
    const alert = await this.alerts.create({
      header: this.i18n.t('importExport.replaceWarningTitle'),
      message: this.i18n.t('importExport.replaceWarningHint'),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('importExport.importConfirm'), role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }
}
