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

import { I18nService } from './core/localization/i18n.service';
import type { TranslationKey } from './core/localization/en';
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
  readonly label: TranslationKey;
  readonly path: string;
  readonly icon: IconDefinition;
}

interface DrawerSection {
  readonly title: TranslationKey;
  readonly entries: readonly DrawerEntry[];
  readonly createLabel?: TranslationKey;
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

  readonly i18n = inject(I18nService);

  readonly icons = { brand: faSnowflake, add: faPlus };

  // Mirrors the desktop sidebar's order (docs/desktop-audit.md §6). Notebook and
  // label lists stay empty until their stores exist, so only the headings and
  // the create rows render.
  readonly sections: readonly DrawerSection[] = [
    {
      title: 'sidebar.notes',
      entries: [{ label: 'sidebar.allNotes', path: '/notes', icon: faFileLines }],
    },
    {
      title: 'sidebar.notebooks',
      entries: [{ label: 'sidebar.allNotebooks', path: '/notebooks', icon: faBook }],
      createLabel: 'sidebar.newNotebook',
    },
    {
      title: 'sidebar.labels',
      entries: [{ label: 'sidebar.allLabels', path: '/labels', icon: faTag }],
      createLabel: 'sidebar.newLabel',
    },
  ];

  readonly footerEntries: readonly DrawerEntry[] = [
    { label: 'sidebar.archive', path: '/archive', icon: faBoxArchive },
    { label: 'sidebar.trash', path: '/trash', icon: faTrashCan },
    { label: 'sidebar.importExport', path: '/import-export', icon: faFileExport },
    { label: 'sidebar.settings', path: '/settings', icon: faGear },
  ];
}
