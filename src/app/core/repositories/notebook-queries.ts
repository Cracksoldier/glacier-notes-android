import type { DatabaseAdapter } from '../database/database-adapter';
import { notebookFromRow } from '../database/row-mapper';
import type { NotebookRow } from '../database/rows';
import type { Notebook } from '../models/notebook';

/**
 * The notebook read path as a plain function, so `readCollectionSnapshot` can
 * reach it inside an already-open `read()` turn without re-entering the queue.
 *
 * `sort_order` is not unique — nothing constrains two notebooks to differ — so
 * the `id` tiebreaker is what makes this a total order and keeps two reads from
 * disagreeing about which of them comes first.
 */
export async function selectNotebooks(adapter: DatabaseAdapter): Promise<Notebook[]> {
  const rows = await adapter.query<NotebookRow>('SELECT * FROM notebooks ORDER BY sort_order, id');
  return rows.map(notebookFromRow);
}
