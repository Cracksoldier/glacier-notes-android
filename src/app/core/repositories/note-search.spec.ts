import { beforeEach, describe, expect, it } from 'vitest';

import type { Note } from '../models/note';
import type { NoteScope } from './note-queries';
import { createTestRepositories, type TestRepositories } from './testing';

/**
 * Search is a predicate over a scope. These pin the predicate; `note-ordering.spec.ts`
 * pins the orderings the scopes carry into it.
 */
describe('searching notes', () => {
  let repos: TestRepositories;

  beforeEach(async () => {
    repos = await createTestRepositories();
  });

  function create(title: string, content = '') {
    return repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title,
      content,
    });
  }

  async function search(query: string, scope: NoteScope = { kind: 'all' }): Promise<string[]> {
    const notes = await repos.notes.list({ kind: 'search', query, scope });
    return notes.map((note: Note) => note.title);
  }

  it('matches the title, the body and a checklist item alike', async () => {
    await create('Reisepass', 'nothing here');
    await create('Body hit', 'the word Reisepass appears here');
    await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'checklist',
      title: 'Item hit',
      checklist: [{ id: 'a', text: 'Reisepass', checked: false, sortOrder: 0 }],
    });
    await create('Miss', 'unrelated');

    expect((await search('reisepass')).sort()).toEqual(['Body hit', 'Item hit', 'Reisepass']);
  });

  // The case SQLite cannot do on its own: `lower()` and `LIKE` fold ASCII only,
  // so a stored `MÜLLER` would never match a query of `müller`.
  it('folds German case in both directions', async () => {
    await create('Einkauf bei MÜLLER');
    await create('Die STRASSE');

    expect(await search('müller')).toEqual(['Einkauf bei MÜLLER']);
    expect(await search('STRASSE')).toEqual(['Die STRASSE']);
  });

  it('matches inside a compound, which a token index could not', async () => {
    await create('Einkaufsliste');

    expect(await search('kauf')).toEqual(['Einkaufsliste']);
  });

  // Without `escapeLikePattern` plus `ESCAPE '\'` these are wildcards and match
  // everything, where the desktop's `includes()` matches only the literal.
  it('treats % and _ as literals rather than wildcards', async () => {
    await create('Discount 100% off');
    await create('Plain note');

    expect(await search('%')).toEqual(['Discount 100% off']);
    expect(await search('_')).toEqual([]);
  });

  it('finds nothing rather than everything for a query no note contains', async () => {
    await create('Something');

    expect(await search('zzz')).toEqual([]);
  });

  it('never reaches the trash from the all scope, but does from the trash scope', async () => {
    const note = await create('Deleted thing');
    await repos.notes.trash(note.id);

    expect(await search('deleted')).toEqual([]);
    expect(await search('deleted', { kind: 'trashed' })).toEqual(['Deleted thing']);
  });

  it('narrows to a notebook or a label when the scope says so', async () => {
    const other = await repos.notebooks.create('Other');
    const label = await repos.labels.create('Work');
    const here = await create('Target here');
    const there = await repos.notes.create({
      notebookId: other.id,
      type: 'text',
      title: 'Target there',
    });
    await repos.notes.setLabels(here.id, [label.id]);

    expect((await search('target')).sort()).toEqual(['Target here', 'Target there']);
    expect(await search('target', { kind: 'notebook', notebookId: other.id })).toEqual([
      'Target there',
    ]);
    expect(await search('target', { kind: 'label', labelId: label.id })).toEqual(['Target here']);
    expect(there.title).toBe('Target there');
  });

  it('reflects an edit immediately, rather than matching the pre-edit text', async () => {
    const note = await create('Before');

    await repos.notes.update(note.id, { title: 'After' });

    expect(await search('before')).toEqual([]);
    expect(await search('after')).toEqual(['After']);
  });
});
