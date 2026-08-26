import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '../../core/localization/i18n.service';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faBoxArchive } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-archive-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      [heading]="i18n.t('sidebar.archive')"
      [icon]="icon"
      [message]="i18n.t('grid.nothingArchivedHint')"
    />
  `,
})
export class ArchivePage {
  readonly i18n = inject(I18nService);
  readonly icon = faBoxArchive;
}
