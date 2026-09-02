import { Injectable, inject } from '@angular/core';

import { labelFromRow } from '../database/row-mapper';
import type { LabelRow } from '../database/rows';
import { newId } from '../models/entity-id';
import type { Label } from '../models/label';
import { selectLabels } from './label-queries';
import { requireLabelExists } from './note-writes';
import { RepositoryContext } from './repository-context';
import { EntityNotFoundError } from './repository-errors';

/**
 * Labels have no timestamps — the desktop's `Label` is `{id, name}` and nothing
 * more (`docs/desktop-audit.md` §1 delta 6) — so nothing here bumps anything.
 *
 * Names are not unique. The desktop lets two labels share a name and this must
 * too, or an import that carries both would fail.
 */
@Injectable({ providedIn: 'root' })
export class LabelRepository {
  private readonly context = inject(RepositoryContext);

  /**
   * Sorted in TypeScript, not in SQL. SQLite's default collation compares bytes,
   * which puts `Zebra` before `ähnlich`; `label-repo.ts:32` uses `localeCompare`
   * and the sidebar order has to match. The table holds tens of rows.
   */
  list(): Promise<Label[]> {
    return this.context.read('labels.list', selectLabels);
  }

  get(id: string): Promise<Label> {
    return this.context.read('labels.get', async (adapter) => {
      const [row] = await adapter.query<LabelRow>('SELECT * FROM labels WHERE id = ?', [id]);
      if (!row) {
        throw new EntityNotFoundError('label', id);
      }
      return labelFromRow(row);
    });
  }

  create(name: string): Promise<Label> {
    return this.context.write('labels.create', async (adapter) => {
      const label: Label = { id: newId(), name };
      await adapter.run('INSERT INTO labels (id, name) VALUES (?, ?)', [label.id, label.name]);
      return label;
    });
  }

  rename(id: string, name: string): Promise<Label> {
    return this.context.write('labels.rename', async (adapter) => {
      await requireLabelExists(adapter, id);
      await adapter.run('UPDATE labels SET name = ? WHERE id = ?', [name, id]);
      return { id, name };
    });
  }

  /**
   * Deleting a label strips it from every note and keeps the notes, via
   * `note_labels`' cascade. No note's `updatedAt` moves — `stripLabel`
   * (`note-repo.ts:165-172`) rewrites them without touching it, so a label
   * cleanup does not reshuffle the whole grid.
   */
  delete(id: string): Promise<void> {
    return this.context.write('labels.delete', async (adapter) => {
      await requireLabelExists(adapter, id);
      await adapter.run('DELETE FROM labels WHERE id = ?', [id]);
    });
  }
}
