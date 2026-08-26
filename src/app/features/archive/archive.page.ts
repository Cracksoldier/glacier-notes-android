import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faBoxArchive } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-archive-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      heading="Archive"
      [icon]="icon"
      message="Archived notes stay out of the way but are never deleted."
    />
  `,
})
export class ArchivePage {
  readonly icon = faBoxArchive;
}
