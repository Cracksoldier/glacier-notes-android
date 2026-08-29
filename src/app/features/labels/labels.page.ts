import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { Label } from '../../core/models/label';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { faEllipsisVertical, faPlus, faTag } from '../../shared/utilities/glacier-icons';
import { LabelPrompts } from './label-prompts';
import { LabelsStore } from './labels.store';

@Component({
  selector: 'app-labels-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    FaIconComponent,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button [attr.aria-label]="i18n.t('a11y.openMenu')" />
        </ion-buttons>
        <ion-title>{{ i18n.t('sidebar.labels') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (store.labels().length === 0) {
        <app-empty-state [icon]="tagIcon" [title]="i18n.t('label.none')" />
      } @else {
        <ion-list [inset]="true">
          @for (label of store.labels(); track label.id) {
            <ion-item button="true" (click)="open(label)">
              <fa-icon slot="start" [icon]="tagIcon" />
              <ion-label>{{ label.name }}</ion-label>
              <ion-button
                slot="end"
                fill="clear"
                (click)="showActions(label, $event)"
                [attr.aria-label]="i18n.t('a11y.labelActions')"
              >
                <fa-icon [icon]="actionsIcon" />
              </ion-button>
            </ion-item>
          }
        </ion-list>
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="create()" [attr.aria-label]="i18n.t('a11y.newLabel')">
          <fa-icon [icon]="addIcon" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
})
export class LabelsPage {
  readonly i18n = inject(I18nService);
  readonly store = inject(LabelsStore);
  private readonly prompts = inject(LabelPrompts);
  private readonly router = inject(Router);

  readonly tagIcon = faTag;
  readonly addIcon = faPlus;
  readonly actionsIcon = faEllipsisVertical;

  open(label: Label): void {
    void this.router.navigate(['/labels', label.id]);
  }

  showActions(label: Label, event: Event): void {
    // Without this the row's own click fires as well and navigates away
    // underneath the sheet.
    event.stopPropagation();
    void this.prompts.actions(label);
  }

  create(): void {
    void this.prompts.create();
  }
}
