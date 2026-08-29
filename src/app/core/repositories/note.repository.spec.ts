import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChecklistItem } from '../models/checklist-item';
import { EntityNotFoundError } from './repository-errors';
import { createTestRepositories, type TestRepositories } from './testing';

const START = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

function item(text: string, sortOrder: number): ChecklistItem {
  return { id: crypto.randomUUID(), text, checked: false, sortOrder };
}

describe('NoteRepository', () => {
  let repos: TestRepositories;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    repos = await createTestRepositories();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await repos.adapter.close();
  });

  function create(overrides: Partial<{ title: string; content: string }> = {}) {
    return repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Title',
      content: 'Body',
      ...overrides,
    });
  }

  it('round-trips a note through SQLite unchanged', async () => {
    const created = await create();

    expect(await repos.notes.get(created.id)).toEqual(created);
    expect(created).toMatchObject({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Title',
      content: 'Body',
      imageIds: [],
      pinned: false,
      archived: false,
      labels: [],
    });
  });

  // The desktop's restore path does `delete note.deletedAt` and its validator
  // treats a present-but-undefined key differently from an absent one, so this
  // is a file-format guarantee rather than a stylistic preference.
  it('leaves unset optional fields absent rather than null', async () => {
    const note = await repos.notes.get((await create()).id);

    expect('deletedAt' in note).toBe(false);
    expect('color' in note).toBe(false);
    expect('checklist' in note).toBe(false);
    expect(JSON.parse(JSON.stringify(note))).toEqual(note);
  });

  it('carries a checklist only on checklist notes, renumbered by array position', async () => {
    const created = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'checklist',
      checklist: [item('second', 40), item('first', 10)],
    });

    expect(created.checklist?.map((entry) => [entry.text, entry.sortOrder])).toEqual([
      ['second', 0],
      ['first', 1],
    ]);
  });

  it('distinguishes clearing a colour from not mentioning it', async () => {
    const note = await create();
    await repos.notes.update(note.id, { color: 'teal' });

    const untouched = await repos.notes.update(note.id, { title: 'Renamed' });
    expect(untouched.color).toBe('teal');

    const cleared = await repos.notes.update(note.id, { color: undefined });
    expect('color' in cleared).toBe(false);
  });

  // `noteFromRow` merely hides a text note's checklist, so rows left behind
  // would reappear if the type ever flipped back.
  it('deletes the checklist rows when a note becomes a text note', async () => {
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'checklist',
      checklist: [item('one', 0), item('two', 1)],
    });

    await repos.notes.update(note.id, { type: 'text' });

    expect(
      await repos.adapter.query('SELECT id FROM checklist_items WHERE note_id = ?', [note.id]),
    ).toEqual([]);
  });

  it('reorders a checklist by rewriting it, keeping item ids stable', async () => {
    const first = item('one', 0);
    const second = item('two', 1);
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'checklist',
      checklist: [first, second],
    });

    const reordered = await repos.notes.update(note.id, {
      checklist: [
        { ...second, sortOrder: 0 },
        { ...first, sortOrder: 1 },
      ],
    });

    expect(reordered.checklist?.map((entry) => entry.id)).toEqual([second.id, first.id]);
  });

  it('stores labels and images as declared', async () => {
    const label = await repos.labels.create('Work');
    const imageId = crypto.randomUUID();
    await repos.images.insert({ id: imageId, mimeType: 'image/png' });

    const note = await create();
    const updated = await repos.notes.update(note.id, {
      labels: [label.id],
      imageIds: [imageId],
    });

    expect(updated.labels).toEqual([label.id]);
    expect(updated.imageIds).toEqual([imageId]);
  });

  it('reports a missing note rather than returning undefined from get', async () => {
    await expect(repos.notes.get(crypto.randomUUID())).rejects.toBeInstanceOf(EntityNotFoundError);
    expect(await repos.notes.find(crypto.randomUUID())).toBeUndefined();
  });

  it('refuses to move a note into a notebook that does not exist, changing nothing', async () => {
    const note = await create();

    await expect(repos.notes.move(note.id, crypto.randomUUID())).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
    expect(await repos.notes.get(note.id)).toEqual(note);
  });

  it('refuses to create a note in a notebook that does not exist', async () => {
    await expect(
      repos.notes.create({ notebookId: crypto.randomUUID(), type: 'text' }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);

    expect(await repos.notes.list({ kind: 'active' })).toEqual([]);
  });

  // An image mentioned only in the body has no `note_images` row, so returning
  // just the declared ids would leave its file behind with nothing to find it.
  it('returns declared and body-referenced image ids when purging', async () => {
    const declared = crypto.randomUUID();
    const embedded = crypto.randomUUID();
    await repos.images.insert({ id: declared, mimeType: 'image/png' });

    const note = await create({ content: `text ![](glacier-img://${embedded}) more` });
    await repos.notes.update(note.id, { imageIds: [declared] });

    expect((await repos.notes.purge(note.id)).sort()).toEqual([declared, embedded].sort());
    expect(await repos.notes.find(note.id)).toBeUndefined();
  });

  // The cutoff comparison is `deleted_at < cutoff`, so a note trashed exactly
  // `days` ago has not yet outlived the window.
  it('purges a trashed note once it is past the window, not at it', async () => {
    const note = await create();
    await repos.notes.trash(note.id);

    vi.setSystemTime(START + 30 * DAY_MS);
    expect(await repos.notes.purgeExpired(30)).toEqual([]);
    expect(await repos.notes.find(note.id)).toBeDefined();

    vi.setSystemTime(START + 30 * DAY_MS + 1);
    await repos.notes.purgeExpired(30);
    expect(await repos.notes.find(note.id)).toBeUndefined();
  });

  it('never purges a note that is merely old, only one that is trashed', async () => {
    const note = await create();

    vi.setSystemTime(START + 900 * DAY_MS);
    await repos.notes.purgeExpired(30);

    expect(await repos.notes.find(note.id)).toBeDefined();
  });

  it('purges nothing at all when the window is disabled', async () => {
    const note = await create();
    await repos.notes.trash(note.id);

    vi.setSystemTime(START + 900 * DAY_MS);

    expect(await repos.notes.purgeExpired(0)).toEqual([]);
    expect(await repos.notes.purgeExpired(-1)).toEqual([]);
    expect(await repos.notes.find(note.id)).toBeDefined();
  });

  it('empties the trash in one pass, reporting every freed image and sparing the rest', async () => {
    const trashedImage = crypto.randomUUID();
    const keptImage = crypto.randomUUID();
    await repos.images.insert({ id: trashedImage, mimeType: 'image/png' });
    await repos.images.insert({ id: keptImage, mimeType: 'image/png' });

    const doomed = await create();
    await repos.notes.update(doomed.id, { imageIds: [trashedImage] });
    await repos.notes.trash(doomed.id);
    const embedded = crypto.randomUUID();
    const alsoDoomed = await create({ content: `![](glacier-img://${embedded})` });
    await repos.notes.trash(alsoDoomed.id);
    const survivor = await create();
    await repos.notes.update(survivor.id, { imageIds: [keptImage] });

    expect((await repos.notes.emptyTrash()).sort()).toEqual([trashedImage, embedded].sort());
    expect(await repos.notes.list({ kind: 'trashed' })).toEqual([]);
    expect(await repos.notes.find(survivor.id)).toBeDefined();
  });
});
