import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ChecklistItem } from '../../core/models/checklist-item';
import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { ChecklistEditorComponent } from './checklist-editor.component';

describe('ChecklistEditorComponent', () => {
  let fixture: ComponentFixture<ChecklistEditorComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() }],
    });
  });

  function item(id: string, text: string, sortOrder: number, checked = false): ChecklistItem {
    return { id, text, checked, sortOrder };
  }

  function render(items: ChecklistItem[], moveCheckedToBottom = false): void {
    fixture = TestBed.createComponent(ChecklistEditorComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('moveCheckedToBottom', moveCheckedToBottom);
    fixture.detectChanges();
    host = fixture.nativeElement;
  }

  function items(): ChecklistItem[] {
    return fixture.componentInstance.items();
  }

  function texts(): HTMLInputElement[] {
    return [...host.querySelectorAll<HTMLInputElement>('.checklist__text')];
  }

  function type(index: number, value: string): void {
    const input = texts()[index];
    if (!input) {
      throw new Error(`no row at ${index}`);
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function keydown(index: number, key: string): void {
    texts()[index]?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  it('renders a row per item in sort order', () => {
    render([item('b', 'second', 1), item('a', 'first', 0)]);

    expect(texts().map((input) => input.value)).toEqual(['first', 'second']);
  });

  it('toggles an item without touching its position', () => {
    render([item('a', 'first', 0), item('b', 'second', 1)]);

    host.querySelectorAll<HTMLInputElement>('.checklist__check')[0]?.click();
    fixture.detectChanges();

    expect(items()).toEqual([item('a', 'first', 0, true), item('b', 'second', 1)]);
  });

  it('edits item text in place', () => {
    render([item('a', 'first', 0)]);

    type(0, 'milk');

    expect(items()[0]?.text).toBe('milk');
  });

  it('appends a blank item with a fresh id', () => {
    render([item('a', 'first', 0)]);

    host.querySelector<HTMLButtonElement>('.checklist__add')?.click();
    fixture.detectChanges();

    expect(items()).toHaveLength(2);
    expect(items()[1]).toMatchObject({ text: '', checked: false, sortOrder: 1 });
    expect(items()[1]?.id).not.toBe('a');
  });

  it('removes a row and renumbers what is left', () => {
    render([item('a', 'first', 0), item('b', 'second', 1), item('c', 'third', 2)]);

    host.querySelectorAll<HTMLButtonElement>('.checklist__remove')[1]?.click();
    fixture.detectChanges();

    expect(items()).toEqual([item('a', 'first', 0), item('c', 'third', 1)]);
  });

  it('inserts after the current row on Enter', () => {
    render([item('a', 'first', 0), item('b', 'second', 1)]);

    keydown(0, 'Enter');

    expect(items().map((i) => i.text)).toEqual(['first', '', 'second']);
    expect(items().map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  // Backspace in a non-empty item has to keep deleting characters.
  it('removes an empty row on Backspace and leaves a filled one alone', () => {
    render([item('a', 'first', 0), item('b', '', 1)]);

    keydown(1, 'Backspace');
    expect(items()).toEqual([item('a', 'first', 0)]);

    keydown(0, 'Backspace');
    expect(items()).toEqual([item('a', 'first', 0)]);
  });

  // Every row's placeholder is identical, so without this a ten-item list
  // announces ten indistinguishable fields.
  it('gives each text field a positional label', () => {
    render([item('a', 'first', 0), item('b', 'second', 1)]);

    expect(texts().map((input) => input.getAttribute('aria-label'))).toEqual(['Item 1', 'Item 2']);
  });

  it('groups checked items last for display only', () => {
    render([item('a', 'first', 0, true), item('b', 'second', 1)], true);

    expect(texts().map((input) => input.value)).toEqual(['second', 'first']);
    expect(items().map((i) => i.sortOrder)).toEqual([0, 1]);
  });

  /**
   * Deleting or inserting used to renumber from the grouped rows on screen,
   * which made the grouping canonical: unticking then returned the item to the
   * bottom rather than to the place it was ticked in. Only a drag may do that.
   */
  it('does not commit the grouping when an unrelated row is removed', () => {
    render([item('a', 'first', 0), item('b', 'second', 1, true), item('c', 'third', 2)], true);

    // Displayed as first, third, second — so row 1 is "third".
    host.querySelectorAll<HTMLButtonElement>('.checklist__remove')[1]?.click();
    fixture.detectChanges();

    expect(items()).toEqual([item('a', 'first', 0), item('b', 'second', 1, true)]);
  });

  it('does not commit the grouping when a row is inserted', () => {
    render([item('a', 'first', 0), item('b', 'second', 1, true), item('c', 'third', 2)], true);

    keydown(0, 'Enter');

    expect(items().map((i) => [i.text, i.sortOrder])).toEqual([
      ['first', 0],
      ['', 1],
      ['second', 2],
      ['third', 3],
    ]);
  });

  /**
   * jsdom cannot drive the real gesture, so the reorder is exercised through the
   * event Ionic emits. `complete(false)` is what keeps Angular's `@for` the only
   * thing that moves a node.
   */
  describe('the reorder event', () => {
    function reorder(from: number, to: number): boolean | undefined {
      let completedWith: boolean | undefined;
      host.querySelector('ion-reorder-group')?.dispatchEvent(
        new CustomEvent('ionItemReorder', {
          detail: {
            from,
            to,
            complete: (data?: boolean) => {
              completedWith = data;
            },
          },
        }),
      );
      fixture.detectChanges();
      return completedWith;
    }

    it('moves the item and tells Ionic to put its own node back', () => {
      render([item('a', 'first', 0), item('b', 'second', 1), item('c', 'third', 2)]);

      expect(reorder(0, 2)).toBe(false);
      expect(items()).toEqual([
        item('b', 'second', 0),
        item('c', 'third', 1),
        item('a', 'first', 2),
      ]);
    });

    // The one case where display order becomes canonical: a drag under
    // `moveCheckedToBottom` commits the grouping the user was looking at.
    it('commits the grouped display order when a grouped list is dragged', () => {
      render([item('a', 'first', 0, true), item('b', 'second', 1), item('c', 'third', 2)], true);

      reorder(0, 1);

      expect(items()).toEqual([
        item('c', 'third', 0),
        item('b', 'second', 1),
        item('a', 'first', 2, true),
      ]);
    });

    it('leaves the list alone when the item is dropped where it started', () => {
      render([item('a', 'first', 0), item('b', 'second', 1)]);
      const before = items();

      reorder(1, 1);

      expect(items()).toBe(before);
    });
  });
});
