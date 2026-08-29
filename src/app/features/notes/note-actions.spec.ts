import { describe, expect, it } from 'vitest';

import type { Note } from '../../core/models/note';
import { noteActionChoices, noteActionFor } from './note-actions';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    notebookId: 'nb1',
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

describe('note actions', () => {
  it('offers pin, colour, labels, archive and trash on an active note', () => {
    const actions = noteActionChoices(note(), 'active').map((choice) => choice.action);

    expect(actions).toEqual(['pin', 'color', 'labels', 'archive', 'trash']);
  });

  it('flips pin and archive to their inverses when the note is already in that state', () => {
    const actions = noteActionChoices(note({ pinned: true, archived: true }), 'archived').map(
      (choice) => choice.action,
    );

    expect(actions).toEqual(['unpin', 'color', 'labels', 'unarchive', 'trash']);
  });

  /**
   * Not merely a shorter menu: NotesStore sorts with the active ordering, so a
   * pin or colour applied from the trash view would re-sort that list by the
   * wrong key. The action does not exist, so the case cannot arise.
   */
  it('offers only restore and delete-forever in the trash', () => {
    const actions = noteActionChoices(note({ pinned: true }), 'trashed').map(
      (choice) => choice.action,
    );

    expect(actions).toEqual(['restore', 'deleteForever']);
  });

  it('marks the irreversible actions destructive', () => {
    const trashed = noteActionChoices(note(), 'trashed');
    const active = noteActionChoices(note(), 'active');

    expect(trashed.find((c) => c.action === 'deleteForever')?.destructive).toBe(true);
    expect(active.find((c) => c.action === 'trash')?.destructive).toBe(true);
    expect(active.find((c) => c.action === 'color')?.destructive).toBeUndefined();
  });

  // A dismissed sheet hands back a role like 'cancel' or undefined.
  it('resolves nothing for a value that is not an offered action', () => {
    const choices = noteActionChoices(note(), 'active');

    expect(noteActionFor(choices, 'restore')).toBeUndefined();
    expect(noteActionFor(choices, 'cancel')).toBeUndefined();
    expect(noteActionFor(choices, undefined)).toBeUndefined();
    expect(noteActionFor(choices, 'archive')).toBe('archive');
  });
});
