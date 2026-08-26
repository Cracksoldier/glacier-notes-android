import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../shared/components/placeholder-page.component';
import { faFileExport } from '../../shared/utilities/glacier-icons';

@Component({
  selector: 'app-import-export-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      heading="Import / Export"
      [icon]="icon"
      message="Exchange .glacier.json archives with Glacier Notes on the desktop."
    />
  `,
})
export class ImportExportPage {
  readonly icon = faFileExport;
}
