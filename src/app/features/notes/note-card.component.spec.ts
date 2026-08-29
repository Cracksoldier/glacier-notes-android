import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Note } from '../../core/models/note';
import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { LabelsStore } from '../labels/labels.store';
import { NoteCardComponent } from './note-card.component';

describe('NoteCardComponent', () => {
  let repositories: TestRepositories;
  let labels: LabelsStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    });
    repositories = await createTestRepositories();
    labels = TestBed.inject(LabelsStore);
    await labels.load();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  function render(note: Partial<Note> = {}): ComponentFixture<NoteCardComponent> {
    const fixture = TestBed.createComponent(NoteCardComponent);
    fixture.componentRef.setInput('note', {
      id: 'ffffffff-0000-0000-0000-000000000000',
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      title: '',
      content: '',
      imageIds: [],
      pinned: false,
      archived: false,
      labels: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...note,
    } satisfies Note);
    fixture.detectChanges();
    return fixture;
  }

  /** jsdom has no PointerEvent, and MouseEvent carries the two fields the card reads. */
  function pointer(host: HTMLElement, type: string, x = 0, y = 0): void {
    host.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
  }

  it('renders the title, the rendered preview and neither pin nor chips by default', () => {
    const host: HTMLElement = render({ title: 'Groceries', content: '**milk**' }).nativeElement;

    expect(host.querySelector('.note-card__title')?.textContent).toContain('Groceries');
    expect(host.querySelector('.note-card__preview')?.innerHTML).toContain('<strong>milk</strong>');
    expect(host.querySelector('.note-card__pin')).toBeNull();
    expect(host.querySelector('.note-card__labels')).toBeNull();
  });

  it('badges a pinned note', () => {
    const host: HTMLElement = render({ pinned: true }).nativeElement;

    expect(host.querySelector('.note-card__pin')).not.toBeNull();
  });

  // A card can outlive a label deleted from the drawer, so an unknown id is
  // skipped rather than rendered as a blank chip.
  it('names the labels it knows and skips the ones it does not', async () => {
    const work = await labels.create('Work');
    const host: HTMLElement = render({ labels: [work.id, 'gone'] }).nativeElement;

    expect([...host.querySelectorAll('.note-card__label')].map((el) => el.textContent)).toEqual([
      'Work',
    ]);
  });

  it('paints a known colour and leaves an unknown one to the stylesheet', () => {
    const known: HTMLElement = render({ color: 'teal' }).nativeElement;
    const unknown: HTMLElement = render({ color: 'chartreuse' as Note['color'] }).nativeElement;

    expect(known.querySelector<HTMLElement>('.note-card')?.style.backgroundColor).toBe(
      'var(--note-teal)',
    );
    expect(unknown.querySelector<HTMLElement>('.note-card')?.style.backgroundColor).toBe('');
  });

  describe('the gesture', () => {
    it('opens the note on a tap', () => {
      const fixture = render();
      const opened = vi.fn();
      fixture.componentInstance.open.subscribe(opened);
      const host: HTMLElement = fixture.nativeElement;

      pointer(host, 'pointerdown', 10, 10);
      pointer(host, 'pointerup', 10, 10);
      host.click();

      expect(opened).toHaveBeenCalledTimes(1);
    });

    // The click that follows a fired long press belongs to the same gesture and
    // would otherwise open the editor behind the action sheet.
    it('emits a long press and swallows the click that follows it', () => {
      vi.useFakeTimers();
      const fixture = render();
      const opened = vi.fn();
      const pressed = vi.fn();
      fixture.componentInstance.open.subscribe(opened);
      fixture.componentInstance.longPress.subscribe(pressed);
      const host: HTMLElement = fixture.nativeElement;

      pointer(host, 'pointerdown', 10, 10);
      vi.advanceTimersByTime(500);
      pointer(host, 'pointerup', 10, 10);
      host.click();

      expect(pressed).toHaveBeenCalledTimes(1);
      expect(opened).not.toHaveBeenCalled();

      // Only that one click is swallowed.
      pointer(host, 'pointerdown', 10, 10);
      pointer(host, 'pointerup', 10, 10);
      host.click();
      expect(opened).toHaveBeenCalledTimes(1);
    });

    it('cancels the press when the finger scrolls the list away', () => {
      vi.useFakeTimers();
      const fixture = render();
      const pressed = vi.fn();
      fixture.componentInstance.longPress.subscribe(pressed);
      const host: HTMLElement = fixture.nativeElement;

      pointer(host, 'pointerdown', 10, 10);
      pointer(host, 'pointermove', 10, 80);
      vi.advanceTimersByTime(500);

      expect(pressed).not.toHaveBeenCalled();
    });

    it('drops a pending press when the card is destroyed mid-gesture', () => {
      vi.useFakeTimers();
      const fixture = render();
      const pressed = vi.fn();
      fixture.componentInstance.longPress.subscribe(pressed);

      pointer(fixture.nativeElement, 'pointerdown', 10, 10);
      fixture.destroy();
      vi.advanceTimersByTime(500);

      expect(pressed).not.toHaveBeenCalled();
    });
  });
});
