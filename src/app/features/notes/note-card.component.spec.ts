import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Note } from '../../core/models/note';
import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { SettingsStore } from '../../core/preferences/settings.store';
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

  function render(
    note: Partial<Note> = {},
    searchQuery: string | null = null,
  ): ComponentFixture<NoteCardComponent> {
    const fixture = TestBed.createComponent(NoteCardComponent);
    fixture.componentRef.setInput('searchQuery', searchQuery);
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

  describe('the checklist preview', () => {
    function items(count: number, checked = false) {
      return Array.from({ length: count }, (_, index) => ({
        id: `i${index}`,
        text: `item ${index}`,
        checked,
        sortOrder: index,
      }));
    }

    // The editor edits Markdown source; the card renders it, inline only.
    it('renders each item with its check state and inline markup', () => {
      const host: HTMLElement = render({
        type: 'checklist',
        checklist: [
          { id: 'a', text: '**milk**', checked: false, sortOrder: 0 },
          { id: 'b', text: 'eggs', checked: true, sortOrder: 1 },
        ],
      }).nativeElement;

      const rows = [...host.querySelectorAll('.note-card__item')];
      expect(rows[0]?.querySelector('.note-card__item-text')?.innerHTML).toBe(
        '<strong>milk</strong>',
      );
      expect(rows[0]?.classList.contains('note-card__item--checked')).toBe(false);
      expect(rows[1]?.classList.contains('note-card__item--checked')).toBe(true);
      expect(host.querySelector('.note-card__more')).toBeNull();
    });

    it('cuts the list off and counts the remainder', () => {
      const host: HTMLElement = render({
        type: 'checklist',
        checklist: items(11),
      }).nativeElement;

      expect(host.querySelectorAll('.note-card__item')).toHaveLength(8);
      expect(host.querySelector('.note-card__more')?.textContent).toContain('+3 more');
    });

    it('skips blank rows and falls back to the empty note line', () => {
      const host: HTMLElement = render({
        type: 'checklist',
        checklist: [{ id: 'a', text: '  ', checked: false, sortOrder: 0 }],
      }).nativeElement;

      expect(host.querySelector('.note-card__item')).toBeNull();
      expect(host.querySelector('.note-card__blank')?.textContent).toContain('Empty note');
    });

    it('groups checked items last when the setting is on', () => {
      TestBed.inject(SettingsStore).setMoveCheckedToBottom(true);
      const host: HTMLElement = render({
        type: 'checklist',
        checklist: [
          { id: 'a', text: 'milk', checked: true, sortOrder: 0 },
          { id: 'b', text: 'eggs', checked: false, sortOrder: 1 },
        ],
      }).nativeElement;

      expect(
        [...host.querySelectorAll('.note-card__item-text')].map((el) => el.textContent),
      ).toEqual(['eggs', 'milk']);
    });
  });

  describe('the thumbnail row', () => {
    function id(index: number): string {
      return `1111111${index}-2222-3333-4444-555555555555`;
    }

    async function store(count: number): Promise<void> {
      for (let index = 0; index < count; index += 1) {
        await repositories.files.write(id(index), 'QUJD', 'image/png');
      }
    }

    function sources(host: HTMLElement): string[] {
      return [...host.querySelectorAll<HTMLImageElement>('.note-card__thumb')].map(
        (img) => img.getAttribute('src') ?? '',
      );
    }

    it('shows one thumbnail per attachment and stops at three', async () => {
      await store(4);
      const host: HTMLElement = render({
        imageIds: [id(0), id(1), id(2), id(3)],
      }).nativeElement;

      expect(sources(host)).toEqual([
        repositories.files.url(id(0)),
        repositories.files.url(id(1)),
        repositories.files.url(id(2)),
      ]);
    });

    /** An imported note can embed an image its junction rows never claimed. */
    it('draws an image mentioned only in the body', async () => {
      await store(1);
      const host: HTMLElement = render({
        content: `![a](glacier-img://${id(0)})`,
      }).nativeElement;

      expect(sources(host)).toEqual([repositories.files.url(id(0))]);
    });

    /** The preview resolves image sources too, so it must not draw them again. */
    it('keeps the image out of the preview, so it appears once', async () => {
      await store(1);
      const host: HTMLElement = render({
        content: `text\n![a](glacier-img://${id(0)})`,
      }).nativeElement;

      const preview = host.querySelector('.note-card__preview');
      expect(preview?.querySelector('img')).toBeNull();
      expect(preview?.textContent).toContain('text');
    });

    it('does not call a note that is nothing but an image empty', async () => {
      await store(1);
      const host: HTMLElement = render({
        content: `![a](glacier-img://${id(0)})`,
      }).nativeElement;

      expect(host.querySelector('.note-card__blank')).toBeNull();
    });
  });

  describe('under a search', () => {
    it('marks the query in the title, the preview and a checklist row', () => {
      const body: HTMLElement = render(
        { title: 'Einkaufsliste', content: 'auch **kaufen**' },
        'kauf',
      ).nativeElement;
      const list: HTMLElement = render(
        {
          type: 'checklist',
          checklist: [{ id: 'a', text: 'einkaufen gehen', checked: false, sortOrder: 0 }],
        },
        'kauf',
      ).nativeElement;

      const title = body.querySelector('.note-card__title');
      expect(title?.querySelector('mark')?.textContent).toBe('kauf');
      expect(title?.textContent).toBe('Einkaufsliste');
      expect(body.querySelector('.note-card__preview')?.innerHTML).toContain('<mark>kauf</mark>');
      expect(list.querySelector('.note-card__item-text')?.innerHTML).toContain('<mark>kauf</mark>');
    });

    it('marks nothing when no query is set', () => {
      const host: HTMLElement = render({ title: 'Einkaufsliste', content: 'kaufen' }).nativeElement;

      expect(host.querySelector('mark')).toBeNull();
    });

    // The `all` scope is the only view that mixes the two, so the badge only has
    // something to say there.
    it('badges an archived hit, and only while searching', () => {
      expect(
        (render({ archived: true }, 'x').nativeElement as HTMLElement).querySelector(
          '.note-card__archived',
        ),
      ).not.toBeNull();
      expect(
        (render({ archived: true }).nativeElement as HTMLElement).querySelector(
          '.note-card__archived',
        ),
      ).toBeNull();
      expect(
        (render({}, 'x').nativeElement as HTMLElement).querySelector('.note-card__archived'),
      ).toBeNull();
    });

    it('says so in the accessible name too, since role=button hides the badge', () => {
      const host: HTMLElement = render({ title: 'Note', archived: true }, 'x').nativeElement;

      expect(host.getAttribute('aria-label')).toBe('Note. Archived');
    });
  });

  it('paints a known colour and leaves an unknown one to the stylesheet', () => {
    const known: HTMLElement = render({ color: 'teal' }).nativeElement;
    const unknown: HTMLElement = render({ color: 'chartreuse' as Note['color'] }).nativeElement;

    expect(known.querySelector<HTMLElement>('.note-card')?.style.backgroundColor).toBe(
      'var(--note-teal)',
    );
    expect(unknown.querySelector<HTMLElement>('.note-card')?.style.backgroundColor).toBe('');
  });

  /**
   * `role="button"` hides the card's own heading, preview and label list from
   * assistive technology, so the label has to say everything they said.
   */
  describe('the accessible name', () => {
    function label(note: Partial<Note>): string {
      return (render(note).nativeElement as HTMLElement).getAttribute('aria-label') ?? '';
    }

    it('is a button that can be reached by keyboard', () => {
      const host: HTMLElement = render().nativeElement;

      expect(host.getAttribute('role')).toBe('button');
      expect(host.getAttribute('tabindex')).toBe('0');
    });

    it('leads with the title and names the pin, the labels and the images', async () => {
      const work = await labels.create('Work');
      await repositories.files.write('11111111-2222-3333-4444-555555555555', 'QUJD', 'image/png');

      expect(
        label({
          title: 'Groceries',
          pinned: true,
          labels: [work.id],
          imageIds: ['11111111-2222-3333-4444-555555555555'],
        }),
      ).toBe('Groceries. Pinned. Labels: Work. Images: 1');
    });

    it('falls back to the first line, then the first row, then the empty note text', () => {
      expect(label({ content: 'milk\neggs' })).toBe('milk');
      expect(
        label({
          type: 'checklist',
          checklist: [{ id: 'a', text: 'milk', checked: false, sortOrder: 0 }],
        }),
      ).toBe('milk');
      expect(label({})).toBe('Empty note');
    });
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

    /**
     * The long press is the only route to the actions sheet and it needs a
     * pointer, so without a key equivalent the sheet is unreachable to anyone
     * navigating by keyboard or assistive technology.
     */
    it.each([
      ['Enter', 'open'],
      [' ', 'open'],
      ['ContextMenu', 'longPress'],
    ] as const)('maps %s onto %s', (key, expected) => {
      const fixture = render();
      const fired: string[] = [];
      fixture.componentInstance.open.subscribe(() => fired.push('open'));
      fixture.componentInstance.longPress.subscribe(() => fired.push('longPress'));

      (fixture.nativeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );

      expect(fired).toEqual([expected]);
    });

    it('also reaches the actions through Shift+F10', () => {
      const fixture = render();
      const pressed = vi.fn();
      fixture.componentInstance.longPress.subscribe(pressed);

      (fixture.nativeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }),
      );

      expect(pressed).toHaveBeenCalledTimes(1);
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
