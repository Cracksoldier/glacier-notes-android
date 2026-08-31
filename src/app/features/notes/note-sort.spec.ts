import { describe, expect, it } from 'vitest';

import type { Note } from '../../core/models/note';
import type { NoteSortOrder } from '../../core/preferences/settings.model';
import type { NoteView } from '../../core/repositories/note-queries';
import { sortNotes } from './note-sort';

const NOTEBOOK_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3310';

function note(overrides: Partial<Note> & { id: string }): Note {
  return {
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

function titles(notes: readonly Note[], view: NoteView, order: NoteSortOrder): string[] {
  return sortNotes(notes, view, order).map((entry) => entry.title);
}

const ACTIVE: NoteView = { kind: 'active' };

describe('display order', () => {
  it('sorts by last edit under the default order', () => {
    const notes = [
      note({ id: 'a', title: 'old', updatedAt: '2026-01-01T00:00:00.000Z' }),
      note({ id: 'b', title: 'new', updatedAt: '2026-03-01T00:00:00.000Z' }),
    ];

    expect(titles(notes, ACTIVE, 'updatedDesc')).toEqual(['new', 'old']);
  });

  it('sorts by creation independently of the last edit', () => {
    const notes = [
      note({
        id: 'a',
        title: 'created-first',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      }),
      note({
        id: 'b',
        title: 'created-second',
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      }),
    ];

    expect(titles(notes, ACTIVE, 'createdDesc')).toEqual(['created-second', 'created-first']);
    expect(titles(notes, ACTIVE, 'updatedDesc')).toEqual(['created-first', 'created-second']);
  });

  // The reason this ordering cannot be SQL: SQLite's default collation compares
  // bytes and would put `Zebra` before `Äpfel`.
  it('collates umlauts beside their base letter, not after Z', () => {
    const notes = [
      note({ id: 'a', title: 'Zebra' }),
      note({ id: 'b', title: 'Äpfel' }),
      note({ id: 'c', title: 'Apfel' }),
    ];

    expect(titles(notes, ACTIVE, 'titleAsc')).toEqual(['Apfel', 'Äpfel', 'Zebra']);
  });

  it('keeps pinned notes a group above the rest under every order', () => {
    const notes = [
      note({ id: 'a', title: 'Zebra unpinned', updatedAt: '2026-09-01T00:00:00.000Z' }),
      note({ id: 'b', title: 'Apfel pinned', pinned: true, updatedAt: '2026-01-01T00:00:00.000Z' }),
    ];

    for (const order of ['updatedDesc', 'createdDesc', 'titleAsc'] as const) {
      expect(titles(notes, ACTIVE, order)[0]).toBe('Apfel pinned');
    }
  });

  it('breaks a tie on id, so two identical notes never swap between renders', () => {
    const notes = [note({ id: 'a', title: 'same' }), note({ id: 'b', title: 'same' })];

    expect(sortNotes(notes, ACTIVE, 'titleAsc').map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(sortNotes([...notes].reverse(), ACTIVE, 'titleAsc').map((entry) => entry.id)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('orders a view imposes on top of the setting', () => {
  it('holds archived notes in a block below the active ones in the all scope', () => {
    const view: NoteView = { kind: 'search', query: 'x', scope: { kind: 'all' } };
    const notes = [
      note({ id: 'a', title: 'Apfel archived', archived: true }),
      note({ id: 'b', title: 'Zebra active' }),
    ];

    expect(titles(notes, view, 'titleAsc')).toEqual(['Zebra active', 'Apfel archived']);
  });

  it('does not impose that block on a plain active view', () => {
    const notes = [
      note({ id: 'a', title: 'Apfel' }),
      note({ id: 'b', title: 'Zebra', archived: true }),
    ];

    expect(titles(notes, ACTIVE, 'titleAsc')).toEqual(['Apfel', 'Zebra']);
  });

  it('ignores the setting entirely in the trash', () => {
    const view: NoteView = { kind: 'trashed' };
    const notes = [
      note({ id: 'a', title: 'Apfel', deletedAt: '2026-01-01T00:00:00.000Z' }),
      note({ id: 'b', title: 'Zebra', deletedAt: '2026-03-01T00:00:00.000Z' }),
    ];

    expect(titles(notes, view, 'titleAsc')).toEqual(['Zebra', 'Apfel']);
    expect(titles(notes, view, 'createdDesc')).toEqual(['Zebra', 'Apfel']);
  });

  it('takes the order of the scope a search narrows', () => {
    const notes = [
      note({ id: 'a', title: 'Apfel', deletedAt: '2026-01-01T00:00:00.000Z' }),
      note({ id: 'b', title: 'Zebra', deletedAt: '2026-03-01T00:00:00.000Z' }),
    ];

    expect(
      titles(notes, { kind: 'search', query: 'x', scope: { kind: 'trashed' } }, 'titleAsc'),
    ).toEqual(['Zebra', 'Apfel']);
  });
});
