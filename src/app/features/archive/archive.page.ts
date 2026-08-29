import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { Note } from '../../core/models/note';
import { SettingsStore } from '../../core/preferences/settings.store';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { faBoxArchive } from '../../shared/utilities/glacier-icons';
import { NoteListComponent } from '../notes/note-list.component';
import { NotePrompts } from '../notes/note-prompts';
import { NotesStore } from '../notes/notes.store';

/**
 * Its own page rather than a mode on `NotesPage`: the title, empty state, FAB
 * and card actions all differ, which as a flag would have been five conditionals
 * serving nothing but chrome. The list itself is shared as `NoteListComponent`.
 */
@Component({
  selector: 'app-archive-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    IonButtons,
    IonContent,
    IonHeader,
    IonMenuButton,
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
        <ion-title>{{ i18n.t('sidebar.archive') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (isEmpty()) {
        <app-empty-state
          [icon]="emptyIcon"
          [title]="i18n.t('sidebar.archive')"
          [message]="i18n.t('grid.nothingArchivedHint')"
        />
      } @else {
        <app-note-list
          [notes]="store.notes()"
          [grid]="settings.noteLayout() === 'grid'"
          (open)="open($event.id)"
          (actions)="showActions($event)"
        />
      }
    </ion-content>
  `,
})
export class ArchivePage {
  readonly i18n = inject(I18nService);
  readonly settings = inject(SettingsStore);
  readonly store = inject(NotesStore);
  private readonly prompts = inject(NotePrompts);
  private readonly router = inject(Router);

  readonly emptyIcon = faBoxArchive;

  protected readonly isEmpty = computed(
    () => this.store.status() !== 'loading' && this.store.notes().length === 0,
  );

  /**
   * Not a constructor effect: Ionic caches the page, so an effect with nothing
   * to depend on would run once and leave a re-entered archive showing whichever
   * view the previous page selected.
   */
  ionViewWillEnter(): void {
    void this.store.setView({ kind: 'archived' });
  }

  open(id: string): void {
    void this.router.navigate(['/notes', id]);
  }

  showActions(note: Note): void {
    void this.prompts.actions(note, 'archived');
  }
}
