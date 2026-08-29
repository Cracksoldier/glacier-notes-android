import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import { faTrashCan, faXmark } from '../../shared/utilities/glacier-icons';

/**
 * Full-screen image. Presentational only: it takes a resolved URL and reports
 * which button was pressed by dismissing with a role, so every decision about
 * what "remove" means stays in the editor. Same rule as the other overlays —
 * logic inside an Ionic overlay callback is unreachable from a spec.
 */
@Component({
  selector: 'app-image-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()" [attr.aria-label]="i18n.t('common.back')">
            <fa-icon [icon]="closeIcon" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ i18n.t('image.viewer') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            class="viewer__remove"
            (click)="dismiss('remove')"
            [attr.aria-label]="i18n.t('image.remove')"
          >
            <fa-icon [icon]="removeIcon" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="viewer">
        <img class="viewer__image" [src]="url()" [alt]="i18n.t('image.viewer')" />
      </div>
    </ion-content>
  `,
  styles: `
    .viewer {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: 12px;
    }

    .viewer__image {
      max-width: 100%;
      // Fits the whole image without cropping; the toolbar and the safe areas
      // are what the remaining height goes to.
      max-height: 80vh;
      object-fit: contain;
    }
  `,
})
export class ImageViewerComponent {
  readonly url = input.required<string>();

  protected readonly i18n = inject(I18nService);
  protected readonly closeIcon = faXmark;
  protected readonly removeIcon = faTrashCan;

  private readonly modal = inject(ModalController);

  protected dismiss(role?: string): void {
    void this.modal.dismiss(undefined, role);
  }
}
