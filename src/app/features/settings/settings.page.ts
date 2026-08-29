import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/localization/i18n.service';
import type { LanguageCode, ThemeMode } from '../../core/preferences/settings.model';
import { SettingsStore } from '../../core/preferences/settings.store';
import { ThemeService } from '../../core/preferences/theme.service';
import { NotebooksStore } from '../notebooks/notebooks.store';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonMenuButton,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button [attr.aria-label]="i18n.t('a11y.openMenu')" />
        </ion-buttons>
        <ion-title>{{ i18n.t('settings.title') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list [inset]="true">
        <ion-list-header>{{ i18n.t('settings.appearance') }}</ion-list-header>
        <ion-item lines="none">
          <ion-label>{{ i18n.t('settings.theme') }}</ion-label>
        </ion-item>
        <ion-item lines="none">
          <ion-segment
            [value]="theme.mode()"
            (ionChange)="onThemeChange($event)"
            [attr.aria-label]="i18n.t('a11y.themeMode')"
          >
            <ion-segment-button value="dark">
              <ion-label>{{ i18n.t('settings.themeDark') }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="light">
              <ion-label>{{ i18n.t('settings.themeLight') }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="system">
              <ion-label>{{ i18n.t('settings.themeSystem') }}</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-item>
      </ion-list>

      <ion-list [inset]="true">
        <ion-list-header>{{ i18n.t('settings.language') }}</ion-list-header>
        <ion-item lines="none">
          <ion-segment
            [value]="settings.language()"
            (ionChange)="onLanguageChange($event)"
            [attr.aria-label]="i18n.t('a11y.language')"
          >
            <ion-segment-button value="en">
              <ion-label>English</ion-label>
            </ion-segment-button>
            <ion-segment-button value="de">
              <ion-label>Deutsch</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-item>
        <ion-item lines="none">
          <ion-note class="settings__sample">
            {{ i18n.t('settings.dateSample', { date: i18n.formatDate(sampleDate) }) }}
          </ion-note>
        </ion-item>
      </ion-list>

      <ion-list [inset]="true">
        <ion-list-header>{{ i18n.t('notebook.default') }}</ion-list-header>
        <ion-item lines="none">
          <ion-select
            [value]="notebooks.defaultId()"
            (ionChange)="onDefaultNotebookChange($event)"
            [label]="i18n.t('notebook.default')"
            labelPlacement="stacked"
            [interfaceOptions]="{ header: i18n.t('notebook.default') }"
          >
            @for (notebook of notebooks.notebooks(); track notebook.id) {
              <ion-select-option [value]="notebook.id">{{ notebook.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item lines="none">
          <ion-note class="settings__sample">{{ i18n.t('notebook.defaultHint') }}</ion-note>
        </ion-item>
      </ion-list>

      <ion-list [inset]="true">
        <ion-list-header>{{ i18n.t('settings.checklists') }}</ion-list-header>
        <ion-item lines="none">
          <ion-toggle
            [checked]="settings.moveCheckedToBottom()"
            (ionChange)="onMoveCheckedToBottomChange($event)"
          >
            {{ i18n.t('settings.moveCheckedToBottom') }}
          </ion-toggle>
        </ion-item>
        <ion-item lines="none">
          <ion-note class="settings__sample">
            {{ i18n.t('settings.moveCheckedToBottomHint') }}
          </ion-note>
        </ion-item>
      </ion-list>

      <ion-list [inset]="true">
        <ion-list-header>{{ i18n.t('settings.trash') }}</ion-list-header>
        <ion-item lines="none">
          <ion-select
            [value]="settings.trashAutoPurgeDays()"
            (ionChange)="onTrashAutoPurgeChange($event)"
            [label]="i18n.t('settings.trashAutoPurge')"
            labelPlacement="stacked"
            [attr.aria-label]="i18n.t('a11y.trashAutoPurge')"
            [interfaceOptions]="{ header: i18n.t('settings.trashAutoPurge') }"
          >
            <ion-select-option [value]="0">
              {{ i18n.t('settings.trashAutoPurgeNever') }}
            </ion-select-option>
            @for (days of autoPurgeChoices; track days) {
              <ion-select-option [value]="days">
                {{ i18n.t('settings.trashAutoPurgeDays', { count: days }) }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item lines="none">
          <ion-note class="settings__sample">{{ i18n.t('settings.trashAutoPurgeHint') }}</ion-note>
        </ion-item>
      </ion-list>

      @if (database.status() === 'error') {
        <ion-list [inset]="true">
          <ion-list-header>{{ i18n.t('settings.diagnostics') }}</ion-list-header>
          <ion-item lines="none">
            <ion-label class="settings__sample">{{ i18n.t('settings.databaseFailed') }}</ion-label>
          </ion-item>
          @if (database.error(); as message) {
            <ion-item lines="none">
              <ion-note class="settings__sample">{{ message }}</ion-note>
            </ion-item>
          }
        </ion-list>
      }

      <ion-list [inset]="true">
        <ion-item lines="none">
          <ion-note>{{ i18n.t('settings.localOnly') }}</ion-note>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: `
    .settings__sample {
      white-space: normal;
    }
  `,
})
export class SettingsPage {
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);
  readonly settings = inject(SettingsStore);
  readonly notebooks = inject(NotebooksStore);

  /**
   * The one place the engine's own message is shown. The list pages stay generic,
   * which keeps `core/database` out of the note features while still leaving the
   * user somewhere to find out *why* every list is empty.
   */
  readonly database = inject(DatabaseService);

  /** Shows what the language choice does to dates before any note exists. */
  readonly sampleDate = new Date().toISOString();

  /** 30 is the desktop's default (`docs/desktop-audit.md` §6); 0 is offered separately as "Never". */
  readonly autoPurgeChoices = [7, 14, 30, 60, 90];

  onThemeChange(event: Event): void {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    this.theme.setMode(value as ThemeMode);
  }

  onLanguageChange(event: Event): void {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    this.settings.setLanguage(value as LanguageCode);
  }

  onMoveCheckedToBottomChange(event: Event): void {
    const { checked } = (event as CustomEvent<{ checked: boolean }>).detail;
    this.settings.setMoveCheckedToBottom(checked);
  }

  onTrashAutoPurgeChange(event: Event): void {
    const { value } = (event as CustomEvent<{ value: number }>).detail;
    this.settings.setTrashAutoPurgeDays(value);
  }

  /**
   * The only row on this page that does not write `SettingsStore`. The default
   * notebook lives in `app_state` because it travels in the `.glacier.json`
   * envelope, and settings never do.
   */
  onDefaultNotebookChange(event: Event): void {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    if (value !== this.notebooks.defaultId()) {
      void this.notebooks.setDefault(value);
    }
  }
}
