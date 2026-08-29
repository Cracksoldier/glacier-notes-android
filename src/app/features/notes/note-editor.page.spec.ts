import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import type { Note } from '../../core/models/note';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { NotebookPrompts } from '../notebooks/notebook-prompts';
import { NotebooksStore } from '../notebooks/notebooks.store';
import { NoteEditorPage } from './note-editor.page';
import { NotesStore } from './notes.store';

/**
 * Capacitor plugins are proxies, so they cannot be spied on; replacing the
 * module is the only way to drive the backgrounding path without a device.
 */
const capacitorApp = vi.hoisted(() => ({
  listeners: [] as ((state: { isActive: boolean }) => void)[],
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (_event: string, callback: (state: { isActive: boolean }) => void) => {
      capacitorApp.listeners.push(callback);
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
  },
}));

function background(): void {
  for (const listener of capacitorApp.listeners) {
    listener({ isActive: false });
  }
}

describe('NoteEditorPage', () => {
  let repositories: TestRepositories;
  let store: NotesStore;
  let notebooks: NotebooksStore;
  /** An Ionic action sheet cannot be presented under jsdom; only its answer matters here. */
  let chosenNotebookId: string | undefined;

  beforeEach(async () => {
    capacitorApp.listeners.length = 0;
    chosenNotebookId = undefined;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
        {
          provide: NotebookPrompts,
          useValue: { pickNotebook: () => Promise.resolve(chosenNotebookId) },
        },
      ],
    });
    repositories = await createTestRepositories();
    store = TestBed.inject(NotesStore);
    notebooks = TestBed.inject(NotebooksStore);
    await store.load();
    await notebooks.load();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  /**
   * The page's reads and writes are plain promise chains rather than tracked
   * Angular tasks, so `whenStable` does not wait for them. A real macrotask
   * does — which is why every test that needs fake timers installs them after
   * the page is open.
   */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function open(note: Note, created = false): Promise<ComponentFixture<NoteEditorPage>> {
    const fixture = TestBed.createComponent(NoteEditorPage);
    fixture.componentRef.setInput('id', note.id);
    fixture.componentRef.setInput('created', created);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return fixture;
  }

  function type(fixture: ComponentFixture<NoteEditorPage>, selector: string, value: string): void {
    const field = fixture.nativeElement.querySelector(selector) as
      | HTMLInputElement
      | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  it('renders a not-found state for an id that no longer exists', async () => {
    const fixture = await open({ id: 'ffffffff-0000-0000-0000-000000000000' } as Note);

    expect(fixture.nativeElement.textContent).toContain('This note no longer exists');
  });

  it('loads the stored title and body', async () => {
    const note = await store.createTextNote();
    await store.save(note.id, { title: 'Groceries', content: '- milk' });

    const fixture = await open(note);

    expect(fixture.nativeElement.querySelector('.editor__title').value).toBe('Groceries');
    expect(fixture.nativeElement.querySelector('.editor__content').value).toBe('- milk');
  });

  describe('autosave', () => {
    it('waits out the debounce before writing, then writes once', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);
      vi.useFakeTimers();
      const update = vi.spyOn(repositories.notes, 'update');

      type(fixture, '.editor__content', 'half a thought');
      await vi.advanceTimersByTimeAsync(499);
      expect(update).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(update).toHaveBeenCalledTimes(1);
      expect((await repositories.notes.get(note.id)).content).toBe('half a thought');
    });

    it('restarts the timer on the next keystroke', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);
      vi.useFakeTimers();
      const update = vi.spyOn(repositories.notes, 'update');

      type(fixture, '.editor__content', 'one');
      await vi.advanceTimersByTimeAsync(400);
      type(fixture, '.editor__content', 'one two');
      await vi.advanceTimersByTimeAsync(400);

      expect(update).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);
      expect(update).toHaveBeenCalledTimes(1);
      expect((await repositories.notes.get(note.id)).content).toBe('one two');
    });

    it('flushes a pending change when the page is left', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);

      type(fixture, '.editor__title', 'Groceries');
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect((await repositories.notes.get(note.id)).title).toBe('Groceries');
    });

    it('flushes when the app is backgrounded', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);

      type(fixture, '.editor__content', 'typed then home key');
      background();
      await settle();

      expect((await repositories.notes.get(note.id)).content).toBe('typed then home key');
    });

    it('surfaces a failed write without clearing the text', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);
      vi.spyOn(repositories.notes, 'update').mockRejectedValue(new Error('no space'));

      type(fixture, '.editor__content', 'still here');
      fixture.componentInstance.ionViewWillLeave();
      await settle();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Could not save');
      expect(fixture.nativeElement.querySelector('.editor__content').value).toBe('still here');
    });
  });

  describe('discarding empty notes', () => {
    it('purges a note this session created and left blank', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note, true);

      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect(await repositories.notes.find(note.id)).toBeUndefined();
      expect(store.notes()).toEqual([]);
    });

    it('keeps a note this session created once it has any text', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note, true);

      type(fixture, '.editor__title', 'Groceries');
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect(await repositories.notes.find(note.id)).toBeDefined();
    });

    it('keeps a pre-existing note the user empties', async () => {
      const note = await store.createTextNote();
      await store.save(note.id, { title: 'Groceries', content: '- milk' });
      const fixture = await open(note);

      type(fixture, '.editor__title', '');
      type(fixture, '.editor__content', '');
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect(await repositories.notes.find(note.id)).toBeDefined();
    });
  });

  describe('the formatting toolbar', () => {
    it('applies a transform to the selection and keeps the caret on the text', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);
      const textarea = fixture.nativeElement.querySelector(
        '.editor__content',
      ) as HTMLTextAreaElement;
      textarea.value = 'milk';
      textarea.dispatchEvent(new Event('input'));
      textarea.setSelectionRange(0, 4);

      const bold = fixture.nativeElement.querySelector(
        'button[aria-label="Bold"]',
      ) as HTMLButtonElement;
      bold.click();

      expect(textarea.value).toBe('**milk**');
      expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([2, 6]);
    });

    it('is disabled in preview mode', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);

      (
        fixture.nativeElement.querySelector('ion-button[aria-label="Preview"]') as HTMLElement
      ).click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('button[aria-label="Bold"]').disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('.editor__content')).toBeNull();
      expect(fixture.nativeElement.querySelector('.editor__preview')).not.toBeNull();
    });
  });

  describe('the notebook chip', () => {
    it('names the notebook the note is in', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);

      expect(fixture.nativeElement.querySelector('.editor__notebook').textContent).toContain(
        'Notes',
      );
    });

    it('flushes a pending edit before moving, so the move owns the newer updatedAt', async () => {
      const work = await notebooks.create('Work');
      const note = await store.createTextNote();
      const fixture = await open(note);

      const writes: string[] = [];
      const update = repositories.notes.update.bind(repositories.notes);
      const move = repositories.notes.move.bind(repositories.notes);
      vi.spyOn(repositories.notes, 'update').mockImplementation((id, patch) => {
        writes.push('update');
        return update(id, patch);
      });
      vi.spyOn(repositories.notes, 'move').mockImplementation((id, notebookId) => {
        writes.push('move');
        return move(id, notebookId);
      });

      type(fixture, '.editor__content', 'typed then moved');
      chosenNotebookId = work.id;
      (fixture.nativeElement.querySelector('.editor__notebook') as HTMLButtonElement).click();
      await settle();
      fixture.detectChanges();

      expect(writes).toEqual(['update', 'move']);
      const stored = await repositories.notes.get(note.id);
      expect(stored.content).toBe('typed then moved');
      expect(stored.notebookId).toBe(work.id);
      expect(fixture.nativeElement.querySelector('.editor__notebook').textContent).toContain(
        'Work',
      );
    });

    it('leaves the note where it is when the sheet is dismissed', async () => {
      const note = await store.createTextNote();
      const fixture = await open(note);
      const move = vi.spyOn(repositories.notes, 'move');

      (fixture.nativeElement.querySelector('.editor__notebook') as HTMLButtonElement).click();
      await settle();

      expect(move).not.toHaveBeenCalled();
    });
  });

  describe('preview links', () => {
    it('opens http(s) links out of the app rather than navigating the WebView', async () => {
      const note = await store.createTextNote();
      await store.save(note.id, { content: '[docs](https://example.com/)' });
      const fixture = await open(note);
      const open_ = vi.spyOn(window, 'open').mockReturnValue(null);

      (
        fixture.nativeElement.querySelector('ion-button[aria-label="Preview"]') as HTMLElement
      ).click();
      fixture.detectChanges();

      const anchor = fixture.nativeElement.querySelector('.editor__preview a') as HTMLAnchorElement;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(true);
      expect(open_).toHaveBeenCalledWith('https://example.com/', '_blank');
    });
  });
});
