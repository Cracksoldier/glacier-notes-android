import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Note } from '../../core/models/note';
import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { LabelsStore } from '../labels/labels.store';
import { NotesStore } from '../notes/notes.store';
import { SearchPage } from './search.page';

describe('SearchPage', () => {
  let repositories: TestRepositories;
  let fixture: ComponentFixture<SearchPage>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
      ],
    });
    repositories = await createTestRepositories();
    fixture = TestBed.createComponent(SearchPage);
    fixture.detectChanges();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  function host(): HTMLElement {
    return fixture.nativeElement;
  }

  /** `ion-searchbar` reports its value on a CustomEvent, which is all the page reads. */
  async function type(value: string): Promise<void> {
    host()
      .querySelector('ion-searchbar')
      ?.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
    await TestBed.inject(NotesStore).load();
    fixture.detectChanges();
  }

  async function chip(text: string): Promise<void> {
    const button = [...host().querySelectorAll<HTMLButtonElement>('.scopes__chip')].find(
      (element) => element.textContent?.trim() === text,
    );
    button?.click();
    await TestBed.inject(NotesStore).load();
    fixture.detectChanges();
  }

  function titles(): string[] {
    return [...host().querySelectorAll('.note-card__title')].map(
      (element) => element.textContent ?? '',
    );
  }

  function create(overrides: Partial<Note> & { title: string }): Promise<Note> {
    return repositories.notes.create({
      notebookId: repositories.defaultNotebookId,
      type: 'text',
      ...overrides,
    });
  }

  it('prompts rather than listing everything until something is typed', () => {
    expect(host().querySelector('app-empty-state')?.textContent).toContain('Search your notes');
    expect(host().querySelector('app-note-list')).toBeNull();
  });

  // An empty query would be `LIKE '%%'`, which matches every note.
  it('does not read the collection for a blank query', async () => {
    const list = vi.spyOn(repositories.notes, 'list');

    await type('   ');

    expect(list.mock.calls.map(([view]) => view.kind)).not.toContain('search');
    expect(host().querySelector('app-empty-state')?.textContent).toContain('Search your notes');
  });

  it('lists the matches and marks the query in them', async () => {
    await create({ title: 'Einkaufsliste' });
    await create({ title: 'Urlaub' });

    await type('kauf');

    expect(titles()).toEqual(['Einkaufsliste']);
    expect(host().querySelector('.note-card__title mark')?.textContent).toBe('kauf');
  });

  it('distinguishes no matches from nothing typed', async () => {
    await create({ title: 'Einkaufsliste' });

    await type('zzz');

    expect(host().querySelector('app-empty-state')?.textContent).toContain('No matches');
  });

  it('searches active and archived notes together, and not the trash', async () => {
    await create({ title: 'kauf active' });
    const archived = await create({ title: 'kauf archived' });
    await repositories.notes.update(archived.id, { archived: true });
    const trashed = await create({ title: 'kauf trashed' });
    await repositories.notes.trash(trashed.id);

    await type('kauf');

    expect(titles()).toEqual(['kauf active', 'kauf archived']);
  });

  it('reaches the trash only through its own chip', async () => {
    const trashed = await create({ title: 'kauf trashed' });
    await repositories.notes.trash(trashed.id);

    await type('kauf');
    expect(titles()).toEqual([]);

    await chip('Trash');
    expect(titles()).toEqual(['kauf trashed']);
  });

  it('offers a notebook chip only when the search was opened from one', async () => {
    function labels(): string[] {
      return [...host().querySelectorAll('.scopes__chip')].map(
        (element) => element.textContent?.trim() ?? '',
      );
    }

    expect(labels()).toEqual(['All', 'Archive', 'Trash']);

    fixture.componentRef.setInput('notebookId', repositories.defaultNotebookId);
    fixture.detectChanges();

    expect(labels()).toEqual(['All', 'This notebook', 'Archive', 'Trash']);
  });

  it('narrows to the notebook the search was opened from', async () => {
    const other = await repositories.notebooks.create('Work');
    await create({ title: 'kauf here' });
    await create({ title: 'kauf there', notebookId: other.id });

    fixture.componentRef.setInput('notebookId', other.id);
    fixture.detectChanges();
    await type('kauf');
    // Both notes were written in the same millisecond, so only the membership is
    // meaningful here; `note-sort.spec.ts` owns the ordering.
    expect([...titles()].sort()).toEqual(['kauf here', 'kauf there']);

    await chip('This notebook');
    expect(titles()).toEqual(['kauf there']);
  });

  it('narrows to the label the search was opened from', async () => {
    const work = await TestBed.inject(LabelsStore).create('Work');
    const tagged = await create({ title: 'kauf tagged' });
    await repositories.notes.update(tagged.id, { labels: [work.id] });
    await create({ title: 'kauf untagged' });

    fixture.componentRef.setInput('labelId', work.id);
    fixture.detectChanges();
    await type('kauf');
    await chip('This label');

    expect(titles()).toEqual(['kauf tagged']);
  });

  it('matches German text in either case', async () => {
    await create({ title: 'MÜLLER' });
    await create({ title: 'Straße' });

    await type('müller');
    expect(titles()).toEqual(['MÜLLER']);

    await type('STRASSE');
    expect(titles()).toEqual([]);

    await type('straße');
    expect(titles()).toEqual(['Straße']);
  });
});
