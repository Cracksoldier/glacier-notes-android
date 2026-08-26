import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent],
  template: `
    <div class="empty-state">
      <fa-icon class="empty-state__icon" [icon]="icon()" />
      <h2 class="empty-state__title">{{ title() }}</h2>
      @if (message()) {
        <p class="empty-state__message">{{ message() }}</p>
      }
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 60vh;
      padding: 32px 24px;
      text-align: center;
      color: var(--color-text-muted);
    }

    .empty-state__icon {
      font-size: 40px;
      opacity: 0.55;
    }

    .empty-state__title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text);
    }

    .empty-state__message {
      margin: 0;
      max-width: 34ch;
      font-size: 14px;
      line-height: 1.5;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input.required<IconDefinition>();
  readonly title = input.required<string>();
  readonly message = input('');
}
