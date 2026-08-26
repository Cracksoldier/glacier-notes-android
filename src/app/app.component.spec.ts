import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppComponent } from './app.component';
import { routes } from './app.routes';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    document.body.className = '';
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
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
    const declared = routes.filter((route) => route.path).map((route) => `/${route.path}`);

    expect(hrefs).toEqual([
      '/notes',
      '/notebooks',
      '/labels',
      '/archive',
      '/trash',
      '/import-export',
      '/settings',
    ]);
    for (const href of hrefs) {
      expect(declared).toContain(href);
    }
  });

  it('renders the section headings and disabled create rows', () => {
    const host: HTMLElement = fixture.nativeElement;
    const headings = [...host.querySelectorAll('.drawer__section-title')].map((el) =>
      el.textContent?.trim(),
    );
    const createRows = [...host.querySelectorAll('button.drawer__item--muted')];

    expect(headings).toEqual(['Notes', 'Notebooks', 'Labels']);
    expect(createRows.map((el) => el.textContent?.trim())).toEqual(['New notebook', 'New label']);
    expect(createRows.every((el) => (el as HTMLButtonElement).disabled)).toBe(true);
  });

  it('applies the default theme on startup', () => {
    expect(document.body.classList.contains('theme-dark')).toBe(true);
  });
});
