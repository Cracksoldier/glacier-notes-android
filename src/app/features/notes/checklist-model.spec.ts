import { describe, expect, it } from 'vitest';

import type { ChecklistItem } from '../../core/models/checklist-item';
import {
  checklistToText,
  displayOrder,
  newItem,
  reorderItems,
  resequence,
  textToChecklist,
} from './checklist-model';

function item(text: string, sortOrder: number, checked = false): ChecklistItem {
  return { id: `i-${text}`, text, checked, sortOrder };
}

describe('displayOrder', () => {
  it('sorts by sortOrder and leaves checked items in place by default', () => {
    const items = [item('c', 2), item('a', 0, true), item('b', 1)];

    expect(displayOrder(items, false).map((i) => i.text)).toEqual(['a', 'b', 'c']);
  });

  it('groups checked items last while preserving sortOrder within each group', () => {
    const items = [item('a', 0, true), item('b', 1), item('c', 2, true), item('d', 3)];

    expect(displayOrder(items, true).map((i) => i.text)).toEqual(['b', 'd', 'a', 'c']);
  });

  /**
   * The grouping is a view, not a write. Unchecking must return an item to
   * where it was, which only holds if sortOrder was never touched.
   */
  it('does not change any sortOrder', () => {
    const items = [item('a', 0, true), item('b', 1)];

    expect(displayOrder(items, true).map((i) => i.sortOrder)).toEqual([1, 0]);
  });
});

describe('resequence', () => {
  it('renumbers from array position and keeps ids stable', () => {
    const result = resequence([item('b', 40), item('a', 10)]);

    expect(result.map((i) => [i.id, i.sortOrder])).toEqual([
      ['i-b', 0],
      ['i-a', 1],
    ]);
  });
});

describe('reorderItems', () => {
  it('moves an item down and renumbers the result', () => {
    const items = [item('a', 0), item('b', 1), item('c', 2)];

    const result = reorderItems(items, 0, 2, false);

    expect(result.map((i) => [i.text, i.sortOrder])).toEqual([
      ['b', 0],
      ['c', 1],
      ['a', 2],
    ]);
  });

  it('moves an item up', () => {
    const items = [item('a', 0), item('b', 1), item('c', 2)];

    expect(reorderItems(items, 2, 0, false).map((i) => i.text)).toEqual(['c', 'a', 'b']);
  });

  /**
   * The indices come from the reorder event, which numbers the rows the user can
   * see. With the grouping on, that display order is what gets committed.
   */
  it('interprets indices against the grouped display, committing that grouping', () => {
    const items = [item('a', 0, true), item('b', 1), item('c', 2)];

    // Displayed as b, c, a — moving row 2 to row 0 puts the checked item first.
    const result = reorderItems(items, 2, 0, true);

    expect(result.map((i) => [i.text, i.sortOrder])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });
});

describe('textToChecklist', () => {
  it('reads task-list syntax including the check state', () => {
    const items = textToChecklist('- [x] milk\n- [ ] eggs');

    expect(items.map((i) => [i.text, i.checked, i.sortOrder])).toEqual([
      ['milk', true, 0],
      ['eggs', false, 1],
    ]);
  });

  it('accepts plain bullets, ordered lists and bare lines', () => {
    const items = textToChecklist('* milk\n1. eggs\nbread');

    expect(items.map((i) => i.text)).toEqual(['milk', 'eggs', 'bread']);
  });

  it('drops blank lines rather than creating empty items', () => {
    expect(textToChecklist('milk\n\n   \n- [ ] \neggs').map((i) => i.text)).toEqual([
      'milk',
      'eggs',
    ]);
  });

  it('mints a fresh id per item', () => {
    const items = textToChecklist('milk\neggs');

    expect(items[0]?.id).not.toBe(items[1]?.id);
  });
});

describe('checklistToText', () => {
  it('writes canonical order, not the grouped display', () => {
    const items = [item('b', 1), item('a', 0, true)];

    expect(checklistToText(items)).toBe('- [x] a\n- [ ] b');
  });

  it('round-trips text through a checklist and back', () => {
    const source = '- [x] milk\n- [ ] eggs';

    expect(checklistToText(textToChecklist(source))).toBe(source);
  });
});

describe('newItem', () => {
  it('starts unchecked at the given position with a real id', () => {
    const created = newItem('', 3);

    expect(created).toMatchObject({ text: '', checked: false, sortOrder: 3 });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
