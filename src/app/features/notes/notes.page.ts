import { ChangeDetectionStrategy, Component } from '@angular/core';
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
          <ion-menu-button aria-label="Open navigation menu" />
        </ion-buttons>
        <ion-title>Notes</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/search" aria-label="Search notes">
            <fa-icon [icon]="searchIcon" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-empty-state
        [icon]="emptyIcon"
        title="No notes yet"
        message="Notes appear here once the note store is in place."
      />

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button aria-label="New note" disabled="true">
          <fa-icon [icon]="addIcon" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
})
export class NotesPage {
  readonly emptyIcon = faFileLines;
  readonly searchIcon = faMagnifyingGlass;
  readonly addIcon = faPlus;
}
