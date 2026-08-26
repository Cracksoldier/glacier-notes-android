import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  IonApp,
  IonContent,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonSplitPane,
} from '@ionic/angular';

import { ThemeService } from './core/preferences/theme.service';
import {
  faBook,
  faBoxArchive,
  faFileExport,
  faFileLines,
  faGear,
  faPlus,
  faSnowflake,
  faTag,
  faTrashCan,
} from './shared/utilities/glacier-icons';

interface DrawerEntry {
  readonly label: string;
  readonly path: string;
  readonly icon: IconDefinition;
}

interface DrawerSection {
  readonly title: string;
  readonly entries: readonly DrawerEntry[];
  readonly createLabel?: string;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [
    FaIconComponent,
    IonApp,
    IonContent,
    IonMenu,
    IonMenuToggle,
    IonRouterOutlet,
    IonSplitPane,
    RouterLink,
    RouterLinkActive,
  ],
})
export class AppComponent {
  // Instantiated for its side effect: the theme service owns the body theme class.
  private readonly theme = inject(ThemeService);

  readonly icons = { brand: faSnowflake, add: faPlus };

  // Mirrors the desktop sidebar's order (docs/desktop-audit.md §6). Notebook and
  // label lists stay empty until their stores exist, so only the headings and
  // the create rows render.
  readonly sections: readonly DrawerSection[] = [
    {
      title: 'Notes',
      entries: [{ label: 'All Notes', path: '/notes', icon: faFileLines }],
    },
    {
      title: 'Notebooks',
      entries: [{ label: 'All Notebooks', path: '/notebooks', icon: faBook }],
      createLabel: 'New notebook',
    },
    {
      title: 'Labels',
      entries: [{ label: 'All Labels', path: '/labels', icon: faTag }],
      createLabel: 'New label',
    },
  ];

  readonly footerEntries: readonly DrawerEntry[] = [
    { label: 'Archive', path: '/archive', icon: faBoxArchive },
    { label: 'Trash', path: '/trash', icon: faTrashCan },
    { label: 'Import / Export', path: '/import-export', icon: faFileExport },
    { label: 'Settings', path: '/settings', icon: faGear },
  ];
}
