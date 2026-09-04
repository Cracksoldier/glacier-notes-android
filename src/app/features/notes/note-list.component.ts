import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { I18nService } from '../../core/localization/i18n.service';
import type { Note } from '../../core/models/note';
import { faThumbtack } from '../../shared/utilities/glacier-icons';
import { NoteCardComponent } from './note-card.component';

/**
 * The card list itself, shared by the notes, archive and trash pages.
 *
 * The four pages differ in their chrome — title, empty state, FAB, layout
 * toggle, the empty-trash button — and in which card actions apply, but the
 * grouped grid between them is the same. Extracted rather than reached by a mode
 * flag on `NotesPage`, which would have meant five conditionals serving nothing
 * but chrome.
 *
 * It is also where M11's render window lives, for the same reason: the
 * benchmarks in `src/benchmarks/` put a 10 000-note read at tens of
 * milliseconds, so SQL was never the ceiling — mounting ten thousand cards was,
 * each one running `marked` and DOMPurify over its own preview. Windowing here
 * fixes that once for all four pages. CDK virtual scroll was the alternative and
 * cannot be used: it needs uniform item heights and its own scroll viewport,
 * where this list is a multi-column masonry inside somebody else's
 * `ion-content`. `ion-infinite-scroll` resolves its scroll host by walking up to
 * an ancestor `ion-content`, which this component does not own either.
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
              [searchQuery]="searchQuery()"
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
          <app-note-card
            [note]="note"
            [searchQuery]="searchQuery()"
            (open)="open.emit(note)"
            (longPress)="actions.emit(note)"
          />
        }
      </div>

      @if (hasMore()) {
        <div #sentinel class="notes__sentinel" aria-hidden="true"></div>
      }
    </div>
  `,
  styles: `
    .notes {
      padding: 12px 12px 72px;
    }

    // The desktop's masonry (note-grid.scss), with the count forced rather than
    // derived. The desktop's fixed 240px column width lets the browser divide the
    // available space, which on a portrait phone -- the only form factor this app
    // ships to -- comes out at one column, making grid mode indistinguishable from
    // list mode and the toolbar toggle a no-op.
    //
    // column-count and not a smaller column-width: with both set the count is a
    // *maximum*, so a width-driven rule would silently collapse back to one column
    // on a 320px device.
    .notes--grid .notes__column {
      column-count: 2;
      column-gap: 12px;
    }

    // Above the crossover the browser picks the count again. 720px is where the
    // width-driven rule itself yields 2, so the count never dips as the viewport
    // grows: 2 in portrait, 3 in landscape, more on a tablet. The columns
    // shorthand resets column-count to auto, so nothing above needs unsetting.
    @media (min-width: 720px) {
      .notes--grid .notes__column {
        columns: 240px;
      }
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

    // Height, not zero: an element with no box is reported as intersecting the
    // moment it enters the viewport's edge, and one with no height at all is
    // reported inconsistently across engines.
    .notes__sentinel {
      height: 1px;
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
  /** Passed through to every card; only the search page sets it. */
  readonly searchQuery = input<string | null>(null);

  readonly open = output<Note>();
  readonly actions = output<Note>();

  readonly pinIcon = faThumbtack;

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  /**
   * How many notes are rendered, and how many more each growth adds.
   *
   * Big enough that one growth reliably pushes the sentinel back out of the
   * viewport, which is the whole re-arming mechanism: an `IntersectionObserver`
   * reports *changes*, so a sentinel that stayed in view after the list grew
   * would never report again and the list would stop growing halfway down.
   */
  private static readonly PAGE = 30;

  /**
   * Grows, and shrinks only to fit a shorter list.
   *
   * Resetting it whenever `notes()` changes identity would be wrong: pinning or
   * colouring a note hands the list a freshly built array, and collapsing the
   * page back to thirty cards under a reader who is scrolled into it would jump
   * them to a different note. Carrying the window across a view change instead
   * means a new view renders as much as the last one had grown to — bounded by
   * its own length, and strictly less than the everything this used to render.
   */
  private readonly limit = linkedSignal<readonly Note[], number>({
    source: this.notes,
    computation: (notes, previous) =>
      Math.min(notes.length, Math.max(NoteListComponent.PAGE, previous?.value ?? 0)),
  });

  private readonly windowed = computed(() => this.notes().slice(0, this.limit()));

  protected readonly hasMore = computed(() => this.limit() < this.notes().length);

  protected readonly pinned = computed(() =>
    this.grouped() ? this.windowed().filter((note) => note.pinned) : [],
  );
  protected readonly rest = computed(() =>
    this.grouped() ? this.windowed().filter((note) => !note.pinned) : this.windowed(),
  );

  constructor() {
    // The list is windowed, not virtualized: what has been rendered stays
    // rendered. Scrolling back up must not re-run `marked` over cards the reader
    // has already seen, and the cards below the fold are the only cost that grew
    // with the collection.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.limit.update((limit) => limit + NoteListComponent.PAGE);
      }
    });

    effect((onCleanup) => {
      const element = this.sentinel()?.nativeElement;
      if (!element) {
        return;
      }
      observer.observe(element);
      onCleanup(() => observer.unobserve(element));
    });

    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
