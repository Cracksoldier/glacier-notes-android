import { describe, expect, it } from 'vitest';

import type { Note } from '../../core/models/note';
import { noteShareText } from './note-share';

const NOTEBOOK_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3310';
const IMAGE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'a4f1c2d8-0000-4000-8000-000000000001',
    notebookId: NOTEBOOK_ID,
    type: 'text',
    title: '',
    content: '',
    imageIds: [],
    pinned: false,
    archived: false,
    labels: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('noteShareText', () => {
  it('puts the title above the body with a blank line between', () => {
    expect(noteShareText(note({ title: 'Groceries', content: 'milk' }))).toEqual({
      title: 'Groceries',
      text: 'Groceries\n\nmilk',
    });
  });

  it('shares whichever half exists on its own', () => {
    expect(noteShareText(note({ title: 'Only a title' })).text).toBe('Only a title');
    expect(noteShareText(note({ content: 'Only a body' })).text).toBe('Only a body');
    expect(noteShareText(note()).text).toBe('');
  });

  /**
   * `glacier-img://` resolves to a file only this app can read, so a shared copy
   * of one is a dead link wherever it lands.
   */
  it('removes the whole image reference, not just its URL', () => {
    const shared = noteShareText(
      note({ content: `before\n\n![a shot](glacier-img://${IMAGE_ID})\n\nafter` }),
    );

    expect(shared.text).toBe('before\n\nafter');
    expect(shared.text).not.toContain('glacier-img');
    expect(shared.text).not.toContain('![');
  });

  it('leaves an ordinary Markdown link alone', () => {
    const content =
      'see [the docs](https://example.com/a.png) and ![web](https://example.com/b.png)';

    expect(noteShareText(note({ content })).text).toBe(content);
  });

  it('renders a checklist as task list lines in both states', () => {
    const shared = noteShareText(
      note({
        type: 'checklist',
        title: 'Trip',
        checklist: [
          { id: 'i1', text: 'passport', checked: true, sortOrder: 0 },
          { id: 'i2', text: 'tickets', checked: false, sortOrder: 1 },
        ],
      }),
    );

    expect(shared.text).toBe('Trip\n\n- [x] passport\n- [ ] tickets');
  });

  /**
   * Canonical order, never `displayOrder`: the completed-item grouping is
   * display state that `docs/checklists.md` says must not leave the editor.
   */
  it('shares checklist items in their stored order rather than grouped', () => {
    const shared = noteShareText(
      note({
        type: 'checklist',
        checklist: [
          { id: 'i1', text: 'done first', checked: true, sortOrder: 0 },
          { id: 'i2', text: 'still open', checked: false, sortOrder: 1 },
          { id: 'i3', text: 'done last', checked: true, sortOrder: 2 },
        ],
      }),
    );

    expect(shared.text).toBe('- [x] done first\n- [ ] still open\n- [x] done last');
  });

  /** A checklist note carries no `content`, so the body must not come from it. */
  it('ignores stale Markdown behind a checklist', () => {
    const shared = noteShareText(
      note({
        type: 'checklist',
        content: 'text from before the conversion',
        checklist: [{ id: 'i1', text: 'milk', checked: false, sortOrder: 0 }],
      }),
    );

    expect(shared.text).toBe('- [ ] milk');
  });

  it('trims the title so a whitespace-only one is not shared as a heading', () => {
    expect(noteShareText(note({ title: '   ', content: 'body' }))).toEqual({
      title: '',
      text: 'body',
    });
  });
});
