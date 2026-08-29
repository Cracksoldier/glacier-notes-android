import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { Note } from '../../core/models/note';
import { SettingsStore } from '../../core/preferences/settings.store';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { faTrashCan } from '../../shared/utilities/glacier-icons';
import { NoteListComponent } from '../notes/note-list.component';
import { NotePrompts } from '../notes/note-prompts';
import { NotesStore } from '../notes/notes.store';

@Component({
  selector: 'app-trash-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    FaIconComponent,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonNote,
    IonTitle,
    IonToolbar,
    NoteListComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button [attr.aria-label]="i18n.t('a11y.openMenu')" />
        </ion-buttons>
        <ion-title>{{ i18n.t('sidebar.trash') }}</ion-title>
        @if (store.notes().length) {
          <ion-buttons slot="end">
            <ion-button (click)="emptyTrash()" [attr.aria-label]="i18n.t('a11y.emptyTrash')">
              <fa-icon [icon]="trashIcon" />
            </ion-button>
          </ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (isEmpty()) {
        <app-empty-state
          [icon]="trashIcon"
          [title]="i18n.t('sidebar.trash')"
          [message]="i18n.t('grid.trashEmptyHint')"
        />
      } @else {
        @if (autoPurgeNotice(); as notice) {
          <ion-note class="trash__notice">{{ notice }}</ion-note>
        }
        <app-note-list
          [notes]="store.notes()"
          [grid]="settings.noteLayout() === 'grid'"
          [grouped]="false"
          (open)="open($event.id)"
          (actions)="showActions($event)"
        />
      }
    </ion-content>
  `,
  styles: `
    .trash__notice {
      display: block;
      padding: 12px 12px 0;
      font-size: 12px;
    }
  `,
})
export class TrashPage {
  readonly i18n = inject(I18nService);
  readonly settings = inject(SettingsStore);
  readonly store = inject(NotesStore);
  private readonly prompts = inject(NotePrompts);
  private readonly router = inject(Router);

  readonly trashIcon = faTrashCan;

  protected readonly isEmpty = computed(
    () => this.store.status() !== 'loading' && this.store.notes().length === 0,
  );

  /**
   * The desktop purges silently and never says so. Stating the window is the one
   * place a user can find out why a note vanished.
   */
  protected readonly autoPurgeNotice = computed(() => {
    const days = this.settings.trashAutoPurgeDays();
    return days > 0 ? this.i18n.t('trash.autoPurgeNotice', { days }) : '';
  });

  /** See `ArchivePage.ionViewWillEnter` for why this is not a constructor effect. */
  ionViewWillEnter(): void {
    void this.store.setView({ kind: 'trashed' });
  }

  open(id: string): void {
    void this.router.navigate(['/notes', id]);
  }

  showActions(note: Note): void {
    void this.prompts.actions(note, 'trashed');
  }

  emptyTrash(): void {
    void this.prompts.confirmEmptyTrash(this.store.notes().length);
  }
}
