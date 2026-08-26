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
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { LanguageCode, ThemeMode } from '../../core/preferences/settings.model';
import { SettingsStore } from '../../core/preferences/settings.store';
import { ThemeService } from '../../core/preferences/theme.service';

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
    IonTitle,
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

  /** Shows what the language choice does to dates before any note exists. */
  readonly sampleDate = new Date().toISOString();

  onThemeChange(event: Event): void {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    this.theme.setMode(value as ThemeMode);
  }

  onLanguageChange(event: Event): void {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    this.settings.setLanguage(value as LanguageCode);
  }
}
