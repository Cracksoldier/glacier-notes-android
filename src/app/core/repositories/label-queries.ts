import type { DatabaseAdapter } from '../database/database-adapter';
import { labelFromRow } from '../database/row-mapper';
import type { LabelRow } from '../database/rows';
import type { Label } from '../models/label';

/**
 * The sidebar order, in one place so `LabelsStore` can hold the same one without
 * a second encoding of it — the duplication `docs/repositories.md` names as the
 * layer's standing hazard.
 *
 * The `id` tiebreaker is not decoration. `selectLabels` reads a `SELECT` with no
 * `ORDER BY`, and label names are explicitly non-unique, so without a unique
 * final key two same-named labels can swap places between reads.
 */
export function compareLabels(a: Label, b: Label): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/**
 * The label read path as a plain function, for the same reason `note-queries.ts`
 * is one: `readCollectionSnapshot` has to read labels *inside* an already-open
 * `read()` turn, and calling `LabelRepository.list()` there would re-enter the
 * queue and deadlock.
 */
export async function selectLabels(adapter: DatabaseAdapter): Promise<Label[]> {
  const rows = await adapter.query<LabelRow>('SELECT * FROM labels');
  return rows.map(labelFromRow).sort(compareLabels);
}
