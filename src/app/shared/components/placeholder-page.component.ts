import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { I18nService } from '../../core/localization/i18n.service';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { EmptyStateComponent } from './empty-state.component';

// Scaffolding for the drawer destinations whose features land in later
// milestones; each is replaced by a real page as its milestone arrives.
@Component({
  selector: 'app-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    IonButtons,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button [attr.aria-label]="i18n.t('a11y.openMenu')" />
        </ion-buttons>
        <ion-title>{{ heading() }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-empty-state [icon]="icon()" [title]="heading()" [message]="message()" />
    </ion-content>
  `,
  // The routed page wraps this one, so this host sits between .ion-page and
  // ion-content and would otherwise collapse it to zero height -- .ion-page
  // only lays out its direct children.
  styles: ':host { display: contents; }',
})
export class PlaceholderPageComponent {
  readonly i18n = inject(I18nService);

  readonly heading = input.required<string>();
  readonly icon = input.required<IconDefinition>();
  readonly message = input('');
}
