import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSearchbar,
  IonToolbar,
} from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { Note } from '../../core/models/note';
import { SettingsStore } from '../../core/preferences/settings.store';
import type { NoteScope } from '../../core/repositories/note-queries';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { faMagnifyingGlass, faTriangleExclamation } from '../../shared/utilities/glacier-icons';
import { effectiveViewKind } from '../notes/note-actions';
import { NoteListComponent } from '../notes/note-list.component';
import { NotePrompts } from '../notes/note-prompts';
import { NotesStore } from '../notes/notes.store';

type ScopeId = 'all' | 'notebook' | 'label' | 'archived' | 'trashed';

interface ScopeChip {
  readonly id: ScopeId;
  readonly labelKey:
    | 'search.scopeAll'
    | 'search.scopeNotebook'
    | 'search.scopeLabel'
    | 'search.scopeArchive'
    | 'search.scopeTrash';
}

/**
 * Search is its own page rather than a field in the note list's toolbar, which
 * is where the desktop puts it. A phone toolbar has no room for a search field
 * beside the menu button, the layout toggle and the title, and the scope toggle
 * the desktop offers in a dropdown becomes a chip row that needs a line of its
 * own.
 *
 * The page owns no notes of its own: it drives the shared `NotesStore` with a
 * `search` view, exactly as the archive and trash pages drive theirs, so the
 * card actions, the grouping and the layout setting all behave as they do
 * everywhere else.
 */
@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonSearchbar,
    IonToolbar,
    NoteListComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button
            defaultHref="/notes"
            [text]="i18n.t('common.back')"
            [attr.aria-label]="i18n.t('common.back')"
          />
        </ion-buttons>
        <ion-searchbar
          [value]="query()"
          [placeholder]="i18n.t('search.placeholder')"
          [debounce]="200"
          [cancelButtonText]="i18n.t('common.cancel')"
          [attr.aria-label]="i18n.t('a11y.searchNotes')"
          (ionInput)="onQuery($event)"
          (ionClear)="onQuery($event)"
        />
      </ion-toolbar>

      <ion-toolbar>
        <div class="scopes" role="radiogroup" [attr.aria-label]="i18n.t('a11y.searchScope')">
          @for (chip of scopes(); track chip.id) {
            <button
              type="button"
              class="scopes__chip"
              role="radio"
              [class.scopes__chip--on]="scope() === chip.id"
              [attr.aria-checked]="scope() === chip.id"
              (click)="selectScope(chip.id)"
            >
              {{ i18n.t(chip.labelKey) }}
            </button>
          }
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (hasError()) {
        <app-empty-state
          [icon]="errorIcon"
          [title]="i18n.t('error.loadTitle')"
          [message]="i18n.t('error.loadNotes')"
          [actionLabel]="i18n.t('error.retry')"
          (action)="retry()"
        />
      } @else if (!needle()) {
        <app-empty-state
          [icon]="searchIcon"
          [title]="i18n.t('search.prompt')"
          [message]="i18n.t('search.promptHint')"
        />
      } @else if (isEmpty()) {
        <app-empty-state
          [icon]="searchIcon"
          [title]="i18n.t('grid.noMatches')"
          [message]="i18n.t('grid.noMatchesHint')"
        />
      } @else {
        <app-note-list
          [notes]="store.notes()"
          [grid]="settings.noteLayout() === 'grid'"
          [searchQuery]="needle()"
          (open)="open($event.id)"
          (actions)="showActions($event)"
        />
      }
    </ion-content>
  `,
  styles: `
    .scopes {
      display: flex;
      gap: 8px;
      padding: 4px 12px 8px;
      overflow-x: auto;
      // The row scrolls sideways when five chips do not fit; without this the
      // last chip's trailing space is eaten and it looks clipped rather than
      // scrollable.
      scrollbar-width: none;
    }

    .scopes__chip {
      flex: none;
      padding: 5px 12px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background-color: var(--color-surface);
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .scopes__chip--on {
      border-color: var(--color-accent);
      background-color: var(--color-accent);
      color: var(--glacier-mark-ink);
    }
  `,
})
export class SearchPage {
  readonly i18n = inject(I18nService);
  readonly settings = inject(SettingsStore);
  readonly store = inject(NotesStore);
  private readonly prompts = inject(NotePrompts);
  private readonly router = inject(Router);

  /**
   * Bound from the query string, not the path: the notebook is context the
   * search *may* narrow to, not the thing being searched, so `/search` stays one
   * route however it was reached.
   */
  readonly notebookId = input<string | undefined>(undefined);
  readonly labelId = input<string | undefined>(undefined);

  readonly searchIcon = faMagnifyingGlass;
  readonly errorIcon = faTriangleExclamation;

  /** What the searchbar shows. `needle` is what is searched for. */
  protected readonly query = signal('');
  protected readonly needle = computed(() => this.query().trim());
  protected readonly scope = signal<ScopeId>('all');

  /**
   * "This notebook" and "This label" only appear when the search was opened from
   * one. They are mutually exclusive — no route sets both.
   */
  protected readonly scopes = computed<readonly ScopeChip[]>(() => [
    { id: 'all', labelKey: 'search.scopeAll' },
    ...(this.notebookId() ? ([{ id: 'notebook', labelKey: 'search.scopeNotebook' }] as const) : []),
    ...(this.labelId() ? ([{ id: 'label', labelKey: 'search.scopeLabel' }] as const) : []),
    { id: 'archived', labelKey: 'search.scopeArchive' },
    { id: 'trashed', labelKey: 'search.scopeTrash' },
  ]);

  protected readonly hasError = computed(() => this.store.status() === 'error');

  /** `'ready'`, not "not loading" — see `NotesPage.isEmpty`. */
  protected readonly isEmpty = computed(
    () => this.store.status() === 'ready' && this.store.notes().length === 0,
  );

  onQuery(event: Event): void {
    this.query.set((event as CustomEvent<{ value?: string | null }>).detail.value ?? '');
    this.apply();
  }

  selectScope(id: ScopeId): void {
    this.scope.set(id);
    this.apply();
  }

  retry(): void {
    void this.store.load();
  }

  open(id: string): void {
    void this.router.navigate(['/notes', id]);
  }

  /**
   * The `all` scope mixes active and archived notes and the trash scope returns
   * trashed ones, so which actions apply is a property of the note here rather
   * than of the view.
   */
  showActions(note: Note): void {
    void this.prompts.actions(note, effectiveViewKind(note, this.store.view()));
  }

  /**
   * An empty query is not searched for: `LIKE '%%'` matches every note, which
   * would turn a cleared searchbar into an unbounded read of the whole
   * collection behind the idle prompt nobody would see it under.
   */
  private apply(): void {
    const query = this.needle();
    if (!query) {
      return;
    }
    void this.store.setView({ kind: 'search', query, scope: this.scopeValue() });
  }

  private scopeValue(): NoteScope {
    switch (this.scope()) {
      case 'notebook':
        return { kind: 'notebook', notebookId: this.notebookId() ?? '' };
      case 'label':
        return { kind: 'label', labelId: this.labelId() ?? '' };
      case 'archived':
        return { kind: 'archived' };
      case 'trashed':
        return { kind: 'trashed' };
      case 'all':
        return { kind: 'all' };
    }
  }
}
