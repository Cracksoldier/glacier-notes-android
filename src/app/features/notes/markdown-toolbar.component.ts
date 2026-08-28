import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

import type { ToolbarAction } from '../../core/markdown/markdown-edit';
import { I18nService, type TranslationKey } from '../../core/localization/i18n.service';
import {
  faBold,
  faCode,
  faItalic,
  faLink,
  faListOl,
  faListUl,
  faQuoteRight,
} from '../../shared/utilities/glacier-icons';

/**
 * The desktop's `markdown-toolbar.ts` with two deliberate changes: a quote
 * button M06 asks for that the desktop does not have, and no image button
 * because `glacier-img://` assets are M10.
 */
@Component({
  selector: 'app-markdown-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent],
  template: `
    @for (button of buttons; track button.action) {
      <button
        type="button"
        class="toolbar__button"
        [attr.aria-label]="i18n.t(button.labelKey)"
        [disabled]="disabled()"
        (mousedown)="$event.preventDefault()"
        (click)="action.emit(button.action)"
      >
        @if (button.icon) {
          <fa-icon [icon]="button.icon" />
        } @else {
          <span class="toolbar__text">{{ button.text }}</span>
        }
      </button>
    }
  `,
  styles: `
    // The desktop fits nine buttons on one row; a 360dp phone cannot, so the
    // row scrolls sideways instead of wrapping into a second line that would
    // push the textarea down.
    :host {
      display: flex;
      gap: 2px;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }

    :host::-webkit-scrollbar {
      display: none;
    }

    .toolbar__button {
      flex: none;
      // 40px keeps every button at the Android minimum touch target.
      min-width: 40px;
      height: 40px;
      padding: 0 8px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 14px;
    }

    .toolbar__button:active:not(:disabled) {
      background-color: var(--color-surface-elevated);
      color: var(--color-text);
    }

    .toolbar__button:disabled {
      opacity: 0.35;
    }

    .toolbar__text {
      font-size: 13px;
      font-weight: 700;
    }
  `,
})
export class MarkdownToolbarComponent {
  readonly disabled = input(false);
  readonly action = output<ToolbarAction>();

  protected readonly i18n = inject(I18nService);

  protected readonly buttons: {
    action: ToolbarAction;
    labelKey: TranslationKey;
    icon?: IconDefinition;
    text?: string;
  }[] = [
    { action: 'bold', labelKey: 'mdToolbar.bold', icon: faBold },
    { action: 'italic', labelKey: 'mdToolbar.italic', icon: faItalic },
    { action: 'h1', labelKey: 'mdToolbar.h1', text: 'H1' },
    { action: 'h2', labelKey: 'mdToolbar.h2', text: 'H2' },
    { action: 'ul', labelKey: 'mdToolbar.ul', icon: faListUl },
    { action: 'ol', labelKey: 'mdToolbar.ol', icon: faListOl },
    { action: 'quote', labelKey: 'mdToolbar.quote', icon: faQuoteRight },
    { action: 'link', labelKey: 'mdToolbar.link', icon: faLink },
    { action: 'code', labelKey: 'mdToolbar.code', icon: faCode },
  ];
}
