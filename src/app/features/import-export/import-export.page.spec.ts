import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportService, type ExportResult } from '../../core/import-export/export.service';
import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
import { ImportExportPage } from './import-export.page';

describe('ImportExportPage', () => {
  const exporter = { exportAll: vi.fn<() => Promise<ExportResult>>() };

  beforeEach(() => {
    exporter.exportAll.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
        { provide: ExportService, useValue: exporter },
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

  async function exportAll(fixture: ComponentFixture<ImportExportPage>): Promise<void> {
    fixture.nativeElement.querySelector('ion-button').click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

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
    const button = fixture.nativeElement.querySelector('ion-button') as HTMLElement & {
      disabled: boolean;
    };

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);

    release(saved);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });
});
