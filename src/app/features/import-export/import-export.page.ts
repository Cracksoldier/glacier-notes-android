import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonMenuButton,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import type { ExportDestination } from '../../core/filesystem/export-file-writer';
import { ExportService, type ExportResult } from '../../core/import-export/export.service';
import {
  type ImportApplyResult,
  type ImportInspectResult,
  ImportService,
} from '../../core/import-export/import.service';
import type { ImportStrategy } from '../../core/import-export/transfer-contract';
import type { TranslationKey } from '../../core/localization/en';
import { I18nService } from '../../core/localization/i18n.service';
import { DOCUMENT_GATEWAY } from '../../core/native/document-gateway';
import { LabelsStore } from '../labels/labels.store';
import { NotebooksStore } from '../notebooks/notebooks.store';
import { NotesStore } from '../notes/notes.store';
import { ImportPrompts } from './import-prompts';

/**
 * How many validator diagnostics are shown before the rest are counted. They are
 * English technical messages naming array indices, ids and field names — never
 * note content — so they are safe to put on screen, but a badly damaged file can
 * produce hundreds.
 */
const SHOWN_ERRORS = 5;

/**
 * Both ends of the transfer, over the system's own file UI.
 *
 * Import goes through `DOCUMENT_GATEWAY.open()` and export through the writer's
 * two destinations, so nothing here knows what a `content://` URI is. A
 * cancellation is a status on every one of those calls rather than a rejection,
 * which is why the handlers below have no `catch`: the only thing left to throw
 * is a bug.
 *
 * The import preview is an inline section rather than a modal or an alert on
 * purpose: an Ionic overlay puts its contents outside the component under jsdom,
 * which would make the whole conflict flow untestable — the rule
 * `docs/notebooks.md` records. The one alert that remains, the replace warning,
 * is behind `ImportPrompts` for the same reason.
 */
@Component({
  selector: 'app-import-export-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonMenuButton,
    IonNote,
    IonRadio,
    IonRadioGroup,
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
        <h2 class="transfer__heading">{{ i18n.t('importExport.importHeading') }}</h2>
        <p class="transfer__hint">{{ i18n.t('importExport.importHint') }}</p>

        <ion-button
          class="transfer__pick"
          expand="block"
          fill="outline"
          [disabled]="busy()"
          (click)="pickFile()"
        >
          {{ i18n.t('importExport.importAction') }}
        </ion-button>

        @if (preview(); as file) {
          <div class="transfer__result">
            <p class="transfer__saved">
              {{ file.fileName ?? i18n.t('importExport.importUnnamedFile') }}
            </p>
            <ion-note>{{ i18n.t('importExport.exportCounts', file.counts) }}</ion-note>
            <ion-note>
              {{
                i18n.t(
                  file.hasConflicts
                    ? 'importExport.importConflicts'
                    : 'importExport.importNoConflicts'
                )
              }}
            </ion-note>
          </div>

          @if (file.hasConflicts) {
            <ion-radio-group
              [value]="strategy()"
              (ionChange)="onStrategyChange($event)"
              [attr.aria-label]="i18n.t('importExport.importConflicts')"
            >
              <ion-item lines="none">
                <ion-radio value="copy" justify="start" labelPlacement="end">
                  <span class="transfer__choice">
                    {{ i18n.t('importExport.importAddCopies') }}
                    <ion-note>{{ i18n.t('importExport.importAddCopiesHint') }}</ion-note>
                  </span>
                </ion-radio>
              </ion-item>
              <ion-item lines="none">
                <ion-radio value="replace" justify="start" labelPlacement="end">
                  <span class="transfer__choice">
                    {{ i18n.t('importExport.importReplaceById') }}
                    <ion-note>{{ i18n.t('importExport.importReplaceByIdHint') }}</ion-note>
                  </span>
                </ion-radio>
              </ion-item>
            </ion-radio-group>
          }

          <div class="transfer__actions">
            <ion-button class="transfer__cancel" fill="clear" [disabled]="busy()" (click)="cancelImport()">
              {{ i18n.t('importExport.importCancel') }}
            </ion-button>
            <ion-button class="transfer__confirm" [disabled]="busy()" (click)="runImport()">
              @if (busy()) {
                <ion-spinner slot="start" name="crescent" />
                {{ i18n.t('importExport.importing') }}
              } @else {
                {{ i18n.t('importExport.importConfirm') }}
              }
            </ion-button>
          </div>
        }

        @if (shownErrors(); as errors) {
          <div class="transfer__errors" role="alert">
            <p class="transfer__error">{{ i18n.t('importExport.importErrorHeading') }}</p>
            <ul class="transfer__errorList">
              @for (error of errors; track $index) {
                <li>{{ error }}</li>
              }
            </ul>
            @if (hiddenErrorCount(); as count) {
              <ion-note>{{ i18n.t('importExport.importMoreErrors', { count }) }}</ion-note>
            }
          </div>
        }

        @if (imported(); as result) {
          <p class="transfer__saved">{{ i18n.t('importExport.importDone', result.counts) }}</p>
        }

        @if (importErrorKey(); as key) {
          <p class="transfer__error" role="alert">{{ i18n.t(key) }}</p>
        }
      </section>

      <section class="transfer">
        <h2 class="transfer__heading">{{ i18n.t('importExport.exportHeading') }}</h2>
        <p class="transfer__hint">{{ i18n.t('importExport.exportHint') }}</p>

        <ion-button
          class="transfer__export"
          expand="block"
          [disabled]="busy()"
          (click)="exportAll('save')"
        >
          @if (busy()) {
            <ion-spinner slot="start" name="crescent" />
            {{ i18n.t('importExport.exporting') }}
          } @else {
            {{ i18n.t('importExport.exportSave') }}
          }
        </ion-button>
        <ion-button
          class="transfer__share"
          expand="block"
          fill="outline"
          [disabled]="busy()"
          (click)="exportAll('share')"
        >
          {{ i18n.t('importExport.exportShare') }}
        </ion-button>

        @if (saved(); as result) {
          <div class="transfer__result">
            <p class="transfer__saved">
              {{
                i18n.t(
                  result.destination === 'share'
                    ? 'importExport.exportShared'
                    : 'importExport.exportDone',
                  { fileName: result.fileName, size: i18n.formatBytes(result.byteLength) }
                )
              }}
            </p>
            <ion-note>
              {{ i18n.t('importExport.exportCounts', result.counts) }}
            </ion-note>
            <ion-note>
              {{
                i18n.t(
                  result.destination === 'share'
                    ? 'importExport.exportSharedWhere'
                    : 'importExport.exportSavedWhere'
                )
              }}
            </ion-note>
          </div>
        }

        @if (errorKey(); as key) {
          <p class="transfer__error" role="alert">
            {{ i18n.t(key, errorParams()) }}
          </p>
        }
      </section>

      <section class="transfer">
        <h2 class="transfer__heading">{{ i18n.t('importExport.disclosureHeading') }}</h2>
        <p class="transfer__hint">{{ i18n.t('importExport.disclosureUnencrypted') }}</p>
        <p class="transfer__hint">{{ i18n.t('importExport.disclosureUninstall') }}</p>
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

    .transfer__choice {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      white-space: normal;
    }

    .transfer__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .transfer__errors {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .transfer__errorList {
      margin: 0;
      padding-inline-start: 1.25rem;
      color: var(--glacier-text-muted);
      font-size: 0.85rem;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
  `,
})
export class ImportExportPage {
  readonly i18n = inject(I18nService);
  private readonly exporter = inject(ExportService);
  private readonly importer = inject(ImportService);
  private readonly documents = inject(DOCUMENT_GATEWAY);
  private readonly prompts = inject(ImportPrompts);
  private readonly notebooks = inject(NotebooksStore);
  private readonly labels = inject(LabelsStore);
  private readonly notes = inject(NotesStore);

  /** Shared with the export button, so nothing queues behind a long import. */
  protected readonly busy = signal(false);
  private readonly result = signal<ExportResult | undefined>(undefined);
  private readonly inspection = signal<ImportInspectResult | undefined>(undefined);
  private readonly applied = signal<ImportApplyResult | undefined>(undefined);

  /**
   * Kept apart from `inspection`, because these are outcomes of the picker
   * rather than of the file: nothing was ever read, so there is nothing to
   * inspect. A `cancelled` picker sets nothing at all.
   */
  private readonly openFailure = signal<'too-large' | 'failed' | undefined>(undefined);

  /**
   * Only ever the two the desktop offers. `preserve` is not a choice — it is
   * what a file without conflicts gets, which is what makes restoring a backup
   * onto a fresh phone work without asking a question the user cannot answer.
   */
  protected readonly strategy = signal<Extract<ImportStrategy, 'copy' | 'replace'>>('replace');

  protected readonly preview = computed(() => {
    const inspection = this.inspection();
    return inspection?.status === 'ready' ? inspection : undefined;
  });

  protected readonly shownErrors = computed(() => {
    const inspection = this.inspection();
    return inspection?.status === 'invalid' ? inspection.errors.slice(0, SHOWN_ERRORS) : undefined;
  });

  protected readonly hiddenErrorCount = computed(() => {
    const inspection = this.inspection();
    return inspection?.status === 'invalid'
      ? Math.max(0, inspection.errors.length - SHOWN_ERRORS)
      : 0;
  });

  protected readonly imported = computed(() => {
    const applied = this.applied();
    return applied?.status === 'done' ? applied : undefined;
  });

  protected readonly importErrorKey = computed<TranslationKey | undefined>(() => {
    const failure = this.openFailure();
    if (failure !== undefined) {
      return failure === 'too-large'
        ? 'importExport.importErrorTooLarge'
        : 'importExport.importErrorRead';
    }
    if (this.inspection()?.status === 'failed') {
      return 'importExport.importErrorRead';
    }
    const applied = this.applied();
    return applied !== undefined && applied.status !== 'done'
      ? 'importExport.importErrorApply'
      : undefined;
  });

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

  protected async exportAll(destination: ExportDestination): Promise<void> {
    this.busy.set(true);
    // Clearing first so a second attempt cannot leave the previous run's
    // filename on screen next to a fresh failure.
    this.result.set(undefined);
    try {
      this.result.set(await this.exporter.exportAll(destination));
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * `busy` covers the picker too, although the read happens natively: the user
   * can return from the dialog to a page whose previous result is gone, and a
   * second tap while the first document is still being parsed would race it.
   */
  protected async pickFile(): Promise<void> {
    this.inspection.set(undefined);
    this.applied.set(undefined);
    this.openFailure.set(undefined);
    this.strategy.set('replace');
    this.busy.set(true);
    try {
      const opened = await this.documents.open();
      switch (opened.status) {
        case 'opened':
          this.inspection.set(await this.importer.inspect(opened.document));
          break;
        case 'cancelled':
          break;
        default:
          this.openFailure.set(opened.status);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected onStrategyChange(event: Event): void {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    this.strategy.set(value === 'copy' ? 'copy' : 'replace');
  }

  protected cancelImport(): void {
    this.importer.cancel();
    this.inspection.set(undefined);
  }

  /**
   * The stores are reloaded rather than left to reload themselves: a list page
   * re-asserting its view on re-enter is a no-op by design
   * (`docs/markdown-and-editor.md`), so without this the grid, the notebook list
   * and the sidebar's labels stay as they were until the app restarts.
   * `NotebooksStore` also caches the default notebook id, which an exact restore
   * changes.
   */
  protected async runImport(): Promise<void> {
    const preview = this.preview();
    if (!preview) {
      return;
    }
    const strategy: ImportStrategy = preview.hasConflicts ? this.strategy() : 'preserve';
    if (strategy === 'replace' && !(await this.prompts.confirmReplace())) {
      return;
    }
    this.busy.set(true);
    try {
      const applied = await this.importer.apply(strategy);
      this.applied.set(applied);
      this.inspection.set(undefined);
      if (applied.status === 'done') {
        await this.notebooks.load();
        await this.labels.load();
        await this.notes.load();
      }
    } finally {
      this.busy.set(false);
    }
  }
}
