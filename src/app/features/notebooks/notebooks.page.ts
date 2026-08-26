import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faBook } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-notebooks-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      heading="Notebooks"
      [icon]="icon"
      message="Notebooks organise your notes. They arrive with the notebook store."
    />
  `,
})
export class NotebooksPage {
  readonly icon = faBook;
}
