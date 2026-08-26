import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '../../core/localization/i18n.service';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faBook } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-notebooks-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      [heading]="i18n.t('sidebar.notebooks')"
      [icon]="icon"
      [message]="i18n.t('placeholder.notebooks')"
    />
  `,
})
export class NotebooksPage {
  readonly i18n = inject(I18nService);
  readonly icon = faBook;
}
