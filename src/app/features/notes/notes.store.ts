import { Injectable, computed, inject, signal } from '@angular/core';

import { ImageGcService } from '../../core/images/image-gc.service';
import type { Note, NoteType } from '../../core/models/note';
import { SettingsStore } from '../../core/preferences/settings.store';
import type { NoteView } from '../../core/repositories/note-queries';
import { NotebookRepository } from '../../core/repositories/notebook.repository';
import { NoteRepository, type NoteUpdatePatch } from '../../core/repositories/note.repository';
import type { NoteColor } from './note-colors';
import { sortNotes } from './note-sort';

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
  private readonly settings = inject(SettingsStore);

  private readonly all = signal<readonly Note[]>([]);
  private readonly state = signal<NotesStatus>('loading');
  private readonly failedSave = signal(false);
  private readonly currentView = signal<NoteView>({ kind: 'active' });
  private loaded = false;

  readonly status = this.state.asReadonly();
  readonly saveFailed = this.failedSave.asReadonly();
  readonly view = this.currentView.asReadonly();

  /**
   * Display order is applied here rather than in SQL, so changing the sort order
   * costs a re-sort and no round trip — and so `titleAsc`, which SQLite cannot
   * express, is available at all. `note-sort.ts` explains the split. Everything
   * that mutates the list below therefore stores rows unsorted.
   */
  readonly notes = computed(() =>
    sortNotes(this.all(), this.currentView(), this.settings.sortOrder()),
  );

  readonly pinned = computed(() => this.notes().filter((note) => note.pinned));
  readonly unpinned = computed(() => this.notes().filter((note) => !note.pinned));

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
    // Dropped here rather than in `load()`: this store is shared by the notes,
    // archive and trash pages, so holding the old view's rows would render them
    // inside the new page — wired to the new page's actions — for as long as the
    // load takes. A same-view refresh must *not* blank, or every archive, trash
    // and label action would flash the list away and back.
    this.all.set([]);
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
      // Cleared, or `setView`'s guard would treat the failed view as held and
      // never load it again — no error, no retry, for the rest of the session.
      this.loaded = false;
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
    this.all.set([note, ...this.all()]);
    return note;
  }

  /**
   * Persists and replaces in place. The `notes` computed re-sorts, which is what
   * lifts a just-edited note back to the top without a second round-trip.
   *
   * Reports whether the write landed instead of rethrowing, so the editor can
   * keep the edit pending and try again. Rethrowing is reserved for the explicit
   * actions below, which have a user waiting on them.
   */
  async save(id: string, patch: NoteUpdatePatch): Promise<boolean> {
    try {
      this.replace(await this.notesRepository.update(id, patch));
      this.failedSave.set(false);
      return true;
    } catch {
      this.failedSave.set(true);
      return false;
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
   * reloads instead — see the comment on `replace`. That holds under a search
   * view too: neither can change whether a note matches a query.
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

  /**
   * A passthrough so every garbage-collection call site sits here, next to
   * `discard`, `deleteForever` and `emptyTrash`. The editor calls it after
   * saving a note it has just taken an image out of.
   */
  collectImages(imageIds: readonly string[]): Promise<void> {
    return this.imageGc.collect(imageIds);
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
   * `note-sort.ts` already keeps of their `ORDER BY` — and
   * `docs/repositories.md` names that duplication as the layer's standing
   * hazard. Archiving, trashing and labelling therefore reload instead of
   * passing through here.
   */
  private replace(saved: Note): void {
    const view = this.currentView();
    const next = this.all().map((note) => (note.id === saved.id ? saved : note));
    this.all.set(
      view.kind === 'notebook' ? next.filter((note) => note.notebookId === view.notebookId) : next,
    );
  }
}

function sameView(a: NoteView, b: NoteView): boolean {
  if (a.kind === 'search' || b.kind === 'search') {
    return (
      a.kind === 'search' &&
      b.kind === 'search' &&
      a.query === b.query &&
      sameView(a.scope, b.scope)
    );
  }
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
