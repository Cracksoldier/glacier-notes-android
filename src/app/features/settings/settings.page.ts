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

import { type ThemeMode, ThemeService } from '../../core/preferences/theme.service';

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
          <ion-menu-button aria-label="Open navigation menu" />
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list [inset]="true">
        <ion-list-header>Appearance</ion-list-header>
        <ion-item lines="none">
          <ion-label>Theme</ion-label>
        </ion-item>
        <ion-item lines="none">
          <ion-segment
            [value]="theme.mode()"
            (ionChange)="onThemeChange($event)"
            aria-label="Theme mode"
          >
            <ion-segment-button value="dark">
              <ion-label>Dark</ion-label>
            </ion-segment-button>
            <ion-segment-button value="light">
              <ion-label>Light</ion-label>
            </ion-segment-button>
            <ion-segment-button value="system">
              <ion-label>System</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-item>
        <ion-item lines="none">
          <ion-note>Language, persistence and about details arrive in later milestones.</ion-note>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class SettingsPage {
  readonly theme = inject(ThemeService);

  onThemeChange(event: Event): void {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    this.theme.setMode(value as ThemeMode);
  }
}
