import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '../../core/localization/i18n.service';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faMagnifyingGlass } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      [heading]="i18n.t('sidebar.search')"
      [icon]="icon"
      [message]="i18n.t('placeholder.search')"
    />
  `,
})
export class SearchPage {
  readonly i18n = inject(I18nService);
  readonly icon = faMagnifyingGlass;
}
