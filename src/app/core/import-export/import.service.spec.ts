import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { newId } from '../models/entity-id';
import type { Note } from '../models/note';
import { createTestRepositories, type TestRepositories } from '../repositories/testing';
import { ImportService } from './import.service';
import type { ExportEnvelope, ImportStrategy } from './transfer-contract';

/**
 * Over the real SQLite engine, the real repositories and the real (in-memory)
 * image store, for the reason `createTestRepositories` gives: what an import has
 * to get right is transaction rollback, foreign keys and which files survive,
 * and a fake would only assert what we already believe about those.
 *
 * The file under import is the desktop's own fixture. Rejection cases mutate the
 * parsed fixture in place rather than committing near-duplicates of it, so there
 * is exactly one artefact in the repository that the desktop wrote.
 */

const FIXTURE_JSON = readFileSync(
  'src/app/core/import-export/fixtures/desktop-all-v1.glacier.json',
  'utf-8',
);

const FIXTURE_DEFAULT_NOTEBOOK = 'b94ab381-58b3-4012-b2f7-601b6d09fbaa';
const FIXTURE_IMAGE = '90958531-28f7-40dd-944d-b1b82f7b1d4b';
const FIXTURE_LABEL = 'd5fe0ee5-d974-43cc-808f-82730d9502d2';

function parsedFixture(): ExportEnvelope {
  return JSON.parse(FIXTURE_JSON) as ExportEnvelope;
}

describe('ImportService', () => {
  let repos: TestRepositories;
  let service: ImportService;

  beforeEach(async () => {
    repos = await createTestRepositories();
    service = TestBed.inject(ImportService);
  });

  afterEach(async () => {
    await repos.adapter.close();
  });

  function file(json: string, name = 'backup.glacier.json'): File {
    return new File([json], name, { type: 'application/json' });
  }

  /** Inspect then apply, asserting the inspection got far enough to apply. */
  async function importJson(json: string, strategy: ImportStrategy = 'preserve') {
    const inspected = await service.inspect(file(json));
    expect(inspected.status).toBe('ready');
    return service.apply(strategy);
  }

  async function allNotes(): Promise<Note[]> {
    return [
      ...(await repos.notes.list({ kind: 'all' })),
      ...(await repos.notes.list({ kind: 'trashed' })),
    ];
  }

  /** Makes one statement fail, so the transaction rolls back where it matters. */
  function failOn(fragment: string) {
    const run = repos.adapter.run.bind(repos.adapter);
    return vi.spyOn(repos.adapter, 'run').mockImplementation((sql, params) => {
      return sql.includes(fragment) ? Promise.reject(new Error('write failed')) : run(sql, params);
    });
  }

  function byTitle(notes: readonly Note[], title: string): Note {
    const note = notes.find((candidate) => candidate.title === title);
    if (!note) {
      throw new Error(`no note titled ${title}`);
    }
    return note;
  }

  describe('inspect', () => {
    it('reports the counts and that a fresh store has no conflicts', async () => {
      const result = await service.inspect(file(FIXTURE_JSON, 'desktop.glacier.json'));

      expect(result).toEqual({
        status: 'ready',
        fileName: 'desktop.glacier.json',
        hasConflicts: false,
        counts: { notebooks: 2, notes: 6, labels: 1, images: 1 },
      });
    });

    it('reports a conflict once the same file has been imported', async () => {
      await importJson(FIXTURE_JSON);

      const result = await service.inspect(file(FIXTURE_JSON));

      expect(result).toMatchObject({ status: 'ready', hasConflicts: true });
    });

    /**
     * A trashed note still owns its id, so a file carrying it overwrites it —
     * the reason `readExistingIds` reads the notes table unfiltered. Everything
     * else in this envelope is given a fresh id, so the trashed note is the only
     * thing that can produce the conflict.
     */
    it('counts a trashed note as a conflict', async () => {
      await importJson(FIXTURE_JSON);
      const envelope = parsedFixture();
      const trashed = envelope.notes.find((note) => note.deletedAt !== undefined) as Note;
      const notebook = { ...envelope.notebooks[0], id: newId() };
      envelope.notebooks = [notebook];
      envelope.notes = [{ ...trashed, notebookId: notebook.id }];
      envelope.labels = [];
      envelope.images = [];
      envelope.defaultNotebookId = notebook.id;

      const result = await service.inspect(file(JSON.stringify(envelope)));

      expect(result).toMatchObject({ status: 'ready', hasConflicts: true });
    });

    it('refuses a schema version it does not know', async () => {
      const envelope = { ...parsedFixture(), schemaVersion: 999 };

      const result = await service.inspect(file(JSON.stringify(envelope)));

      expect(result.status).toBe('invalid');
      if (result.status !== 'invalid') return;
      expect(result.errors.join(' ')).toContain('schemaVersion');
    });

    /**
     * V8's parse errors quote the offending token, which can be a character of
     * the user's own note text, so the message shown is a constant.
     */
    it('refuses malformed JSON without quoting it', async () => {
      const truncated = FIXTURE_JSON.slice(0, 400);

      const result = await service.inspect(file(truncated));

      expect(result).toEqual({ status: 'invalid', errors: ['The file is not valid JSON.'] });
    });

    it('refuses a note pointing at a label the file does not carry', async () => {
      const envelope = parsedFixture();
      envelope.labels = [];

      const result = await service.inspect(file(JSON.stringify(envelope)));

      expect(result.status).toBe('invalid');
      if (result.status !== 'invalid') return;
      expect(result.errors.join(' ')).toContain(FIXTURE_LABEL);
    });

    it('refuses an image whose base64 is truncated', async () => {
      const envelope = parsedFixture();
      const [image] = envelope.images;
      envelope.images = [{ ...image, base64: `${image.base64.slice(0, -3)}!!!` }];

      const result = await service.inspect(file(JSON.stringify(envelope)));

      expect(result.status).toBe('invalid');
    });

    it('leaves nothing pending when the file is rejected', async () => {
      await service.inspect(file('not json at all'));

      expect(await service.apply('preserve')).toEqual({ status: 'nothing-pending' });
      expect(await allNotes()).toHaveLength(0);
    });
  });

  describe('apply into an empty collection', () => {
    it('restores every entity with its own ids, times and flags', async () => {
      const result = await importJson(FIXTURE_JSON);

      expect(result).toEqual({
        status: 'done',
        counts: { notebooks: 2, notes: 6, labels: 1, images: 1 },
      });

      const envelope = parsedFixture();
      const notes = await allNotes();
      expect(notes).toHaveLength(6);
      for (const expected of envelope.notes) {
        const actual = notes.find((note) => note.id === expected.id);
        expect(actual).toMatchObject({
          title: expected.title,
          content: expected.content,
          type: expected.type,
          pinned: expected.pinned,
          archived: expected.archived,
          notebookId: expected.notebookId,
          createdAt: expected.createdAt,
          updatedAt: expected.updatedAt,
        });
      }

      expect((await repos.notebooks.list()).map((notebook) => notebook.id).sort()).toEqual(
        envelope.notebooks.map((notebook) => notebook.id).sort(),
      );
      expect(await repos.labels.list()).toEqual(envelope.labels);
      expect(await repos.images.find(FIXTURE_IMAGE)).toMatchObject({ mimeType: 'image/png' });
      expect(await repos.files.read(FIXTURE_IMAGE)).toBe(envelope.images[0].base64);
    });

    it('keeps the checklist items, their order and their checked state', async () => {
      await importJson(FIXTURE_JSON);

      const checklist = byTitle(await allNotes(), 'Packing list').checklist;
      const expected = parsedFixture().notes.find((note) => note.type === 'checklist')?.checklist;
      expect(checklist).toEqual(expected);
    });

    it('keeps the trashed note trashed and the archived note archived', async () => {
      await importJson(FIXTURE_JSON);

      const notes = await allNotes();
      expect(byTitle(notes, 'Trashed note').deletedAt).toBeDefined();
      expect(byTitle(notes, 'Archived note').archived).toBe(true);
      expect(byTitle(notes, 'Pinned and coloured').color).toBe('teal');
      expect(byTitle(notes, 'Plain note').labels).toEqual([FIXTURE_LABEL]);
    });

    /**
     * `preserve` into a store that is still the freshly seeded one is the
     * restore-a-backup path: the file's own default notebook wins and the
     * seeded notebook, which nothing in the file names, goes.
     */
    it('adopts the file’s default notebook and drops the seeded one', async () => {
      await importJson(FIXTURE_JSON);

      expect(await repos.notebooks.getDefaultId()).toBe(FIXTURE_DEFAULT_NOTEBOOK);
      expect((await repos.notebooks.list()).map((notebook) => notebook.id)).not.toContain(
        repos.defaultNotebookId,
      );
    });

    it('leaves the local collection alone when the store is not pristine', async () => {
      await repos.notes.create({
        notebookId: repos.defaultNotebookId,
        type: 'text',
        title: 'Mine',
      });

      await importJson(FIXTURE_JSON);

      expect(await repos.notebooks.getDefaultId()).toBe(repos.defaultNotebookId);
      expect((await allNotes()).map((note) => note.title)).toContain('Mine');
    });
  });

  describe('the same file a second time', () => {
    it('as copies, adds everything again under fresh ids', async () => {
      await importJson(FIXTURE_JSON);
      const before = await allNotes();

      const result = await importJson(FIXTURE_JSON, 'copy');

      expect(result.status).toBe('done');
      const after = await allNotes();
      expect(after).toHaveLength(12);
      expect((await repos.notebooks.list()).length).toBe(4);
      expect((await repos.labels.list()).length).toBe(2);
      // Every original survived untouched, and no id was reused.
      for (const note of before) {
        expect(after.find((candidate) => candidate.id === note.id)).toMatchObject({
          updatedAt: note.updatedAt,
        });
      }
    });

    it('as copies, points the copied body and junction at the copied image', async () => {
      await importJson(FIXTURE_JSON);

      await importJson(FIXTURE_JSON, 'copy');

      const copies = (await allNotes()).filter((note) => note.title === 'Note with an image');
      expect(copies).toHaveLength(2);
      const copy = copies.find((note) => !note.imageIds.includes(FIXTURE_IMAGE));
      expect(copy).toBeDefined();
      const [copiedImageId] = copy?.imageIds ?? [];
      expect(copiedImageId).not.toBe(FIXTURE_IMAGE);
      expect(copy?.content).toContain(`glacier-img://${copiedImageId}`);
      expect(copy?.content).not.toContain(FIXTURE_IMAGE);
      expect(await repos.files.read(copiedImageId)).toBe(parsedFixture().images[0].base64);
      expect(await repos.images.find(copiedImageId)).toBeDefined();
    });

    it('as replace, overwrites by id and leaves an unrelated note alone', async () => {
      await importJson(FIXTURE_JSON);
      const mine = await repos.notes.create({
        notebookId: FIXTURE_DEFAULT_NOTEBOOK,
        type: 'text',
        title: 'Mine',
        content: 'Untouched.',
      });
      // A local edit the file will overwrite.
      const plain = byTitle(await allNotes(), 'Plain note');
      await repos.notes.update(plain.id, { content: 'Edited locally.' });

      const result = await importJson(FIXTURE_JSON, 'replace');

      expect(result.status).toBe('done');
      const after = await allNotes();
      expect(after).toHaveLength(7);
      expect(byTitle(after, 'Plain note')).toMatchObject({
        id: plain.id,
        content: parsedFixture().notes[0].content,
      });
      expect(byTitle(after, 'Mine')).toMatchObject({ id: mine.id, content: 'Untouched.' });
    });

    it('as replace, keeps an image both the old and the new note reference', async () => {
      await importJson(FIXTURE_JSON);

      await importJson(FIXTURE_JSON, 'replace');

      expect(await repos.images.find(FIXTURE_IMAGE)).toBeDefined();
      expect(await repos.files.read(FIXTURE_IMAGE)).not.toBeNull();
    });

    /**
     * The prior-image sweep is the whole reason `replace` collects what it
     * purged: an overwrite that drops the last reference to an image must take
     * the row and the file with it.
     */
    it('as replace, collects an image the replacement no longer references', async () => {
      const envelope = parsedFixture();
      await importJson(JSON.stringify(envelope));
      const withImage = envelope.notes.find((note) => note.imageIds.length > 0) as Note;
      envelope.notes = envelope.notes.map((note) =>
        note.id === withImage.id ? { ...note, content: 'No image any more.', imageIds: [] } : note,
      );
      envelope.images = [];

      await importJson(JSON.stringify(envelope), 'replace');

      expect(await repos.images.find(FIXTURE_IMAGE)).toBeUndefined();
      expect(await repos.files.read(FIXTURE_IMAGE)).toBeNull();
    });
  });

  describe('image bytes', () => {
    /** A UUID identifies one asset, so a known id means the local bytes are it. */
    it('keeps the local bytes when the id already exists', async () => {
      await repos.images.insert({ id: FIXTURE_IMAGE, mimeType: 'image/png', fileName: 'mine.png' });
      await repos.files.write(FIXTURE_IMAGE, 'bG9jYWw=', 'image/png');

      await importJson(FIXTURE_JSON, 'replace');

      expect(await repos.files.read(FIXTURE_IMAGE)).toBe('bG9jYWw=');
      expect(await repos.images.find(FIXTURE_IMAGE)).toMatchObject({ fileName: 'mine.png' });
    });

    /** A row whose file went missing is repaired rather than left dangling. */
    it('rewrites the bytes when the row exists but the file does not', async () => {
      await repos.images.insert({ id: FIXTURE_IMAGE, mimeType: 'image/png' });

      await importJson(FIXTURE_JSON, 'replace');

      expect(await repos.files.read(FIXTURE_IMAGE)).toBe(parsedFixture().images[0].base64);
    });

    /** The file is named after the id, so a hostile `fileName` is only metadata. */
    it('never lets a file name reach the file store', async () => {
      const envelope = parsedFixture();
      envelope.images = [{ ...envelope.images[0], fileName: '../../evil.png' }];

      await importJson(JSON.stringify(envelope));

      expect(await repos.files.list()).toEqual([FIXTURE_IMAGE]);
      expect(await repos.images.find(FIXTURE_IMAGE)).toMatchObject({ fileName: '../../evil.png' });
    });
  });

  describe('failure', () => {
    it('rolls the database back and stages no file when the file store throws', async () => {
      const spy = vi
        .spyOn(repos.files, 'write')
        .mockRejectedValue(new Error('no space left on device'));

      const result = await importJson(FIXTURE_JSON);

      expect(result).toEqual({ status: 'failed' });
      expect(await allNotes()).toHaveLength(0);
      expect(await repos.notebooks.getDefaultId()).toBe(repos.defaultNotebookId);
      expect((await repos.notebooks.list()).map((notebook) => notebook.id)).toEqual([
        repos.defaultNotebookId,
      ]);
      expect(await repos.labels.list()).toEqual([]);
      expect(await repos.files.list()).toEqual([]);
      spy.mockRestore();
    });

    /** A throw after the bytes landed must take the bytes back out again. */
    it('deletes the files it staged when the database write throws', async () => {
      const spy = failOn('INSERT INTO notes');

      const result = await importJson(FIXTURE_JSON);

      expect(result).toEqual({ status: 'failed' });
      expect(await repos.files.list()).toEqual([]);
      spy.mockRestore();
      expect(await allNotes()).toHaveLength(0);
      expect(await repos.images.find(FIXTURE_IMAGE)).toBeUndefined();
    });

    it('does not destroy a local file when the import that would reuse it fails', async () => {
      await repos.images.insert({ id: FIXTURE_IMAGE, mimeType: 'image/png' });
      await repos.files.write(FIXTURE_IMAGE, 'bG9jYWw=', 'image/png');
      const spy = failOn('INSERT INTO notes');

      await importJson(FIXTURE_JSON, 'replace');

      spy.mockRestore();
      expect(await repos.files.read(FIXTURE_IMAGE)).toBe('bG9jYWw=');
    });
  });

  describe('cancel', () => {
    it('drops the pending envelope', async () => {
      const inspected = await service.inspect(file(FIXTURE_JSON));
      expect(inspected.status).toBe('ready');

      service.cancel();

      expect(await service.apply('preserve')).toEqual({ status: 'nothing-pending' });
      expect(await allNotes()).toHaveLength(0);
    });

    it('applies nothing twice from one inspection', async () => {
      await importJson(FIXTURE_JSON);

      expect(await service.apply('preserve')).toEqual({ status: 'nothing-pending' });
      expect(await allNotes()).toHaveLength(6);
    });
  });
});
