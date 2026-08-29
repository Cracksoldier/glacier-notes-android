import { Injectable, inject } from '@angular/core';

import type { DatabaseAdapter } from '../database/database-adapter';
import { newId, nowIso } from '../models/entity-id';
import type { Note } from '../models/note';
import {
  type NoteView,
  type NoteWindow,
  queryNoteById,
  queryNotes,
  trashedNoteIds,
} from './note-queries';
import {
  applyNotePatch,
  insertNote,
  moveNote,
  type NoteCreateInput,
  type NoteUpdatePatch,
  purgeNote,
  purgeNotes,
  requireNoteExists,
  requireNotebookExists,
  restoreNote,
  trashNote,
} from './note-writes';
import { RepositoryContext } from './repository-context';
import { EntityNotFoundError } from './repository-errors';

export type { NoteCreateInput, NoteUpdatePatch } from './note-writes';
export type { NoteView, NoteWindow } from './note-queries';

/**
 * The only way anything above `core/` reads or writes a note.
 *
 * Each method is one boundary — a single `read` or `write` on
 * [RepositoryContext] — wrapped around primitives that open no transaction of
 * their own. Every mutation re-reads the note it touched before returning, so
 * the object a caller gets back is the one that was stored rather than the one
 * it asked for; that difference is real for checklists, whose `sortOrder` is
 * re-derived from array position on the way in.
 *
 * Which operations bump `updatedAt` is a contract, not an implementation
 * detail — `docs/repositories.md` holds the matrix.
 */
@Injectable({ providedIn: 'root' })
export class NoteRepository {
  private readonly context = inject(RepositoryContext);

  list(view: NoteView, window?: NoteWindow): Promise<Note[]> {
    return this.context.read('notes.list', (adapter) => queryNotes(adapter, view, window));
  }

  find(id: string): Promise<Note | undefined> {
    return this.context.read('notes.find', (adapter) => queryNoteById(adapter, id));
  }

  get(id: string): Promise<Note> {
    return this.context.read('notes.get', (adapter) => requireNote(adapter, id));
  }

  /** Field for field the desktop's `note-repo.ts:64-90`, including the empty defaults. */
  create(input: NoteCreateInput): Promise<Note> {
    const now = nowIso();
    const note: Note = {
      id: newId(),
      notebookId: input.notebookId,
      type: input.type,
      title: input.title ?? '',
      content: input.content ?? '',
      ...(input.type === 'checklist' && { checklist: input.checklist ?? [] }),
      imageIds: [],
      pinned: false,
      archived: false,
      labels: [],
      createdAt: now,
      updatedAt: now,
    };

    return this.context.write('notes.create', async (adapter) => {
      await requireNotebookExists(adapter, input.notebookId);
      await insertNote(adapter, note);
      return requireNote(adapter, note.id);
    });
  }

  update(id: string, patch: NoteUpdatePatch): Promise<Note> {
    return this.context.write('notes.update', async (adapter) => {
      await requireNoteExists(adapter, id);
      await applyNotePatch(adapter, id, patch, nowIso());
      return requireNote(adapter, id);
    });
  }

  /** Pin and archive route through `update` on the desktop, so both bump `updatedAt`. */
  setPinned(id: string, pinned: boolean): Promise<Note> {
    return this.update(id, { pinned });
  }

  setArchived(id: string, archived: boolean): Promise<Note> {
    return this.update(id, { archived });
  }

  setLabels(id: string, labelIds: readonly string[]): Promise<Note> {
    return this.update(id, { labels: [...labelIds] });
  }

  move(id: string, notebookId: string): Promise<Note> {
    return this.context.write('notes.move', async (adapter) => {
      await requireNoteExists(adapter, id);
      await requireNotebookExists(adapter, notebookId);
      await moveNote(adapter, id, notebookId, nowIso());
      return requireNote(adapter, id);
    });
  }

  trash(id: string): Promise<Note> {
    return this.context.write('notes.trash', async (adapter) => {
      await requireNoteExists(adapter, id);
      await trashNote(adapter, id, nowIso());
      return requireNote(adapter, id);
    });
  }

  restore(id: string): Promise<Note> {
    return this.context.write('notes.restore', async (adapter) => {
      await requireNoteExists(adapter, id);
      await restoreNote(adapter, id, nowIso());
      return requireNote(adapter, id);
    });
  }

  /** Returns the image ids the note referenced; deleting the files is M10's. */
  purge(id: string): Promise<string[]> {
    return this.context.write('notes.purge', (adapter) => purgeNote(adapter, id));
  }

  emptyTrash(): Promise<string[]> {
    return this.context.write('notes.emptyTrash', async (adapter) =>
      purgeNotes(adapter, await trashedNoteIds(adapter)),
    );
  }

  /**
   * The desktop's startup purge (`main.ts:266`), including its `days <= 0`
   * escape hatch — which short-circuits before opening a transaction, so
   * disabling it costs nothing at boot.
   */
  purgeExpired(days: number): Promise<string[]> {
    if (days <= 0) {
      return Promise.resolve([]);
    }
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    return this.context.write('notes.purgeExpired', async (adapter) =>
      purgeNotes(adapter, await trashedNoteIds(adapter, cutoff)),
    );
  }
}

async function requireNote(adapter: DatabaseAdapter, id: string): Promise<Note> {
  const note = await queryNoteById(adapter, id);
  if (!note) {
    throw new EntityNotFoundError('note', id);
  }
  return note;
}
