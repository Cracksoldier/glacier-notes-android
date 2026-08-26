import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ArchivePage } from '../../features/archive/archive.page';

describe('PlaceholderPageComponent', () => {
  it('renders the wrapping page heading, menu button and empty state', async () => {
    await TestBed.configureTestingModule({ imports: [ArchivePage] }).compileComponents();

    const fixture = TestBed.createComponent(ArchivePage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('ion-title')?.textContent).toContain('Archive');
    expect(host.querySelector('ion-menu-button')?.getAttribute('aria-label')).toBe(
      'Open navigation menu',
    );
    expect(host.querySelector('.empty-state__title')?.textContent).toContain('Archive');
    expect(host.querySelector('.empty-state__message')?.textContent).toContain('Archived notes');
    expect(host.querySelector('.empty-state__icon')).toBeTruthy();
  });

  // ion-content is laid out by .ion-page, which only sizes its direct children,
  // so a host box here silently collapses every placeholder page to blank.
  it('does not introduce a box between the routed page and ion-content', () => {
    const fixture = TestBed.createComponent(ArchivePage);
    fixture.detectChanges();
    const placeholder = fixture.nativeElement.querySelector('app-placeholder-page') as HTMLElement;

    expect(getComputedStyle(placeholder).display).toBe('contents');
  });
});
