import { describe, expect, it } from 'vitest';

import type { Label } from '../../core/models/label';
import { labelCheckboxes, selectedLabelIds } from './label-selection';

const labels: readonly Label[] = [
  { id: 'l1', name: 'Work' },
  { id: 'l2', name: 'Home' },
  { id: 'l3', name: 'Ideas' },
];

describe('label selection', () => {
  it('ticks the labels the note already carries', () => {
    const boxes = labelCheckboxes(labels, ['l2']);

    expect(boxes.map((box) => box.checked)).toEqual([false, true, false]);
    expect(boxes.map((box) => box.value)).toEqual(['l1', 'l2', 'l3']);
    expect(boxes.map((box) => box.label)).toEqual(['Work', 'Home', 'Ideas']);
  });

  it('returns the checked ids in list order, not tick order', () => {
    expect(selectedLabelIds(labels, ['l3', 'l1'])).toEqual(['l1', 'l3']);
  });

  /**
   * The picker can be open while a label is deleted from the drawer, and
   * setLabels would fail the foreign key on an id that no longer exists.
   */
  it('drops ids that are no longer labels', () => {
    expect(selectedLabelIds(labels, ['l1', 'deleted-while-open'])).toEqual(['l1']);
  });

  it('treats a dismissed alert as no selection', () => {
    expect(selectedLabelIds(labels, undefined)).toEqual([]);
    expect(selectedLabelIds(labels, [])).toEqual([]);
  });
});
