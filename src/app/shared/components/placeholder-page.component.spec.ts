import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SearchPage } from '../../features/search/search.page';

describe('PlaceholderPageComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchPage],
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    });
  });

  it('renders the wrapping page heading, menu button and empty state', async () => {
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(SearchPage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('ion-title')?.textContent).toContain('Search');
    expect(host.querySelector('ion-menu-button')?.getAttribute('aria-label')).toBe(
      'Open navigation menu',
    );
    expect(host.querySelector('.empty-state__title')?.textContent).toContain('Search');
    expect(host.querySelector('.empty-state__message')?.textContent).toContain('Full-text search');
    expect(host.querySelector('.empty-state__icon')).toBeTruthy();
  });

  // ion-content is laid out by .ion-page, which only sizes its direct children,
  // so a host box here silently collapses every placeholder page to blank.
  it('does not introduce a box between the routed page and ion-content', () => {
    const fixture = TestBed.createComponent(SearchPage);
    fixture.detectChanges();
    const placeholder = fixture.nativeElement.querySelector('app-placeholder-page') as HTMLElement;

    expect(getComputedStyle(placeholder).display).toBe('contents');
  });
});
