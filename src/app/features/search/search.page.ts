import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faMagnifyingGlass } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      heading="Search"
      [icon]="icon"
      message="Full-text search over titles, bodies and checklists."
    />
  `,
})
export class SearchPage {
  readonly icon = faMagnifyingGlass;
}
