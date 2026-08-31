import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Note } from '../../core/models/note';
import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { LabelsStore } from '../labels/labels.store';
import { resetIntersectionObservers, triggerIntersection } from '../../../test-setup';
import { NoteListComponent } from './note-list.component';

/** The component's own `PAGE`, restated so a change to it fails here loudly. */
const PAGE = 30;

describe('NoteListComponent', () => {
  let repositories: TestRepositories;
  let fixture: ComponentFixture<NoteListComponent>;

  beforeEach(async () => {
    resetIntersectionObservers();
    TestBed.configureTestingModule({
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    });
    repositories = await createTestRepositories();
    await TestBed.inject(LabelsStore).load();

    fixture = TestBed.createComponent(NoteListComponent);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  function notes(count: number, pinned = 0): Note[] {
    return Array.from({ length: count }, (_, index) => ({
      // Ids only have to be distinct — `@for` tracks them and nothing here reads
      // the database back.
      id: `note-${String(index).padStart(4, '0')}`,
      notebookId: repositories.defaultNotebookId,
      type: 'text' as const,
      title: `Note ${index}`,
      content: `Body ${index}`,
      imageIds: [],
      pinned: index < pinned,
      archived: false,
      labels: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
  }

  function show(list: Note[]): void {
    fixture.componentRef.setInput('notes', list);
    fixture.detectChanges();
  }

  function cardCount(): number {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('app-note-card').length;
  }

  function sentinel(): Element | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.notes__sentinel');
  }

  it('renders a short list whole and offers nothing to grow into', () => {
    show(notes(12));

    expect(cardCount()).toBe(12);
    expect(sentinel()).toBeNull();
  });

  it('renders one page of a long list', () => {
    show(notes(200));

    expect(cardCount()).toBe(PAGE);
    expect(sentinel()).not.toBeNull();
  });

  it('grows by a page when the sentinel comes into view', () => {
    show(notes(200));

    expect(triggerIntersection()).toBe(1);
    fixture.detectChanges();
    expect(cardCount()).toBe(PAGE * 2);

    triggerIntersection();
    fixture.detectChanges();
    expect(cardCount()).toBe(PAGE * 3);
  });

  it('stops at the end of the list and takes the sentinel away with it', () => {
    show(notes(PAGE + 5));

    triggerIntersection();
    fixture.detectChanges();

    expect(cardCount()).toBe(PAGE + 5);
    expect(sentinel()).toBeNull();
    // Nothing left observing, so a later scroll cannot grow past the collection.
    expect(triggerIntersection()).toBe(0);
  });

  it('windows the pinned group and the rest together, in order', () => {
    show(notes(200, 10));

    const host: HTMLElement = fixture.nativeElement;
    const columns = host.querySelectorAll('.notes__column');
    expect(columns[0]?.querySelectorAll('app-note-card')).toHaveLength(10);
    expect(columns[1]?.querySelectorAll('app-note-card')).toHaveLength(PAGE - 10);
  });

  /**
   * Pinning or colouring a note hands the list a new array. Collapsing the
   * window there would move whatever the reader is looking at.
   */
  it('keeps what it has grown to when the same notes arrive as a new array', () => {
    const list = notes(200);
    show(list);
    triggerIntersection();
    fixture.detectChanges();
    expect(cardCount()).toBe(PAGE * 2);

    show([...list]);

    expect(cardCount()).toBe(PAGE * 2);
  });

  it('shrinks to fit when a shorter list replaces a longer one', () => {
    show(notes(200));
    triggerIntersection();
    fixture.detectChanges();

    show(notes(7));

    expect(cardCount()).toBe(7);
    expect(sentinel()).toBeNull();
  });
});
