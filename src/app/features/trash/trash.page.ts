import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faTrashCan } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-trash-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      heading="Trash"
      [icon]="icon"
      message="Deleted notes can be restored from here."
    />
  `,
})
export class TrashPage {
  readonly icon = faTrashCan;
}
