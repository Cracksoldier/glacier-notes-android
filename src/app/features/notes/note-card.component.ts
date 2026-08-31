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

import { IMAGE_FILE_STORE } from '../../core/images/image-file-store';
import { I18nService } from '../../core/localization/i18n.service';
import { splitText } from '../../core/markdown/highlight';
import { stripImageReferences } from '../../core/markdown/markdown-edit';
import { MarkdownService } from '../../core/markdown/markdown.service';
import { referencedImageIds } from '../../core/models/image-asset';
import type { Note } from '../../core/models/note';
import { SettingsStore } from '../../core/preferences/settings.store';
import { LabelsStore } from '../labels/labels.store';
import { faBoxArchive, faThumbtack } from '../../shared/utilities/glacier-icons';
import { displayOrder } from './checklist-model';
import { LongPressTracker } from './long-press';
import { noteColorVar } from './note-colors';

/** The desktop's own cut-off (`note-card.ts`), so a card is the same height in both apps. */
const CARD_ITEM_LIMIT = 8;

const CARD_IMAGE_LIMIT = 3;

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
    role: 'button',
    tabindex: '0',
    '[attr.aria-label]': 'ariaLabel()',
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp()',
    '(pointercancel)': 'onCancel()',
    '(click)': 'onClick()',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <article class="note-card" [style.background-color]="colorVar()">
      @if (note().pinned) {
        <fa-icon class="note-card__pin" [icon]="pinIcon" />
      }

      @if (searchQuery() && note().archived) {
        <span class="note-card__archived">
          <fa-icon [icon]="archiveIcon" />
          {{ i18n.t('card.archived') }}
        </span>
      }

      @if (note().title) {
        <h3 class="note-card__title">@for (segment of titleSegments(); track $index) {@if (segment.match) {<mark>{{ segment.text }}</mark>} @else {{{ segment.text }}}}</h3>
      }

      @if (checklist().length) {
        <ul class="note-card__preview note-card__items">
          @for (item of checklist(); track item.id) {
            <li class="note-card__item" [class.note-card__item--checked]="item.checked">
              <span class="note-card__box">{{ item.checked ? '☑' : '☐' }}</span>
              <span class="note-card__item-text" [innerHTML]="item.html"></span>
            </li>
          }
        </ul>
        @if (hiddenItems()) {
          <p class="note-card__more">{{ i18n.t('card.more', { count: hiddenItems() }) }}</p>
        }
      } @else if (previewSource()) {
        <div class="note-card__preview markdown-body" [innerHTML]="preview()"></div>
      } @else if (!note().title && !thumbnails().length) {
        <p class="note-card__blank">{{ i18n.t('card.emptyNote') }}</p>
      }

      @if (thumbnails().length) {
        <ul class="note-card__images" [attr.aria-label]="i18n.t('a11y.noteImages')">
          @for (url of thumbnails(); track url) {
            <li>
              <!-- A card renders the full-resolution file into a 56px box, so a
                   long list would otherwise decode every one of them on mount. -->
              <img
                class="note-card__thumb"
                [src]="url"
                alt=""
                loading="lazy"
                decoding="async"
              />
            </li>
          }
        </ul>
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

    // The desktop's badge (note-card.scss), shown only while searching, since
    // that is the only view where an archived note appears beside active ones.
    .note-card__archived {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      align-self: flex-start;
      margin-bottom: 6px;
      padding: 2px 8px;
      border-radius: 10px;
      background-color: var(--color-surface-elevated);
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 600;
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

    .note-card__items {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .note-card__item {
      display: flex;
      gap: 6px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .note-card__item--checked {
      color: var(--color-text-muted);
      text-decoration: line-through;
    }

    .note-card__box {
      flex: none;
    }

    .note-card__more {
      margin: 4px 0 0;
      color: var(--color-text-muted);
      font-size: 12px;
      pointer-events: none;
    }

    .note-card__blank {
      margin: 0;
      color: var(--color-text-muted);
      font-style: italic;
    }

    .note-card__images {
      display: flex;
      gap: 4px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      pointer-events: none;
    }

    .note-card__thumb {
      display: block;
      width: 56px;
      height: 56px;
      border-radius: 6px;
      background-color: var(--color-surface-elevated);
      object-fit: cover;
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
  private readonly settings = inject(SettingsStore);
  private readonly images = inject(IMAGE_FILE_STORE);

  readonly note = input.required<Note>();

  /**
   * The query whose matches the card marks. Also what tells the card it is being
   * shown in a search result, which is the only view that mixes archived notes in
   * with active ones and so the only one where the badge means anything.
   */
  readonly searchQuery = input<string | null>(null);

  readonly open = output<void>();
  readonly longPress = output<void>();

  readonly pinIcon = faThumbtack;
  readonly archiveIcon = faBoxArchive;

  private readonly tracker = new LongPressTracker({ onLongPress: () => this.longPress.emit() });

  protected readonly previewSource = computed(() => stripImageReferences(this.note().content));
  protected readonly preview = computed(() =>
    this.markdown.renderPreview(this.previewSource(), this.searchQuery() ?? undefined),
  );

  /**
   * The title is plain text, so it is marked by segmentation rather than by
   * `highlightHtml`: there is no markup here to walk, and rendering the segments
   * keeps Angular's own escaping in the path.
   */
  protected readonly titleSegments = computed(() =>
    splitText(this.note().title, this.searchQuery() ?? ''),
  );

  /**
   * Drawn from `referencedImageIds`, not `imageIds`, so an imported note whose
   * junction rows are thinner than its body still shows what it embeds.
   */
  protected readonly thumbnails = computed(() =>
    referencedImageIds(this.note())
      .slice(0, CARD_IMAGE_LIMIT)
      .map((id) => this.images.url(id)),
  );

  /**
   * Item text is rendered inline rather than shown raw: the editor edits the
   * Markdown source, the card displays it. Empty placeholder rows are dropped —
   * a card is not the place to advertise an unfinished line.
   */
  protected readonly checklist = computed(() =>
    displayOrder(this.note().checklist ?? [], this.settings.moveCheckedToBottom())
      .filter((item) => item.text.trim() !== '')
      .slice(0, CARD_ITEM_LIMIT)
      .map((item) => ({
        id: item.id,
        checked: item.checked,
        html: this.markdown.renderInline(item.text, this.searchQuery() ?? undefined),
      })),
  );

  protected readonly hiddenItems = computed(
    () =>
      (this.note().checklist ?? []).filter((item) => item.text.trim() !== '').length -
      this.checklist().length,
  );

  /**
   * `null` clears the inline style, which lets the stylesheet's
   * `var(--color-surface)` win. That is exactly the desktop's degradation for a
   * colour it does not recognise.
   */
  protected readonly colorVar = computed(() => noteColorVar(this.note().color));

  protected readonly labelNames = computed(() => this.labels.names(this.note().labels));

  /**
   * `role="button"` flattens the heading, preview and label list into
   * presentational content, so this has to restate everything the card shows.
   * The visual layout is untouched — the card was already one tap target.
   */
  protected readonly ariaLabel = computed(() => {
    const note = this.note();
    const parts = [this.headline() || this.i18n.t('card.emptyNote')];
    if (note.pinned) {
      parts.push(this.i18n.t('a11y.notePinned'));
    }
    if (this.searchQuery() && note.archived) {
      parts.push(this.i18n.t('card.archived'));
    }
    const names = this.labelNames();
    if (names.length) {
      parts.push(this.i18n.t('a11y.noteLabelList', { names: names.join(', ') }));
    }
    const images = referencedImageIds(note).length;
    if (images) {
      parts.push(this.i18n.t('a11y.noteImageCount', { count: images }));
    }
    return parts.join('. ');
  });

  /** The same fallback order the card renders: title, then first row or line. */
  private readonly headline = computed(() => {
    const note = this.note();
    if (note.title.trim()) {
      return note.title;
    }
    const item = (note.checklist ?? []).find((entry) => entry.text.trim() !== '');
    return item ? item.text : (this.previewSource().trim().split('\n')[0] ?? '');
  });

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

  /**
   * The long press has no keyboard or AT equivalent, so without this the actions
   * sheet is unreachable without a pointer. Both of the menu keys are mapped:
   * TalkBack and a physical keyboard do not agree on which one they send.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open.emit();
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      this.longPress.emit();
    }
  }

  private suppressClick = false;
}
