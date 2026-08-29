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
import type { Note } from '../../core/models/note';
import { SettingsStore } from '../../core/preferences/settings.store';
import { LabelsStore } from '../labels/labels.store';
import { NotebooksStore } from '../notebooks/notebooks.store';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import {
  faBars,
  faFileLines,
  faMagnifyingGlass,
  faPlus,
  faTableCells,
} from '../../shared/utilities/glacier-icons';
import { NoteListComponent } from './note-list.component';
import { NotePrompts } from './note-prompts';
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
    NoteListComponent,
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
          [message]="emptyMessage()"
        />
      } @else {
        <app-note-list
          [notes]="store.notes()"
          [grid]="settings.noteLayout() === 'grid'"
          (open)="open($event.id)"
          (actions)="showActions($event)"
        />
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="create()" [attr.aria-label]="i18n.t('a11y.newNote')">
          <fa-icon [icon]="addIcon" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
})
export class NotesPage {
  readonly i18n = inject(I18nService);
  readonly settings = inject(SettingsStore);
  readonly store = inject(NotesStore);
  private readonly notebooks = inject(NotebooksStore);
  private readonly labels = inject(LabelsStore);
  private readonly prompts = inject(NotePrompts);
  private readonly router = inject(Router);

  /** Bound from `notebooks/:notebookId`; absent on `/notes`, which spans every notebook. */
  readonly notebookId = input<string | undefined>(undefined);
  /** Bound from `labels/:labelId`. The two are never set together. */
  readonly labelId = input<string | undefined>(undefined);

  readonly emptyIcon = faFileLines;
  readonly searchIcon = faMagnifyingGlass;
  readonly addIcon = faPlus;
  readonly gridIcon = faTableCells;
  readonly listIcon = faBars;

  protected readonly isEmpty = computed(
    () => this.store.status() !== 'loading' && this.store.notes().length === 0,
  );

  /** Falls back to empty while the notebook or label list is still loading. */
  protected readonly title = computed(() => {
    const notebookId = this.notebookId();
    if (notebookId) {
      return this.notebooks.find(notebookId)?.name ?? '';
    }
    const labelId = this.labelId();
    return labelId ? (this.labels.find(labelId)?.name ?? '') : this.i18n.t('sidebar.notes');
  });

  protected readonly emptyMessage = computed(() => {
    if (this.notebookId()) {
      return this.i18n.t('notebook.empty');
    }
    return this.labelId() ? this.i18n.t('label.empty') : this.i18n.t('grid.noNotesHint');
  });

  constructor() {
    // The effect covers a route-parameter change on an already-mounted page;
    // `ionViewWillEnter` covers re-entering the cached page from elsewhere.
    // `setView` ignores a repeat of the view it already holds, so the two
    // overlapping on first display costs nothing.
    effect(() => {
      const notebookId = this.notebookId();
      void this.store.setView(this.viewFor(notebookId, this.labelId()));
      // No reader yet — the desktop restores the last sidebar selection at
      // launch, but this app opens on /notes and cold-starting into a notebook
      // would be surprising. Written so the value is truthful when one arrives.
      this.settings.setLastSelectedNotebookId(notebookId ?? null);
    });
  }

  ionViewWillEnter(): void {
    void this.store.setView(this.viewFor(this.notebookId(), this.labelId()));
  }

  toggleLayout(): void {
    this.settings.setNoteLayout(this.settings.noteLayout() === 'grid' ? 'list' : 'grid');
  }

  open(id: string): void {
    void this.router.navigate(['/notes', id]);
  }

  showActions(note: Note): void {
    void this.prompts.actions(note, this.store.view().kind);
  }

  async create(): Promise<void> {
    const note = await this.store.createTextNote();
    // `created` marks the note as this session's, so the editor knows it may
    // discard it if the user leaves without typing anything.
    await this.router.navigate(['/notes', note.id], { queryParams: { created: 1 } });
  }

  private viewFor(notebookId: string | undefined, labelId: string | undefined) {
    if (notebookId) {
      return { kind: 'notebook', notebookId } as const;
    }
    return labelId ? ({ kind: 'label', labelId } as const) : ({ kind: 'active' } as const);
  }
}
