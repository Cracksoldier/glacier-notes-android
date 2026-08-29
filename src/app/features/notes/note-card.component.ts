import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  output,
} from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { I18nService } from '../../core/localization/i18n.service';
import { MarkdownService } from '../../core/markdown/markdown.service';
import type { Note } from '../../core/models/note';
import { LabelsStore } from '../labels/labels.store';
import { faThumbtack } from '../../shared/utilities/glacier-icons';
import { LongPressTracker } from './long-press';
import { noteColorVar } from './note-colors';

/**
 * The desktop's note card (`note-card.scss`), with its hover-revealed action row
 * replaced by a long press: hovering does not exist on a touch screen, and the
 * card stays one tap target either way.
 */
@Component({
  selector: 'app-note-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent],
  host: {
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp()',
    '(pointercancel)': 'onCancel()',
    '(click)': 'onClick()',
  },
  template: `
    <article class="note-card" [style.background-color]="colorVar()">
      @if (note().pinned) {
        <fa-icon class="note-card__pin" [icon]="pinIcon" />
      }

      @if (note().title) {
        <h3 class="note-card__title">{{ note().title }}</h3>
      }

      @if (note().content) {
        <div class="note-card__preview markdown-body" [innerHTML]="preview()"></div>
      } @else if (!note().title) {
        <p class="note-card__blank">{{ i18n.t('card.emptyNote') }}</p>
      }

      @if (labelNames().length) {
        <ul class="note-card__labels">
          @for (name of labelNames(); track name) {
            <li class="note-card__label">{{ name }}</li>
          }
        </ul>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      // The desktop's masonry relies on this to keep a card in one column.
      break-inside: avoid;
      margin-bottom: 12px;
      // Without these three the Android WebView starts a text selection during
      // the press and raises the selection magnifier over the card.
      user-select: none;
      -webkit-touch-callout: none;
      touch-action: manipulation;
    }

    .note-card {
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--glacier-radius-card);
      background-color: var(--color-surface);
      color: var(--color-text);
    }

    .note-card:active {
      border-color: var(--color-accent-muted);
      box-shadow: var(--glacier-shadow-card-hover);
    }

    .note-card__pin {
      position: absolute;
      top: 12px;
      right: 12px;
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .note-card__title {
      margin: 0 0 6px;
      padding-right: 18px;
      font-size: 15px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .note-card__preview {
      max-height: 280px;
      overflow: hidden;
      font-size: 13px;
      overflow-wrap: anywhere;
      // Rendered markdown can carry its own links; the card is a single tap
      // target, so nothing inside it may take the tap.
      pointer-events: none;
    }

    .note-card__blank {
      margin: 0;
      color: var(--color-text-muted);
      font-style: italic;
    }

    .note-card__labels {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      pointer-events: none;
    }

    .note-card__label {
      padding: 2px 8px;
      border-radius: 999px;
      background-color: var(--color-surface-raised);
      color: var(--color-text-muted);
      font-size: 11px;
    }
  `,
})
export class NoteCardComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly markdown = inject(MarkdownService);
  private readonly labels = inject(LabelsStore);

  readonly note = input.required<Note>();

  readonly open = output<void>();
  readonly longPress = output<void>();

  readonly pinIcon = faThumbtack;

  private readonly tracker = new LongPressTracker({ onLongPress: () => this.longPress.emit() });

  protected readonly preview = computed(() => this.markdown.renderPreview(this.note().content));

  /**
   * `null` clears the inline style, which lets the stylesheet's
   * `var(--color-surface)` win. That is exactly the desktop's degradation for a
   * colour it does not recognise.
   */
  protected readonly colorVar = computed(() => noteColorVar(this.note().color));

  protected readonly labelNames = computed(() => this.labels.names(this.note().labels));

  ngOnDestroy(): void {
    this.tracker.cancel();
  }

  protected onDown(event: PointerEvent): void {
    this.tracker.down(event.clientX, event.clientY);
  }

  protected onMove(event: PointerEvent): void {
    this.tracker.move(event.clientX, event.clientY);
  }

  protected onUp(): void {
    // `up` reports whether the press fired; the click that follows belongs to
    // the same gesture and would otherwise open the editor behind the sheet.
    this.suppressClick = this.tracker.up();
  }

  protected onCancel(): void {
    this.tracker.cancel();
  }

  protected onClick(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.open.emit();
  }

  private suppressClick = false;
}
