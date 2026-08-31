import { beforeEach, describe, expect, it } from 'vitest';

import { createTestRepositories, type TestRepositories } from './testing';

/**
 * `search_text` has no domain counterpart, so nothing else in the suite would
 * notice it going stale. These read the column directly for that reason.
 */
describe('notes.search_text after a write', () => {
  let repos: TestRepositories;

  async function searchText(id: string): Promise<string | undefined> {
    const [row] = await repos.adapter.query<{ search_text: string }>(
      'SELECT search_text FROM notes WHERE id = ?',
      [id],
    );
    return row?.search_text;
  }

  beforeEach(async () => {
    repos = await createTestRepositories();
  });

  it('is written on create, folded and joined across fields', async () => {
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Einkauf',
      content: 'Bei MÜLLER',
    });

    expect(await searchText(note.id)).toBe('einkauf\nbei müller');
  });

  it('covers the items of a checklist created in one go', async () => {
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'checklist',
      title: 'Packliste',
      checklist: [
        { id: 'a', text: 'Reisepass', checked: false, sortOrder: 0 },
        { id: 'b', text: 'Zahnbürste', checked: false, sortOrder: 1 },
      ],
    });

    expect(await searchText(note.id)).toBe('packliste\n\nreisepass\nzahnbürste');
  });

  it('follows a title edit rather than keeping the old haystack', async () => {
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Old',
      content: 'Body',
    });

    await repos.notes.update(note.id, { title: 'New' });

    expect(await searchText(note.id)).toBe('new\nbody');
  });

  it('follows a checklist edit, including a removed item', async () => {
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'checklist',
      title: 'List',
      checklist: [
        { id: 'a', text: 'Keep', checked: false, sortOrder: 0 },
        { id: 'b', text: 'Drop', checked: false, sortOrder: 1 },
      ],
    });

    await repos.notes.update(note.id, {
      checklist: [{ id: 'a', text: 'Keep', checked: true, sortOrder: 0 }],
    });

    expect(await searchText(note.id)).toBe('list\n\nkeep');
  });

  it('drops item text when a checklist is converted to a text note', async () => {
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'checklist',
      title: 'List',
      checklist: [{ id: 'a', text: 'Milch', checked: false, sortOrder: 0 }],
    });

    await repos.notes.update(note.id, { type: 'text', content: 'Prose' });

    expect(await searchText(note.id)).toBe('list\nprose');
  });

  it('survives a write that cannot change the text, such as pinning', async () => {
    const note = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Kept',
      content: 'Body',
    });

    await repos.notes.setPinned(note.id, true);
    await repos.notes.trash(note.id);
    await repos.notes.restore(note.id);

    expect(await searchText(note.id)).toBe('kept\nbody');
  });
});
