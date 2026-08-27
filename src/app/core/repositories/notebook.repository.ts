import { Injectable, inject } from '@angular/core';

import type { DatabaseAdapter } from '../database/database-adapter';
import { notebookFromRow } from '../database/row-mapper';
import type { NotebookRow } from '../database/rows';
import { newId, nowIso } from '../models/entity-id';
import type { Notebook } from '../models/notebook';
import { countNotesInNotebook } from './note-queries';
import { requireNotebookExists } from './note-writes';
import {
  applyNotebookPatch,
  deleteNotebookRow,
  insertNotebook,
  moveNotesToNotebook,
  nextNotebookSortOrder,
  type NotebookUpdatePatch,
  purgeNotesInNotebook,
  readDefaultNotebookId,
} from './notebook-writes';
import { RepositoryContext } from './repository-context';
import {
  DefaultNotebookError,
  EntityNotFoundError,
  NotebookNotEmptyError,
  RepositoryError,
} from './repository-errors';

export type { NotebookUpdatePatch } from './notebook-writes';

/**
 * What happens to a notebook's notes when the notebook goes.
 *
 * The desktop asks the same question in a dialog — "Delete the notes too" or
 * "Move them to:" (`sidebar.ts:83-97`) — but then answers it with two separate
 * IPC calls, so a failure between them leaves the notes moved and the notebook
 * still there. Taking the answer as an argument makes the whole thing one
 * transaction.
 */
export type NotebookDisposition = { notes: 'purge' } | { notes: 'moveTo'; targetId: string };

@Injectable({ providedIn: 'root' })
export class NotebookRepository {
  private readonly context = inject(RepositoryContext);

  list(): Promise<Notebook[]> {
    return this.context.read('notebooks.list', async (adapter) => {
      const rows = await adapter.query<NotebookRow>(
        'SELECT * FROM notebooks ORDER BY sort_order, id',
      );
      return rows.map(notebookFromRow);
    });
  }

  get(id: string): Promise<Notebook> {
    return this.context.read('notebooks.get', (adapter) => requireNotebook(adapter, id));
  }

  /**
   * The notebook `notes.notebook_id` falls back to. It is a column in
   * `app_state` rather than a preference because it travels in the export
   * envelope and has to be set atomically with the notebook it names.
   */
  getDefaultId(): Promise<string> {
    return this.context.read('notebooks.getDefaultId', async (adapter) => {
      const id = await readDefaultNotebookId(adapter);
      if (!id) {
        throw new RepositoryError('No default notebook is set');
      }
      return id;
    });
  }

  create(name: string, color?: string): Promise<Notebook> {
    return this.context.write('notebooks.create', async (adapter) => {
      const now = nowIso();
      const notebook: Notebook = {
        id: newId(),
        name,
        ...(color !== undefined && { color }),
        createdAt: now,
        updatedAt: now,
        sortOrder: await nextNotebookSortOrder(adapter),
      };
      await insertNotebook(adapter, notebook);
      return notebook;
    });
  }

  update(id: string, patch: NotebookUpdatePatch): Promise<Notebook> {
    return this.context.write('notebooks.update', async (adapter) => {
      await requireNotebookExists(adapter, id);
      await applyNotebookPatch(adapter, id, patch, nowIso());
      return requireNotebook(adapter, id);
    });
  }

  /**
   * Deletes the notebook and disposes of its notes in one transaction, returning
   * the image ids any purged notes referenced.
   *
   * Without a `disposition` this refuses a non-empty notebook rather than
   * guessing: `notes.notebook_id` is `ON DELETE RESTRICT`, and a note with no
   * notebook is not a state the domain model can represent.
   */
  delete(id: string, disposition?: NotebookDisposition): Promise<string[]> {
    return this.context.write('notebooks.delete', async (adapter) => {
      await requireNotebookExists(adapter, id);
      if (id === (await readDefaultNotebookId(adapter))) {
        throw new DefaultNotebookError(id);
      }

      if (disposition?.notes === 'moveTo') {
        if (disposition.targetId === id) {
          throw new RepositoryError(`Notebook ${id} cannot receive its own notes`);
        }
        await requireNotebookExists(adapter, disposition.targetId);
      }

      // Counts every note in the notebook, archived and trashed included — all
      // three hold a foreign key, so all three block the delete.
      const noteCount = await countNotesInNotebook(adapter, id);
      if (noteCount > 0 && !disposition) {
        throw new NotebookNotEmptyError(id, noteCount);
      }

      let imageIds: string[] = [];
      if (disposition?.notes === 'purge') {
        imageIds = await purgeNotesInNotebook(adapter, id);
      } else if (disposition?.notes === 'moveTo') {
        await moveNotesToNotebook(adapter, id, disposition.targetId, nowIso());
      }

      await deleteNotebookRow(adapter, id);
      return imageIds;
    });
  }
}

async function requireNotebook(adapter: DatabaseAdapter, id: string): Promise<Notebook> {
  const [row] = await adapter.query<NotebookRow>('SELECT * FROM notebooks WHERE id = ?', [id]);
  if (!row) {
    throw new EntityNotFoundError('notebook', id);
  }
  return notebookFromRow(row);
}
