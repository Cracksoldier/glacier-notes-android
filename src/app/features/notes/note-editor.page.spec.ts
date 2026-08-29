import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import type { Note } from '../../core/models/note';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { LabelPrompts } from '../labels/label-prompts';
import { LabelsStore } from '../labels/labels.store';
import { NotebookPrompts } from '../notebooks/notebook-prompts';
import { NotebooksStore } from '../notebooks/notebooks.store';
import { ImagePrompts } from './image-prompts';
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
  let labels: LabelsStore;
  /** An Ionic action sheet cannot be presented under jsdom; only its answer matters here. */
  let chosenNotebookId: string | undefined;
  let chosenLabelIds: readonly string[] | undefined;
  let viewerAnswer: 'remove' | undefined;

  beforeEach(async () => {
    capacitorApp.listeners.length = 0;
    chosenNotebookId = undefined;
    chosenLabelIds = undefined;
    viewerAnswer = undefined;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
        {
          provide: NotebookPrompts,
          useValue: { pickNotebook: () => Promise.resolve(chosenNotebookId) },
        },
        { provide: LabelPrompts, useValue: { pickLabels: () => Promise.resolve(chosenLabelIds) } },
        { provide: ImagePrompts, useValue: { viewImage: () => Promise.resolve(viewerAnswer) } },
      ],
    });
    repositories = await createTestRepositories();
    store = TestBed.inject(NotesStore);
    notebooks = TestBed.inject(NotebooksStore);
    labels = TestBed.inject(LabelsStore);
    await store.load();
    await notebooks.load();
    await labels.load();
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

  function addItem(fixture: ComponentFixture<NoteEditorPage>): void {
    (fixture.nativeElement.querySelector('.checklist__add') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function typeItem(fixture: ComponentFixture<NoteEditorPage>, index: number, value: string): void {
    const rows = fixture.nativeElement.querySelectorAll(
      '.checklist__text',
    ) as NodeListOf<HTMLInputElement>;
    const field = rows[index];
    if (!field) {
      throw new Error(`no checklist row at ${index}`);
    }
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function itemValues(fixture: ComponentFixture<NoteEditorPage>): string[] {
    return [
      ...(fixture.nativeElement.querySelectorAll(
        '.checklist__text',
      ) as NodeListOf<HTMLInputElement>),
    ].map((field) => field.value);
  }

  /**
   * By class, not by `aria-label`: `ion-button` moves that attribute onto its
   * inner native button once the custom element hydrates, so an attribute
   * selector on the host passes or fails depending on timing.
   */
  async function convert(fixture: ComponentFixture<NoteEditorPage>): Promise<void> {
    (fixture.nativeElement.querySelector('.editor__convert') as HTMLElement).click();
    await settle();
    fixture.detectChanges();
  }

  it('renders a not-found state for an id that no longer exists', async () => {
    const fixture = await open({ id: 'ffffffff-0000-0000-0000-000000000000' } as Note);

    expect(fixture.nativeElement.textContent).toContain('This note no longer exists');
  });

  it('loads the stored title and body', async () => {
    const note = await store.createNote('text');
    await store.save(note.id, { title: 'Groceries', content: '- milk' });

    const fixture = await open(note);

    expect(fixture.nativeElement.querySelector('.editor__title').value).toBe('Groceries');
    expect(fixture.nativeElement.querySelector('.editor__content').value).toBe('- milk');
  });

  describe('autosave', () => {
    it('waits out the debounce before writing, then writes once', async () => {
      const note = await store.createNote('text');
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
      const note = await store.createNote('text');
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
      const note = await store.createNote('text');
      const fixture = await open(note);

      type(fixture, '.editor__title', 'Groceries');
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect((await repositories.notes.get(note.id)).title).toBe('Groceries');
    });

    it('flushes when the app is backgrounded', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);

      type(fixture, '.editor__content', 'typed then home key');
      background();
      await settle();

      expect((await repositories.notes.get(note.id)).content).toBe('typed then home key');
    });

    it('surfaces a failed write without clearing the text', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);
      vi.spyOn(repositories.notes, 'update').mockRejectedValue(new Error('no space'));

      type(fixture, '.editor__content', 'still here');
      fixture.componentInstance.ionViewWillLeave();
      await settle();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Could not save');
      expect(fixture.nativeElement.querySelector('.editor__content').value).toBe('still here');
    });

    // The banner promises the text is still here. Clearing `dirty` before the
    // write landed made that true only until the user backed out of the page:
    // `leave()`'s own flush then returned early and the edit went nowhere.
    it('keeps a failed edit pending so the next flush still writes it', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);
      const update = vi
        .spyOn(repositories.notes, 'update')
        .mockRejectedValueOnce(new Error('no space'));

      type(fixture, '.editor__content', 'nearly lost');
      fixture.componentInstance.ionViewWillLeave();
      await settle();
      expect((await repositories.notes.get(note.id)).content).toBe('');

      update.mockRestore();
      background();
      await settle();

      expect((await repositories.notes.get(note.id)).content).toBe('nearly lost');
    });

    // `saveFailed` is root-scoped, so it would otherwise stand over the next note.
    it('drops a previous note failure when another note opens', async () => {
      const failing = await store.createNote('text');
      const fixture = await open(failing);
      const update = vi
        .spyOn(repositories.notes, 'update')
        .mockRejectedValue(new Error('no space'));

      type(fixture, '.editor__content', 'lost');
      fixture.componentInstance.ionViewWillLeave();
      await settle();
      expect(store.saveFailed()).toBe(true);

      update.mockRestore();
      const other = await store.createNote('text');
      const next = await open(other);

      expect(store.saveFailed()).toBe(false);
      expect(next.nativeElement.textContent).not.toContain('Could not save');
    });
  });

  describe('discarding empty notes', () => {
    it('purges a note this session created and left blank', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note, true);

      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect(await repositories.notes.find(note.id)).toBeUndefined();
      expect(store.notes()).toEqual([]);
    });

    it('keeps a note this session created once it has any text', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note, true);

      type(fixture, '.editor__title', 'Groceries');
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect(await repositories.notes.find(note.id)).toBeDefined();
    });

    it('keeps a pre-existing note the user empties', async () => {
      const note = await store.createNote('text');
      await store.save(note.id, { title: 'Groceries', content: '- milk' });
      const fixture = await open(note);

      type(fixture, '.editor__title', '');
      type(fixture, '.editor__content', '');
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect(await repositories.notes.find(note.id)).toBeDefined();
    });

    // A checklist is created with one blank row waiting for text, so "no items"
    // is the wrong emptiness test.
    it('purges a created checklist whose rows were never filled in', async () => {
      const note = await store.createNote('checklist');
      const fixture = await open(note, true);

      addItem(fixture);
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect(await repositories.notes.find(note.id)).toBeUndefined();
    });

    it('keeps a created checklist once a row has text', async () => {
      const note = await store.createNote('checklist');
      const fixture = await open(note, true);

      addItem(fixture);
      type(fixture, '.checklist__text', 'milk');
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      expect(await repositories.notes.find(note.id)).toBeDefined();
    });
  });

  describe('checklist notes', () => {
    it('shows the checklist instead of the markdown editor', async () => {
      const note = await store.createNote('checklist');
      const fixture = await open(note);

      expect(fixture.nativeElement.querySelector('app-checklist-editor')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.editor__content')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-markdown-toolbar')).toBeNull();
      expect(fixture.nativeElement.querySelector('.editor__preview-toggle')).toBeNull();
    });

    it('loads stored items in sort order', async () => {
      const note = await store.createNote('checklist');
      await store.save(note.id, {
        checklist: [
          { id: 'a', text: 'milk', checked: false, sortOrder: 0 },
          { id: 'b', text: 'eggs', checked: true, sortOrder: 1 },
        ],
      });
      const fixture = await open(note);

      expect(itemValues(fixture)).toEqual(['milk', 'eggs']);
    });

    /**
     * The patch is key-presence based, so writing `content` alongside would
     * leave stale Markdown behind the items and resurface it on a convert.
     */
    it('autosaves the items and never writes content', async () => {
      const note = await store.createNote('checklist');
      const fixture = await open(note);
      vi.useFakeTimers();
      const update = vi.spyOn(repositories.notes, 'update');

      addItem(fixture);
      type(fixture, '.checklist__text', 'milk');
      await vi.advanceTimersByTimeAsync(500);

      expect(update.mock.calls.every(([, patch]) => !('content' in patch))).toBe(true);
      const stored = await repositories.notes.get(note.id);
      expect(stored.checklist?.map((item) => [item.text, item.sortOrder])).toEqual([['milk', 0]]);
    });

    it('keeps item ids and order across a reload', async () => {
      const note = await store.createNote('checklist');
      const fixture = await open(note);

      addItem(fixture);
      typeItem(fixture, 0, 'milk');
      addItem(fixture);
      typeItem(fixture, 1, 'eggs');
      fixture.componentInstance.ionViewWillLeave();
      await settle();

      const stored = (await repositories.notes.get(note.id)).checklist ?? [];
      expect(stored.map((item) => [item.text, item.sortOrder])).toEqual([
        ['milk', 0],
        ['eggs', 1],
      ]);

      const reopened = await open(note);
      expect(itemValues(reopened)).toEqual(['milk', 'eggs']);
      expect((await repositories.notes.get(note.id)).checklist?.map((item) => item.id)).toEqual(
        stored.map((item) => item.id),
      );
    });
  });

  describe('converting between note types', () => {
    it('turns markdown task lines into items in one write', async () => {
      const note = await store.createNote('text');
      await store.save(note.id, { content: '- [x] milk\n- eggs' });
      const fixture = await open(note);

      await convert(fixture);

      const stored = await repositories.notes.get(note.id);
      expect(stored.type).toBe('checklist');
      expect(stored.content).toBe('');
      expect(stored.checklist?.map((item) => [item.text, item.checked])).toEqual([
        ['milk', true],
        ['eggs', false],
      ]);
      expect(fixture.nativeElement.querySelector('app-checklist-editor')).not.toBeNull();
    });

    it('turns items back into task lines and drops the rows', async () => {
      const note = await store.createNote('checklist');
      await store.save(note.id, {
        checklist: [
          { id: 'a', text: 'milk', checked: true, sortOrder: 0 },
          { id: 'b', text: 'eggs', checked: false, sortOrder: 1 },
        ],
      });
      const fixture = await open(note);

      await convert(fixture);

      const stored = await repositories.notes.get(note.id);
      expect(stored.type).toBe('text');
      expect(stored.content).toBe('- [x] milk\n- [ ] eggs');
      expect(stored.checklist ?? []).toEqual([]);
      expect(fixture.nativeElement.querySelector('.editor__content').value).toBe(
        '- [x] milk\n- [ ] eggs',
      );
    });

    // Same `updatedAt` hazard as the notebook chip, and worse here: a debounce
    // landing after the convert would write the pre-convert body back.
    it('flushes a pending edit before converting', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);

      type(fixture, '.editor__content', '- [ ] milk');
      await convert(fixture);

      expect((await repositories.notes.get(note.id)).checklist?.map((i) => i.text)).toEqual([
        'milk',
      ]);
    });
  });

  describe('the formatting toolbar', () => {
    it('applies a transform to the selection and keeps the caret on the text', async () => {
      const note = await store.createNote('text');
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
      const note = await store.createNote('text');
      const fixture = await open(note);

      (fixture.nativeElement.querySelector('.editor__preview-toggle') as HTMLElement).click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('button[aria-label="Bold"]').disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('.editor__content')).toBeNull();
      expect(fixture.nativeElement.querySelector('.editor__preview')).not.toBeNull();
    });
  });

  describe('the notebook chip', () => {
    it('names the notebook the note is in', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);

      expect(fixture.nativeElement.querySelector('.editor__notebook').textContent).toContain(
        'Notes',
      );
    });

    it('flushes a pending edit before moving, so the move owns the newer updatedAt', async () => {
      const work = await notebooks.create('Work');
      const note = await store.createNote('text');
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
      const note = await store.createNote('text');
      const fixture = await open(note);
      const move = vi.spyOn(repositories.notes, 'move');

      (fixture.nativeElement.querySelector('.editor__notebook') as HTMLButtonElement).click();
      await settle();

      expect(move).not.toHaveBeenCalled();
    });
  });

  describe('the labels chip', () => {
    it('invites the user to assign a label, then names the ones assigned', async () => {
      const work = await labels.create('Work');
      const note = await store.createNote('text');
      const fixture = await open(note);
      const chip = fixture.nativeElement.querySelector('.editor__labels') as HTMLButtonElement;

      expect(chip.textContent).toContain('Labels');

      chosenLabelIds = [work.id];
      chip.click();
      await settle();
      fixture.detectChanges();

      expect(chip.textContent).toContain('Work');
      expect((await repositories.notes.get(note.id)).labels).toEqual([work.id]);
    });

    // The same `updatedAt` hazard as the notebook chip: `setLabels` bumps the
    // timestamp, so a debounced body still in the textarea has to land first.
    it('flushes a pending edit before writing the labels', async () => {
      const work = await labels.create('Work');
      const note = await store.createNote('text');
      const fixture = await open(note);

      const writes: string[] = [];
      const update = repositories.notes.update.bind(repositories.notes);
      const setLabels = repositories.notes.setLabels.bind(repositories.notes);
      vi.spyOn(repositories.notes, 'update').mockImplementation((id, patch) => {
        writes.push('update');
        return update(id, patch);
      });
      vi.spyOn(repositories.notes, 'setLabels').mockImplementation((id, labelIds) => {
        writes.push('setLabels');
        return setLabels(id, labelIds);
      });

      type(fixture, '.editor__content', 'typed then labelled');
      chosenLabelIds = [work.id];
      (fixture.nativeElement.querySelector('.editor__labels') as HTMLButtonElement).click();
      await settle();

      // `setLabels` is itself an `update`, so only the leading pair is asserted.
      expect(writes.slice(0, 2)).toEqual(['update', 'setLabels']);
      const stored = await repositories.notes.get(note.id);
      expect(stored.content).toBe('typed then labelled');
      expect(stored.labels).toEqual([work.id]);
    });

    it('leaves the labels alone when the alert is dismissed', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);
      const setLabels = vi.spyOn(repositories.notes, 'setLabels');

      (fixture.nativeElement.querySelector('.editor__labels') as HTMLButtonElement).click();
      await settle();

      expect(setLabels).not.toHaveBeenCalled();
    });
  });

  describe('preview links', () => {
    it('opens http(s) links out of the app rather than navigating the WebView', async () => {
      const note = await store.createNote('text');
      await store.save(note.id, { content: '[docs](https://example.com/)' });
      const fixture = await open(note);
      const open_ = vi.spyOn(window, 'open').mockReturnValue(null);

      (fixture.nativeElement.querySelector('.editor__preview-toggle') as HTMLElement).click();
      fixture.detectChanges();

      const anchor = fixture.nativeElement.querySelector('.editor__preview a') as HTMLAnchorElement;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(true);
      expect(open_).toHaveBeenCalledWith('https://example.com/', '_blank');
    });
  });

  describe('images', () => {
    /** The picker hands the WebView a `File`; jsdom cannot open one, so this is the seam. */
    function attach(
      fixture: ComponentFixture<NoteEditorPage>,
      type = 'image/png',
      name = 'holiday.png',
    ): Promise<void> {
      return (
        fixture.componentInstance as unknown as { attachImage(file: File): Promise<void> }
      ).attachImage(new File(['bytes'], name, { type }));
    }

    async function attached(fixture: ComponentFixture<NoteEditorPage>): Promise<void> {
      await attach(fixture);
      fixture.detectChanges();
    }

    it('writes the reference into the body and claims the image on the note', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);

      await attached(fixture);

      const stored = await repositories.notes.get(note.id);
      expect(stored.imageIds).toHaveLength(1);
      expect(stored.content).toBe(`![holiday.png](glacier-img://${stored.imageIds[0]})\n`);
      expect(await repositories.files.list()).toEqual(stored.imageIds);
    });

    it('shows a thumbnail per attachment', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);

      await attached(fixture);
      await attached(fixture);

      expect(fixture.nativeElement.querySelectorAll('.editor__thumb')).toHaveLength(2);
    });

    /**
     * Same `updatedAt` hazard as the notebook chip: a debounce landing after the
     * attach would write the pre-attach body back over the reference.
     */
    it('flushes a pending edit before attaching', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);

      type(fixture, '.editor__content', 'typed first');
      await attached(fixture);

      const stored = await repositories.notes.get(note.id);
      expect(stored.content).toBe(
        `typed first\n![holiday.png](glacier-img://${stored.imageIds[0]})\n`,
      );
    });

    it('explains a rejected file and writes nothing', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);

      await attach(fixture, 'application/pdf', 'manual.pdf');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('not supported');
      expect((await repositories.notes.get(note.id)).imageIds).toEqual([]);
      expect(await repositories.files.list()).toEqual([]);
    });

    it('takes the reference out of the body and deletes the file when removed', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);
      await attached(fixture);
      viewerAnswer = 'remove';

      (fixture.nativeElement.querySelector('.editor__thumb') as HTMLButtonElement).click();
      await settle();
      fixture.detectChanges();

      const stored = await repositories.notes.get(note.id);
      expect(stored.content).toBe('');
      expect(stored.imageIds).toEqual([]);
      expect(await repositories.files.list()).toEqual([]);
      expect(await repositories.images.listIds()).toEqual([]);
      expect(fixture.nativeElement.querySelector('.editor__thumb')).toBeNull();
    });

    it('keeps the image when the viewer is dismissed without removing', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);
      await attached(fixture);

      (fixture.nativeElement.querySelector('.editor__thumb') as HTMLButtonElement).click();
      await settle();

      expect(await repositories.files.list()).toHaveLength(1);
    });

    it('offers no image button on a checklist, which has no body to put one in', async () => {
      const note = await store.createNote('checklist');
      const fixture = await open(note);

      expect(fixture.nativeElement.querySelector('button[aria-label="Image"]')).toBeNull();
    });

    it('opens the viewer for an image tapped in the preview', async () => {
      const note = await store.createNote('text');
      const fixture = await open(note);
      await attached(fixture);
      const imageId = (await repositories.notes.get(note.id)).imageIds[0];

      (fixture.nativeElement.querySelector('.editor__preview-toggle') as HTMLElement).click();
      fixture.detectChanges();
      const image = fixture.nativeElement.querySelector(
        '.editor__preview img[data-image-id]',
      ) as HTMLImageElement;

      expect(image.getAttribute('data-image-id')).toBe(imageId);
      expect(image.getAttribute('src')).toContain('data:image/png;base64,');
    });
  });
});
