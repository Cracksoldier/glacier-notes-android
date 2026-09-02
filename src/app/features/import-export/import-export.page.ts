import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ExportService, type ExportResult } from '../../core/import-export/export.service';
import type { TranslationKey } from '../../core/localization/en';
import { I18nService } from '../../core/localization/i18n.service';

/**
 * M12's harness, not M14's destination. The export lands in app-private storage,
 * which needs no permission and no document picker; M14 replaces the button's
 * tail end with the Android save dialog and the share sheet, and adds the import
 * half M13 builds.
 */
@Component({
  selector: 'app-import-export-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button [attr.aria-label]="i18n.t('a11y.openMenu')" />
        </ion-buttons>
        <ion-title>{{ i18n.t('sidebar.importExport') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <section class="transfer">
        <h2 class="transfer__heading">{{ i18n.t('importExport.exportHeading') }}</h2>
        <p class="transfer__hint">{{ i18n.t('importExport.exportHint') }}</p>

        <ion-button expand="block" [disabled]="busy()" (click)="exportAll()">
          @if (busy()) {
            <ion-spinner slot="start" name="crescent" />
            {{ i18n.t('importExport.exporting') }}
          } @else {
            {{ i18n.t('importExport.exportAction') }}
          }
        </ion-button>

        @if (saved(); as result) {
          <div class="transfer__result">
            <p class="transfer__saved">
              {{
                i18n.t('importExport.exportDone', {
                  fileName: result.fileName,
                  size: i18n.formatBytes(result.byteLength),
                })
              }}
            </p>
            <ion-note>
              {{ i18n.t('importExport.exportCounts', result.counts) }}
            </ion-note>
            <ion-note>{{ i18n.t('importExport.exportLocation') }}</ion-note>
          </div>
        }

        @if (errorKey(); as key) {
          <p class="transfer__error" role="alert">
            {{ i18n.t(key, errorParams()) }}
          </p>
        }
      </section>
    </ion-content>
  `,
  styles: `
    .transfer {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .transfer__heading {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--glacier-text);
    }

    .transfer__hint {
      margin: 0;
      color: var(--glacier-text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .transfer__result {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .transfer__saved {
      margin: 0;
      color: var(--glacier-text);
      overflow-wrap: anywhere;
    }

    .transfer__error {
      margin: 0;
      color: var(--glacier-danger);
      line-height: 1.5;
    }
  `,
})
export class ImportExportPage {
  readonly i18n = inject(I18nService);
  private readonly exporter = inject(ExportService);

  protected readonly busy = signal(false);
  private readonly result = signal<ExportResult | undefined>(undefined);

  protected readonly saved = computed(() => {
    const result = this.result();
    return result?.status === 'saved' ? result : undefined;
  });

  protected readonly errorKey = computed<TranslationKey | undefined>(() => {
    switch (this.result()?.status) {
      case 'missing-images':
        return 'importExport.errorMissingImages';
      case 'invalid':
        return 'importExport.errorInvalid';
      case 'failed':
        return 'importExport.errorWrite';
      default:
        return undefined;
    }
  });

  protected readonly errorParams = computed((): Record<string, number> => {
    const result = this.result();
    return result?.status === 'missing-images' ? { count: result.imageCount } : {};
  });

  protected async exportAll(): Promise<void> {
    this.busy.set(true);
    // Clearing first so a second attempt cannot leave the previous run's
    // filename on screen next to a fresh failure.
    this.result.set(undefined);
    try {
      this.result.set(await this.exporter.exportAll());
    } finally {
      this.busy.set(false);
    }
  }
}
