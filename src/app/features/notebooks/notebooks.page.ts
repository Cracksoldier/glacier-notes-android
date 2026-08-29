import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { Notebook } from '../../core/models/notebook';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import {
  faBook,
  faEllipsisVertical,
  faPlus,
  faStar,
  faTriangleExclamation,
} from '../../shared/utilities/glacier-icons';
import { NotebookPrompts } from './notebook-prompts';
import { NotebooksStore } from './notebooks.store';

@Component({
  selector: 'app-notebooks-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    FaIconComponent,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonMenuButton,
    IonNote,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button [attr.aria-label]="i18n.t('a11y.openMenu')" />
        </ion-buttons>
        <ion-title>{{ i18n.t('sidebar.notebooks') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (hasError()) {
        <app-empty-state
          [icon]="errorIcon"
          [title]="i18n.t('error.loadTitle')"
          [message]="i18n.t('error.loadNotebooks')"
          [actionLabel]="i18n.t('error.retry')"
          (action)="retry()"
        />
      } @else if (isEmpty()) {
        <app-empty-state [icon]="bookIcon" [title]="i18n.t('notebook.none')" />
      } @else {
        <ion-list [inset]="true">
          @for (notebook of store.notebooks(); track notebook.id) {
            <ion-item button="true" (click)="open(notebook)">
              <fa-icon slot="start" [icon]="bookIcon" />
              <ion-label>{{ notebook.name }}</ion-label>
              @if (notebook.id === store.defaultId()) {
                <ion-note slot="end" class="notebooks__default">
                  <fa-icon [icon]="defaultIcon" />
                  {{ i18n.t('notebook.default') }}
                </ion-note>
              }
              <ion-button
                slot="end"
                fill="clear"
                (click)="showActions(notebook, $event)"
                [attr.aria-label]="i18n.t('a11y.notebookActions')"
              >
                <fa-icon [icon]="actionsIcon" />
              </ion-button>
            </ion-item>
          }
        </ion-list>
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="create()" [attr.aria-label]="i18n.t('a11y.newNotebook')">
          <fa-icon [icon]="addIcon" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: `
    .notebooks__default {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
  `,
})
export class NotebooksPage {
  readonly i18n = inject(I18nService);
  readonly store = inject(NotebooksStore);
  private readonly prompts = inject(NotebookPrompts);
  private readonly router = inject(Router);

  readonly bookIcon = faBook;
  readonly addIcon = faPlus;
  readonly actionsIcon = faEllipsisVertical;
  readonly defaultIcon = faStar;
  readonly errorIcon = faTriangleExclamation;

  protected readonly hasError = computed(() => this.store.status() === 'error');

  /**
   * Gated on `'ready'` rather than on the array alone. `NotebooksStore` is loaded
   * once for the session, so the page used to render "No notebooks yet" for the
   * whole of that load, and again permanently if it failed.
   */
  protected readonly isEmpty = computed(
    () => this.store.status() === 'ready' && this.store.notebooks().length === 0,
  );

  retry(): void {
    void this.store.load();
  }

  open(notebook: Notebook): void {
    void this.router.navigate(['/notebooks', notebook.id]);
  }

  showActions(notebook: Notebook, event: Event): void {
    // Without this the row's own click fires as well and navigates away
    // underneath the sheet.
    event.stopPropagation();
    void this.prompts.actions(notebook);
  }

  create(): void {
    void this.prompts.create();
  }
}
