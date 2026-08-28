import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../core/localization/i18n.service';
import { MarkdownService } from '../../core/markdown/markdown.service';
import type { Note } from '../../core/models/note';

/**
 * The desktop's note card (`note-card.scss`) minus everything M06 cannot yet
 * produce: colours, labels, pin badge and the hover-revealed action row are
 * M08's. A hover row would be meaningless on a touch screen anyway, so the whole
 * card is one tap target.
 */
@Component({
  selector: 'app-note-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="note-card">
      @if (note().title) {
        <h3 class="note-card__title">{{ note().title }}</h3>
      }

      @if (note().content) {
        <div class="note-card__preview markdown-body" [innerHTML]="preview()"></div>
      } @else if (!note().title) {
        <p class="note-card__blank">{{ i18n.t('card.emptyNote') }}</p>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      // The desktop's masonry relies on this to keep a card in one column.
      break-inside: avoid;
      margin-bottom: 12px;
    }

    .note-card {
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

    .note-card__title {
      margin: 0 0 6px;
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
  `,
})
export class NoteCardComponent {
  readonly i18n = inject(I18nService);
  private readonly markdown = inject(MarkdownService);

  readonly note = input.required<Note>();

  protected readonly preview = computed(() => this.markdown.renderPreview(this.note().content));
}
