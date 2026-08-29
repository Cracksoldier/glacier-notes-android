import { Injectable, computed, inject, signal } from '@angular/core';

import { ImageGcService } from '../../core/images/image-gc.service';
import type { Note, NoteType } from '../../core/models/note';
import type { NoteView } from '../../core/repositories/note-queries';
import { NotebookRepository } from '../../core/repositories/notebook.repository';
import { NoteRepository, type NoteUpdatePatch } from '../../core/repositories/note.repository';
import type { NoteColor } from './note-colors';

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
  private readonly imageGc = inject(ImageGcService);

  private readonly all = signal<readonly Note[]>([]);
  private readonly state = signal<NotesStatus>('loading');
  private readonly failedSave = signal(false);
  private readonly currentView = signal<NoteView>({ kind: 'active' });
  private loaded = false;

  readonly notes = this.all.asReadonly();
  readonly status = this.state.asReadonly();
  readonly saveFailed = this.failedSave.asReadonly();
  readonly view = this.currentView.asReadonly();

  readonly pinned = computed(() => this.all().filter((note) => note.pinned));
  readonly unpinned = computed(() => this.all().filter((note) => !note.pinned));

  /**
   * Switches which notes the list holds. The editor keeps writing through it
   * either way.
   *
   * Re-selecting the view already held is a no-op, not a refresh. Ionic caches
   * pages, so each list page re-asserts its view on `ionViewWillEnter` — without
   * the guard, re-entering a page would reload it, which is precisely the
   * reload-on-re-enter that `docs/markdown-and-editor.md` rules out. Everything
   * that could change membership already writes through this store.
   *
   * The `loaded` flag is what keeps that guard from swallowing the very first
   * load: `/notes` asks for the active view the store already starts on, and
   * without the flag the app opens on a permanently empty list.
   */
  setView(view: NoteView): Promise<void> {
    if (this.loaded && sameView(view, this.currentView())) {
      return Promise.resolve();
    }
    this.currentView.set(view);
    return this.load();
  }

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.all.set(await this.notesRepository.list(this.currentView()));
      this.state.set('ready');
      this.loaded = true;
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
  async createNote(type: NoteType): Promise<Note> {
    const view = this.currentView();
    const notebookId =
      view.kind === 'notebook' ? view.notebookId : await this.notebooks.getDefaultId();
    const note = await this.notesRepository.create(
      type === 'checklist' ? { notebookId, type, checklist: [] } : { notebookId, type },
    );
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
    await this.imageGc.collect(await this.notesRepository.purge(id));
    this.all.set(this.all().filter((note) => note.id !== id));
  }

  /**
   * Pin and colour are the only two M08 actions that go through `replace`: they
   * change no `WHERE` clause in `note-queries.ts`, so the note stays in whatever
   * view it was in. Everything below them can change view membership and so
   * reloads instead — see the comment on `replace`.
   *
   * Safe against the trash's `deleted_at DESC` ordering only because
   * `noteActionChoices` offers neither action there, so `sortActiveNotes` can
   * never re-sort a trashed list by the wrong key.
   */
  async setPinned(id: string, pinned: boolean): Promise<void> {
    this.replace(await this.notesRepository.setPinned(id, pinned));
  }

  async setColor(id: string, color: NoteColor | undefined): Promise<void> {
    this.replace(await this.notesRepository.update(id, { color }));
  }

  async setLabels(id: string, labelIds: readonly string[]): Promise<void> {
    await this.notesRepository.setLabels(id, labelIds);
    await this.load();
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    await this.notesRepository.setArchived(id, archived);
    await this.load();
  }

  async trash(id: string): Promise<void> {
    await this.notesRepository.trash(id);
    await this.load();
  }

  async restore(id: string): Promise<void> {
    await this.notesRepository.restore(id);
    await this.load();
  }

  async deleteForever(id: string): Promise<void> {
    await this.imageGc.collect(await this.notesRepository.purge(id));
    await this.load();
  }

  async emptyTrash(): Promise<void> {
    await this.imageGc.collect(await this.notesRepository.emptyTrash());
    await this.load();
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
   * hazard. Archiving, trashing and labelling therefore reload instead of
   * passing through here.
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

function sameView(a: NoteView, b: NoteView): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'notebook' && b.kind === 'notebook') {
    return a.notebookId === b.notebookId;
  }
  if (a.kind === 'label' && b.kind === 'label') {
    return a.labelId === b.labelId;
  }
  return true;
}
