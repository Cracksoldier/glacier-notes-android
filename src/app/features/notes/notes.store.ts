import { Injectable, computed, inject, signal } from '@angular/core';

import type { Note } from '../../core/models/note';
import type { NoteView } from '../../core/repositories/note-queries';
import { NotebookRepository } from '../../core/repositories/notebook.repository';
import { NoteRepository, type NoteUpdatePatch } from '../../core/repositories/note.repository';

export type NotesStatus = 'loading' | 'ready' | 'error';

/**
 * Holds the active-notes list for both the list page and the editor.
 *
 * A store rather than a reload on each page entry, because Ionic does not await
 * `ionViewWillLeave`: the editor's final flush and the list's refresh would race
 * and the list would intermittently show the text from before the last
 * keystrokes. Writing through the store means the saved note reaches the list
 * synchronously with the write that produced it, so there is nothing to race.
 *
 * This mirrors the desktop's `note-store.ts` `updateInPlace`.
 */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly notesRepository = inject(NoteRepository);
  private readonly notebooks = inject(NotebookRepository);

  private readonly all = signal<readonly Note[]>([]);
  private readonly state = signal<NotesStatus>('loading');
  private readonly failedSave = signal(false);
  private readonly currentView = signal<NoteView>({ kind: 'active' });

  readonly notes = this.all.asReadonly();
  readonly status = this.state.asReadonly();
  readonly saveFailed = this.failedSave.asReadonly();
  readonly view = this.currentView.asReadonly();

  readonly pinned = computed(() => this.all().filter((note) => note.pinned));
  readonly unpinned = computed(() => this.all().filter((note) => !note.pinned));

  /** Switches which notes the list holds. The editor keeps writing through it either way. */
  setView(view: NoteView): Promise<void> {
    this.currentView.set(view);
    return this.load();
  }

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.all.set(await this.notesRepository.list(this.currentView()));
      this.state.set('ready');
    } catch {
      this.all.set([]);
      this.state.set('error');
    }
  }

  /**
   * Into the notebook being viewed, or the default one when the view is not a
   * notebook. Creating a note inside a notebook and having it land elsewhere
   * would read as a bug.
   */
  async createTextNote(): Promise<Note> {
    const view = this.currentView();
    const notebookId =
      view.kind === 'notebook' ? view.notebookId : await this.notebooks.getDefaultId();
    const note = await this.notesRepository.create({ notebookId, type: 'text' });
    this.all.set(sortActiveNotes([note, ...this.all()]));
    return note;
  }

  /**
   * Persists and replaces in place. Re-sorting here is what lifts a just-edited
   * note back to the top of the list without a second database round-trip.
   */
  async save(id: string, patch: NoteUpdatePatch): Promise<void> {
    try {
      this.replace(await this.notesRepository.update(id, patch));
      this.failedSave.set(false);
    } catch {
      this.failedSave.set(true);
    }
  }

  /**
   * Moving a note out of the notebook currently being viewed drops it from the
   * list, which is what `replace` handles. Unlike `save` this rethrows: a move
   * is an explicit action, not a background write, so it needs to surface.
   */
  async moveNote(id: string, notebookId: string): Promise<void> {
    this.replace(await this.notesRepository.move(id, notebookId));
  }

  async discard(id: string): Promise<void> {
    await this.notesRepository.purge(id);
    this.all.set(this.all().filter((note) => note.id !== id));
  }

  clearSaveError(): void {
    this.failedSave.set(false);
  }

  /**
   * Swaps a freshly written note into the list, then drops it if a notebook view
   * no longer covers it.
   *
   * The one `notebookId` comparison is the *only* view predicate held in
   * TypeScript, deliberately. A general `matchesView()` would be a second
   * encoding of the `WHERE` clauses in `note-queries.ts`, next to the one
   * `compareActiveNotes` already keeps of their `ORDER BY` — and
   * `docs/repositories.md` names that duplication as the layer's standing
   * hazard. Archiving and trashing arrive at M08 and belong in a reload, not
   * here.
   */
  private replace(saved: Note): void {
    const view = this.currentView();
    const next = this.all().map((note) => (note.id === saved.id ? saved : note));
    this.all.set(
      sortActiveNotes(
        view.kind === 'notebook'
          ? next.filter((note) => note.notebookId === view.notebookId)
          : next,
      ),
    );
  }
}

/**
 * The list order from `note-queries.ts` expressed in TypeScript:
 * `pinned DESC, updated_at DESC, id DESC`.
 *
 * Two encodings of one ordering is the standing hazard named in
 * `docs/repositories.md`. `notes.store.spec.ts` cross-checks this against
 * `NoteRepository.list({kind:'active'})` over a shared fixture; if a sort order
 * is ever added, both sides move together or that spec fails.
 */
export function compareActiveNotes(a: Note, b: Note): number {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt > b.updatedAt ? -1 : 1;
  }
  return a.id > b.id ? -1 : 1;
}

function sortActiveNotes(notes: readonly Note[]): readonly Note[] {
  return [...notes].sort(compareActiveNotes);
}
