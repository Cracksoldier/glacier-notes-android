import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '../../core/localization/i18n.service';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faTrashCan } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-trash-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      [heading]="i18n.t('sidebar.trash')"
      [icon]="icon"
      [message]="i18n.t('grid.trashEmptyHint')"
    />
  `,
})
export class TrashPage {
  readonly i18n = inject(I18nService);
  readonly icon = faTrashCan;
}
