import type { DatabaseAdapter } from '../database/database-adapter';
import { labelToRow } from '../database/row-mapper';
import type { Label } from '../models/label';

/**
 * Label writes as plain functions, opening no transaction — same contract as
 * `note-writes.ts` and `notebook-writes.ts`. They exist so M13's import can
 * compose them inside its single `write()` instead of calling
 * `LabelRepository` in a loop, which would give every label its own transaction.
 *
 * There is no `updated_at` to bump: the desktop's `Label` is `{id, name}` and
 * nothing more.
 */

export async function insertLabel(adapter: DatabaseAdapter, label: Label): Promise<void> {
  const row = labelToRow(label);
  await adapter.run('INSERT INTO labels (id, name) VALUES (?, ?)', [row.id, row.name]);
}

export async function renameLabel(
  adapter: DatabaseAdapter,
  id: string,
  name: string,
): Promise<void> {
  await adapter.run('UPDATE labels SET name = ? WHERE id = ?', [name, id]);
}

/** `note_labels.label_id` cascades, so this strips the label from every note. */
export async function deleteLabelRow(adapter: DatabaseAdapter, id: string): Promise<void> {
  await adapter.run('DELETE FROM labels WHERE id = ?', [id]);
}
