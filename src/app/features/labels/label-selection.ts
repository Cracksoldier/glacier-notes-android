import type { Label } from '../../core/models/label';

/**
 * The multi-label picker's checkbox rows and the answer they produce.
 *
 * Pure for the usual reason — an Ionic alert cannot be instantiated under
 * jsdom, so the mapping from checked values back to label ids has to live
 * somewhere a spec can reach.
 */
export interface LabelCheckbox {
  readonly type: 'checkbox';
  readonly label: string;
  readonly value: string;
  readonly checked: boolean;
}

export function labelCheckboxes(
  labels: readonly Label[],
  selectedIds: readonly string[],
): readonly LabelCheckbox[] {
  return labels.map((label) => ({
    type: 'checkbox',
    label: label.name,
    value: label.id,
    checked: selectedIds.includes(label.id),
  }));
}

/**
 * Filters the alert's answer down to ids that still exist, preserving the
 * label list's order rather than the order the boxes were ticked in.
 *
 * The filter is not defensive padding: the picker can be open while a label is
 * deleted from the drawer, and `setLabels` would fail the foreign key on a
 * stale id.
 */
export function selectedLabelIds(labels: readonly Label[], values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return labels.filter((label) => values.includes(label.id)).map((label) => label.id);
}
