import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '../../core/localization/i18n.service';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faTag } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-labels-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      [heading]="i18n.t('sidebar.labels')"
      [icon]="icon"
      [message]="i18n.t('placeholder.labels')"
    />
  `,
})
export class LabelsPage {
  readonly i18n = inject(I18nService);
  readonly icon = faTag;
}
