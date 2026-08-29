import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { MemoryPreferencesAdapter } from './core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from './core/preferences/preferences-adapter';
import { SettingsStore } from './core/preferences/settings.store';
import { createTestRepositories, type TestRepositories } from './core/repositories/testing';
import { NotebooksStore } from './features/notebooks/notebooks.store';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let repositories: TestRepositories;

  beforeEach(async () => {
    document.body.className = '';
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter(routes),
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
      ],
    }).compileComponents();
    repositories = await createTestRepositories();

    fixture = TestBed.createComponent(AppComponent);
    // The component starts the load in its constructor but cannot await it.
    await TestBed.inject(NotebooksStore).load();
    fixture.detectChanges();
  });

  afterEach(async () => {
    await repositories.adapter.close();
  });

  it('renders the navigation drawer', () => {
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('ion-split-pane')).toBeTruthy();
    expect(host.querySelector('ion-menu')).toBeTruthy();
    expect(host.querySelector('.drawer__brand-name')?.textContent).toContain('Glacier Notes');
  });

  it('links every drawer destination to a declared route', () => {
    const host: HTMLElement = fixture.nativeElement;
    const hrefs = [...host.querySelectorAll('a.drawer__item')].map((a) => a.getAttribute('href'));

    expect(hrefs).toEqual([
      '/notes',
      '/notebooks',
      `/notebooks/${repositories.defaultNotebookId}`,
      '/labels',
      '/archive',
      '/trash',
      '/import-export',
      '/settings',
    ]);
    // The per-notebook links are matched by the `notebooks/:notebookId` route,
    // so only the static ones can be compared against a literal path.
    const declared = routes.filter((route) => route.path).map((route) => `/${route.path}`);
    for (const href of hrefs.filter(
      (href) => href !== `/notebooks/${repositories.defaultNotebookId}`,
    )) {
      expect(declared).toContain(href);
    }
  });

  it('renders one drawer entry per notebook', async () => {
    const store = TestBed.inject(NotebooksStore);
    await store.create('Work');
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const hrefs = [...host.querySelectorAll('a.drawer__item')].map((a) => a.getAttribute('href'));

    expect(hrefs.filter((href) => href?.startsWith('/notebooks/'))).toHaveLength(2);
    expect(host.querySelector('.drawer__nav')?.textContent).toContain('Work');
  });

  it('renders the section headings, with only the label create row still disabled', () => {
    const host: HTMLElement = fixture.nativeElement;
    const headings = [...host.querySelectorAll('.drawer__section-title')].map((el) =>
      el.textContent?.trim(),
    );
    const createRows = [...host.querySelectorAll<HTMLButtonElement>('button.drawer__item--muted')];

    expect(headings).toEqual(['Notes', 'Notebooks', 'Labels']);
    expect(createRows.map((el) => el.textContent?.trim())).toEqual(['New notebook', 'New label']);
    // Labels have no create flow until M08.
    expect(createRows.map((el) => el.disabled)).toEqual([false, true]);
  });

  it('applies the default theme on startup', () => {
    expect(document.body.classList.contains('theme-dark')).toBe(true);
  });

  it('resolves every drawer label, never leaking a raw translation key', () => {
    const host: HTMLElement = fixture.nativeElement;
    const labels = [...host.querySelectorAll('.drawer__item span, .drawer__section-title')].map(
      (el) => el.textContent?.trim() ?? '',
    );

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.filter((text) => text.includes('.'))).toEqual([]);
  });

  it('re-renders the drawer in German when the language changes', () => {
    const host: HTMLElement = fixture.nativeElement;

    TestBed.inject(SettingsStore).setLanguage('de');
    fixture.detectChanges();

    const headings = [...host.querySelectorAll('.drawer__section-title')].map((el) =>
      el.textContent?.trim(),
    );
    const footer = [...host.querySelectorAll('.drawer__footer .drawer__item span')].map((el) =>
      el.textContent?.trim(),
    );

    expect(headings).toEqual(['Notizen', 'Notizbücher', 'Labels']);
    expect(footer).toEqual(['Archiv', 'Papierkorb', 'Import / Export', 'Einstellungen']);
  });
});
