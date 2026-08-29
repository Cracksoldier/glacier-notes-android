import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { ThemeService } from './core/preferences/theme.service';
import { LabelPrompts } from './features/labels/label-prompts';
import { LabelsStore } from './features/labels/labels.store';
import { NotebookPrompts } from './features/notebooks/notebook-prompts';
import { NotebooksStore } from './features/notebooks/notebooks.store';
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
  /** Already translated: a notebook contributes its own name, not a key. */
  readonly label: string;
  readonly path: string;
  readonly icon: IconDefinition;
}

interface DrawerSection {
  readonly title: string;
  readonly entries: readonly DrawerEntry[];
  readonly createLabel?: string;
  readonly onCreate?: () => void;
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
  private readonly notebooks = inject(NotebooksStore);
  private readonly notebookPrompts = inject(NotebookPrompts);
  private readonly labels = inject(LabelsStore);
  private readonly labelPrompts = inject(LabelPrompts);

  readonly icons = { brand: faSnowflake, add: faPlus };

  // Mirrors the desktop sidebar's order (docs/desktop-audit.md §6).
  readonly sections = computed<readonly DrawerSection[]>(() => [
    {
      title: this.i18n.t('sidebar.notes'),
      entries: [{ label: this.i18n.t('sidebar.allNotes'), path: '/notes', icon: faFileLines }],
    },
    {
      title: this.i18n.t('sidebar.notebooks'),
      entries: [
        { label: this.i18n.t('sidebar.allNotebooks'), path: '/notebooks', icon: faBook },
        ...this.notebooks.notebooks().map((notebook) => ({
          label: notebook.name,
          path: `/notebooks/${notebook.id}`,
          icon: faBook,
        })),
      ],
      createLabel: this.i18n.t('sidebar.newNotebook'),
      onCreate: () => void this.notebookPrompts.create(),
    },
    {
      title: this.i18n.t('sidebar.labels'),
      entries: [
        { label: this.i18n.t('sidebar.allLabels'), path: '/labels', icon: faTag },
        ...this.labels.labels().map((label) => ({
          label: label.name,
          path: `/labels/${label.id}`,
          icon: faTag,
        })),
      ],
      createLabel: this.i18n.t('sidebar.newLabel'),
      onCreate: () => void this.labelPrompts.create(),
    },
  ]);

  readonly footerEntries = computed<readonly DrawerEntry[]>(() => [
    { label: this.i18n.t('sidebar.archive'), path: '/archive', icon: faBoxArchive },
    { label: this.i18n.t('sidebar.trash'), path: '/trash', icon: faTrashCan },
    { label: this.i18n.t('sidebar.importExport'), path: '/import-export', icon: faFileExport },
    { label: this.i18n.t('sidebar.settings'), path: '/settings', icon: faGear },
  ]);

  constructor() {
    void this.notebooks.load();
    void this.labels.load();
  }
}
