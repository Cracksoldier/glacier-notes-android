import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
import { SettingsStore } from '../../core/preferences/settings.store';
import { NotebooksStore } from '../notebooks/notebooks.store';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import {
  faBars,
  faFileLines,
  faMagnifyingGlass,
  faPlus,
  faTableCells,
  faThumbtack,
} from '../../shared/utilities/glacier-icons';
import { NoteCardComponent } from './note-card.component';
import { NotesStore } from './notes.store';

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
    NoteCardComponent,
    RouterLink,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button [attr.aria-label]="i18n.t('a11y.openMenu')" />
        </ion-buttons>
        <ion-title>{{ title() }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            (click)="toggleLayout()"
            [attr.aria-label]="i18n.t('a11y.noteLayout')"
            [attr.aria-pressed]="settings.noteLayout() === 'grid'"
          >
            <fa-icon [icon]="settings.noteLayout() === 'grid' ? gridIcon : listIcon" />
          </ion-button>
          <ion-button routerLink="/search" [attr.aria-label]="i18n.t('a11y.searchNotes')">
            <fa-icon [icon]="searchIcon" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (isEmpty()) {
        <app-empty-state
          [icon]="emptyIcon"
          [title]="i18n.t('grid.noNotes')"
          [message]="notebookId() ? i18n.t('notebook.empty') : i18n.t('grid.noNotesHint')"
        />
      } @else {
        <div class="notes" [class.notes--grid]="settings.noteLayout() === 'grid'">
          @if (store.pinned().length) {
            <h2 class="notes__heading">
              <fa-icon [icon]="pinIcon" />
              {{ i18n.t('grid.pinned') }}
            </h2>
            <div class="notes__column">
              @for (note of store.pinned(); track note.id) {
                <app-note-card [note]="note" (click)="open(note.id)" />
              }
            </div>

            @if (store.unpinned().length) {
              <h2 class="notes__heading">{{ i18n.t('grid.others') }}</h2>
            }
          }

          <div class="notes__column">
            @for (note of store.unpinned(); track note.id) {
              <app-note-card [note]="note" (click)="open(note.id)" />
            }
          </div>
        </div>
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="create()" [attr.aria-label]="i18n.t('a11y.newNote')">
          <fa-icon [icon]="addIcon" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: `
    .notes {
      padding: 12px 12px 72px;
    }

    // The desktop's masonry (note-grid.scss): a fixed 240px column width lets the
    // browser pick the count, which on a phone is one and on a wide screen two or
    // more. No media query states a breakpoint because none is needed.
    .notes--grid .notes__column {
      columns: 240px;
      column-gap: 12px;
    }

    .notes__heading {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 10px;
      color: var(--color-text-muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .notes__heading:not(:first-child) {
      margin-top: 18px;
    }
  `,
})
export class NotesPage {
  readonly i18n = inject(I18nService);
  readonly settings = inject(SettingsStore);
  readonly store = inject(NotesStore);
  private readonly notebooks = inject(NotebooksStore);
  private readonly router = inject(Router);

  /** Bound from `notebooks/:notebookId`; absent on `/notes`, which spans every notebook. */
  readonly notebookId = input<string | undefined>(undefined);

  readonly emptyIcon = faFileLines;
  readonly searchIcon = faMagnifyingGlass;
  readonly addIcon = faPlus;
  readonly pinIcon = faThumbtack;
  readonly gridIcon = faTableCells;
  readonly listIcon = faBars;

  protected readonly isEmpty = computed(
    () => this.store.status() !== 'loading' && this.store.notes().length === 0,
  );

  /** Falls back to the id while the notebook list is still loading. */
  protected readonly title = computed(() => {
    const id = this.notebookId();
    return id ? (this.notebooks.find(id)?.name ?? '') : this.i18n.t('sidebar.notes');
  });

  constructor() {
    effect(() => {
      const id = this.notebookId();
      void this.store.setView(id ? { kind: 'notebook', notebookId: id } : { kind: 'active' });
      // No reader yet — the desktop restores the last sidebar selection at
      // launch, but this app opens on /notes and cold-starting into a notebook
      // would be surprising. Written so the value is truthful when one arrives.
      this.settings.setLastSelectedNotebookId(id ?? null);
    });
  }

  toggleLayout(): void {
    this.settings.setNoteLayout(this.settings.noteLayout() === 'grid' ? 'list' : 'grid');
  }

  open(id: string): void {
    void this.router.navigate(['/notes', id]);
  }

  async create(): Promise<void> {
    const note = await this.store.createTextNote();
    // `created` marks the note as this session's, so the editor knows it may
    // discard it if the user leaves without typing anything.
    await this.router.navigate(['/notes', note.id], { queryParams: { created: 1 } });
  }
}
