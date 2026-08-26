import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faTag } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-labels-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      heading="Labels"
      [icon]="icon"
      message="Labels let you tag notes across notebooks."
    />
  `,
})
export class LabelsPage {
  readonly icon = faTag;
}
