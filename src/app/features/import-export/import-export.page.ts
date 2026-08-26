import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '../../core/localization/i18n.service';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faFileExport } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-import-export-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      [heading]="i18n.t('sidebar.importExport')"
      [icon]="icon"
      [message]="i18n.t('placeholder.importExport')"
    />
  `,
})
export class ImportExportPage {
  readonly i18n = inject(I18nService);
  readonly icon = faFileExport;
}
