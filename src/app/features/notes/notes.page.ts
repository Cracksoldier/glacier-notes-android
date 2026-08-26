import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { faFileLines, faMagnifyingGlass, faPlus } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-notes-page',
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
    IonMenuButton,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button [attr.aria-label]="i18n.t('a11y.openMenu')" />
        </ion-buttons>
        <ion-title>{{ i18n.t('sidebar.notes') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/search" [attr.aria-label]="i18n.t('a11y.searchNotes')">
            <fa-icon [icon]="searchIcon" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-empty-state
        [icon]="emptyIcon"
        [title]="i18n.t('grid.noNotes')"
        [message]="i18n.t('grid.noNotesHint')"
      />

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button [attr.aria-label]="i18n.t('a11y.newNote')" disabled="true">
          <fa-icon [icon]="addIcon" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
})
export class NotesPage {
  readonly i18n = inject(I18nService);
  readonly emptyIcon = faFileLines;
  readonly searchIcon = faMagnifyingGlass;
  readonly addIcon = faPlus;
}
