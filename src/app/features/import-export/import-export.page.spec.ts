import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportService, type ExportResult } from '../../core/import-export/export.service';
import {
  type ImportApplyResult,
  type ImportInspectResult,
  ImportService,
} from '../../core/import-export/import.service';
import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
import { LabelsStore } from '../labels/labels.store';
import { NotebooksStore } from '../notebooks/notebooks.store';
import { NotesStore } from '../notes/notes.store';
import { ImportExportPage } from './import-export.page';

describe('ImportExportPage', () => {
  const exporter = { exportAll: vi.fn<() => Promise<ExportResult>>() };
  const importer = {
    inspect: vi.fn<(file: File) => Promise<ImportInspectResult>>(),
    apply: vi.fn<(strategy: string) => Promise<ImportApplyResult>>(),
    cancel: vi.fn<() => void>(),
  };
  const stores = {
    notebooks: { load: vi.fn<() => Promise<void>>() },
    labels: { load: vi.fn<() => Promise<void>>() },
    notes: { load: vi.fn<() => Promise<void>>() },
  };

  beforeEach(() => {
    exporter.exportAll.mockReset();
    importer.inspect.mockReset();
    importer.apply.mockReset();
    importer.cancel.mockReset();
    for (const store of Object.values(stores)) {
      store.load.mockReset().mockResolvedValue(undefined);
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
        { provide: ExportService, useValue: exporter },
        { provide: ImportService, useValue: importer },
        { provide: NotebooksStore, useValue: stores.notebooks },
        { provide: LabelsStore, useValue: stores.labels },
        { provide: NotesStore, useValue: stores.notes },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function render(): ComponentFixture<ImportExportPage> {
    const fixture = TestBed.createComponent(ImportExportPage);
    fixture.detectChanges();
    return fixture;
  }

  function find(fixture: ComponentFixture<ImportExportPage>, selector: string): HTMLElement {
    const element = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    if (!element) {
      throw new Error(`missing ${selector}`);
    }
    return element;
  }

  async function exportAll(fixture: ComponentFixture<ImportExportPage>): Promise<void> {
    find(fixture, '.transfer__export').click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * The `change` handler reads `input.files`, which jsdom will not let a test
   * assign, so the picked file is planted on the element first.
   */
  async function pick(fixture: ComponentFixture<ImportExportPage>): Promise<void> {
    const input = find(fixture, 'input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'backup.glacier.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const ready: ImportInspectResult = {
    status: 'ready',
    fileName: 'backup.glacier.json',
    hasConflicts: false,
    counts: { notebooks: 2, notes: 6, labels: 1, images: 1 },
  };

  const saved: ExportResult = {
    status: 'saved',
    fileName: 'glacier-export-2026-07-19.glacier.json',
    byteLength: 1_400_000,
    counts: { notebooks: 2, notes: 6, labels: 1, images: 1 },
  };

  it('reports the file name, its formatted size and the counts', async () => {
    exporter.exportAll.mockResolvedValue(saved);
    const fixture = render();

    await exportAll(fixture);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('glacier-export-2026-07-19.glacier.json');
    expect(text).toContain('1.4 MB');
    expect(text).toContain('2 notebooks · 6 notes · 1 labels · 1 images');
  });

  it('follows the selected language', async () => {
    exporter.exportAll.mockResolvedValue(saved);
    TestBed.inject(SettingsStore).setLanguage('de');
    const fixture = render();

    await exportAll(fixture);

    expect(fixture.nativeElement.textContent).toContain('1,4 MB');
  });

  it('names the failure and offers it as an alert', async () => {
    exporter.exportAll.mockResolvedValue({ status: 'missing-images', imageCount: 3 });
    const fixture = render();

    await exportAll(fixture);

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('3 attached images are missing');
  });

  it('reports a write failure without claiming a file was saved', async () => {
    exporter.exportAll.mockResolvedValue({ status: 'failed' });
    const fixture = render();

    await exportAll(fixture);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Could not write the export');
    expect(text).not.toContain('glacier-export-');
  });

  /** A stale filename beside a fresh failure would read as a successful export. */
  it('clears a previous result before the next attempt', async () => {
    exporter.exportAll.mockResolvedValueOnce(saved).mockResolvedValueOnce({ status: 'failed' });
    const fixture = render();

    await exportAll(fixture);
    await exportAll(fixture);

    expect(fixture.nativeElement.textContent).not.toContain('glacier-export-2026-07-19');
  });

  it('disables the button while the export runs', async () => {
    let release = (_result: ExportResult) => {};
    exporter.exportAll.mockReturnValue(
      new Promise<ExportResult>((resolve) => {
        release = resolve;
      }),
    );
    const fixture = render();
    const button = find(fixture, '.transfer__export') as HTMLElement & { disabled: boolean };

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);

    release(saved);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });

  it('previews a file without conflicts and imports it with preserve', async () => {
    importer.inspect.mockResolvedValue(ready);
    importer.apply.mockResolvedValue({ status: 'done', counts: ready.counts });
    const fixture = render();

    await pick(fixture);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('backup.glacier.json');
    expect(text).toContain('2 notebooks · 6 notes · 1 labels · 1 images');
    expect(text).toContain('Nothing in this file exists here yet');
    // The strategy is not a question when there is nothing to overwrite.
    expect(fixture.nativeElement.querySelector('ion-radio-group')).toBeNull();

    find(fixture, '.transfer__confirm').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(importer.apply).toHaveBeenCalledWith('preserve');
    expect(fixture.nativeElement.textContent).toContain('Imported 2 notebooks');
  });

  it('offers both strategies on a conflicting file and applies the chosen one', async () => {
    importer.inspect.mockResolvedValue({ ...ready, hasConflicts: true });
    importer.apply.mockResolvedValue({ status: 'done', counts: ready.counts });
    const fixture = render();

    await pick(fixture);

    const group = find(fixture, 'ion-radio-group');
    const values = [...fixture.nativeElement.querySelectorAll('ion-radio')].map(
      (radio: Element) => (radio as HTMLElement & { value: string }).value,
    );
    expect(values).toEqual(['copy', 'replace']);
    expect(fixture.nativeElement.textContent).toContain('Some entries already exist here');

    group.dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'copy' } }));
    fixture.detectChanges();
    find(fixture, '.transfer__confirm').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(importer.apply).toHaveBeenCalledWith('copy');
  });

  /** Replacing is the desktop's default, because the common case is a restore. */
  it('defaults a conflicting file to replace', async () => {
    importer.inspect.mockResolvedValue({ ...ready, hasConflicts: true });
    importer.apply.mockResolvedValue({ status: 'done', counts: ready.counts });
    const fixture = render();

    await pick(fixture);
    find(fixture, '.transfer__confirm').click();
    await fixture.whenStable();

    expect(importer.apply).toHaveBeenCalledWith('replace');
  });

  it('reloads the stores after a successful import', async () => {
    importer.inspect.mockResolvedValue(ready);
    importer.apply.mockResolvedValue({ status: 'done', counts: ready.counts });
    const fixture = render();

    await pick(fixture);
    find(fixture, '.transfer__confirm').click();
    await fixture.whenStable();

    expect(stores.notebooks.load).toHaveBeenCalled();
    expect(stores.labels.load).toHaveBeenCalled();
    expect(stores.notes.load).toHaveBeenCalled();
  });

  it('leaves the stores alone when the import fails', async () => {
    importer.inspect.mockResolvedValue(ready);
    importer.apply.mockResolvedValue({ status: 'failed' });
    const fixture = render();

    await pick(fixture);
    find(fixture, '.transfer__confirm').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(stores.notes.load).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('nothing was changed');
  });

  it('shows a bounded list of validation problems', async () => {
    importer.inspect.mockResolvedValue({
      status: 'invalid',
      errors: Array.from({ length: 8 }, (_, index) => `notes[${index}]: missing id`),
    });
    const fixture = render();

    await pick(fixture);

    const items = fixture.nativeElement.querySelectorAll('.transfer__errorList li');
    expect(items.length).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('3 further problems are not shown');
    expect(fixture.nativeElement.querySelector('.transfer__confirm')).toBeNull();
  });

  it('cancels without importing', async () => {
    importer.inspect.mockResolvedValue(ready);
    const fixture = render();

    await pick(fixture);
    find(fixture, '.transfer__cancel').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(importer.cancel).toHaveBeenCalled();
    expect(importer.apply).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('backup.glacier.json');
  });

  it('renders the import section in German', async () => {
    importer.inspect.mockResolvedValue({ ...ready, hasConflicts: true });
    TestBed.inject(SettingsStore).setLanguage('de');
    const fixture = render();

    await pick(fixture);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Als Kopien hinzufügen');
    expect(text).toContain('Vorhandene ersetzen');
  });
});
