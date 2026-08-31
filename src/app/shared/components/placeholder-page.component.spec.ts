import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { ImportExportPage } from '../../features/import-export/import-export.page';

// Import/export is the last page still routed to the placeholder, so it stands
// in for the component here. M12 takes it, and this spec goes with it.
describe('PlaceholderPageComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImportExportPage],
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    });
  });

  it('renders the wrapping page heading, menu button and empty state', async () => {
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(ImportExportPage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('ion-title')?.textContent).toContain('Import / Export');
    expect(host.querySelector('ion-menu-button')?.getAttribute('aria-label')).toBe(
      'Open navigation menu',
    );
    expect(host.querySelector('.empty-state__title')?.textContent).toContain('Import / Export');
    expect(host.querySelector('.empty-state__message')?.textContent).toContain('.glacier.json');
    expect(host.querySelector('.empty-state__icon')).toBeTruthy();
  });

  // ion-content is laid out by .ion-page, which only sizes its direct children,
  // so a host box here silently collapses every placeholder page to blank.
  it('does not introduce a box between the routed page and ion-content', () => {
    const fixture = TestBed.createComponent(ImportExportPage);
    fixture.detectChanges();
    const placeholder = fixture.nativeElement.querySelector('app-placeholder-page') as HTMLElement;

    expect(getComputedStyle(placeholder).display).toBe('contents');
  });
});
