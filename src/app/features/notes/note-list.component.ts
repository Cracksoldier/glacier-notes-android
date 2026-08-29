import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { I18nService } from '../../core/localization/i18n.service';
import type { Note } from '../../core/models/note';
import { faThumbtack } from '../../shared/utilities/glacier-icons';
import { NoteCardComponent } from './note-card.component';

/**
 * The card list itself, shared by the notes, archive and trash pages.
 *
 * The three pages differ in their chrome — title, empty state, FAB, layout
 * toggle, the empty-trash button — and in which card actions apply, but the
 * grouped grid between them is the same. Extracted rather than reached by a mode
 * flag on `NotesPage`, which would have meant five conditionals serving nothing
 * but chrome.
 */
@Component({
  selector: 'app-note-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent, NoteCardComponent],
  template: `
    <div class="notes" [class.notes--grid]="grid()">
      @if (grouped() && pinned().length) {
        <h2 class="notes__heading">
          <fa-icon [icon]="pinIcon" />
          {{ i18n.t('grid.pinned') }}
        </h2>
        <div class="notes__column">
          @for (note of pinned(); track note.id) {
            <app-note-card
              [note]="note"
              (open)="open.emit(note)"
              (longPress)="actions.emit(note)"
            />
          }
        </div>

        @if (rest().length) {
          <h2 class="notes__heading">{{ i18n.t('grid.others') }}</h2>
        }
      }

      <div class="notes__column">
        @for (note of rest(); track note.id) {
          <app-note-card [note]="note" (open)="open.emit(note)" (longPress)="actions.emit(note)" />
        }
      </div>
    </div>
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
export class NoteListComponent {
  readonly i18n = inject(I18nService);

  readonly notes = input.required<readonly Note[]>();
  readonly grid = input(false);
  /**
   * The trash turns this off: its rows are ordered by `deleted_at DESC` and pins
   * carry no meaning there, so a Pinned heading would group by a key the list is
   * not sorted on.
   */
  readonly grouped = input(true);

  readonly open = output<Note>();
  readonly actions = output<Note>();

  readonly pinIcon = faThumbtack;

  protected readonly pinned = computed(() =>
    this.grouped() ? this.notes().filter((note) => note.pinned) : [],
  );
  protected readonly rest = computed(() =>
    this.grouped() ? this.notes().filter((note) => !note.pinned) : this.notes(),
  );
}
