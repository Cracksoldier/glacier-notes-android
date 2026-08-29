import { Injectable, inject } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';

import type { AttachFailure } from '../../core/images/image-attachment.service';
import { I18nService, type TranslationKey } from '../../core/localization/i18n.service';
import { ImageViewerComponent } from './image-viewer.component';

/**
 * The image viewer and its removal confirmation, raised the same way
 * `NotePrompts` raises the action sheet: the overlay collects an answer and the
 * caller decides what to do with it.
 *
 * The first `ModalController` use in the app. A modal rather than an alert
 * because the viewer needs the whole screen, and because Ionic wires Android's
 * hardware back button to dismiss it without any extra listener.
 */
@Injectable({ providedIn: 'root' })
export class ImagePrompts {
  private readonly i18n = inject(I18nService);
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);

  /** Resolves to `'remove'` when the user asked to remove the image, else `undefined`. */
  async viewImage(url: string): Promise<'remove' | undefined> {
    const modal = await this.modals.create({
      component: ImageViewerComponent,
      componentProps: { url },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role !== 'remove') {
      return undefined;
    }
    return (await this.confirmRemove()) ? 'remove' : undefined;
  }

  private async confirmRemove(): Promise<boolean> {
    const alert = await this.alerts.create({
      header: this.i18n.t('image.removeTitle'),
      message: this.i18n.t('image.removeHint'),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.delete'), role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }
}

/** Kept next to the prompts so the three failure paths stay visible in one place. */
export function attachFailureKey(reason: AttachFailure): TranslationKey {
  switch (reason) {
    case 'type':
      return 'image.unsupportedType';
    case 'size':
      return 'image.tooLarge';
    case 'io':
      return 'image.attachFailed';
  }
}
