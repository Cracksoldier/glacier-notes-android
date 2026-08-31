import { describe, expect, it } from 'vitest';

import type { Note } from '../models/note';
import {
  assembleNotes,
  imageAssetFromRow,
  noteFromRow,
  noteToRow,
  notebookFromRow,
  notebookToRow,
} from './row-mapper';
import type { ChecklistItemRow, NoteImageRow, NoteLabelRow, NoteRow, NotebookRow } from './rows';

const NOTE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_NOTE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302';
const NOTEBOOK_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3310';

function noteRow(overrides: Partial<NoteRow> = {}): NoteRow {
  return {
    id: NOTE_ID,
    notebook_id: NOTEBOOK_ID,
    type: 'text',
    title: 'Title',
    content: 'Body',
    color: null,
    pinned: 0,
    archived: 0,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    search_text: 'title\nbody',
    ...overrides,
  };
}

const NO_JOINS = { checklist: [], imageIds: [], labels: [] };

describe('the absent-key contract', () => {
  it('omits deletedAt entirely for an active note', () => {
    const note = noteFromRow(noteRow(), NO_JOINS);

    // `toBeUndefined()` would pass even if the key were present — it must not be.
    expect('deletedAt' in note).toBe(false);
    expect(Object.keys(note)).not.toContain('deletedAt');
  });

  it('omits color when the column is NULL', () => {
    expect('color' in noteFromRow(noteRow(), NO_JOINS)).toBe(false);
  });

  it('omits checklist for a text note even when checklist rows were joined', () => {
    const note = noteFromRow(noteRow({ type: 'text' }), {
      ...NO_JOINS,
      checklist: [{ id: NOTE_ID, text: 'stray', checked: false, sortOrder: 0 }],
    });

    expect('checklist' in note).toBe(false);
  });

  it('includes an empty checklist array for a checklist note with no items', () => {
    const note = noteFromRow(noteRow({ type: 'checklist' }), NO_JOINS);

    expect(note.checklist).toEqual([]);
  });

  it('survives JSON round-tripping without gaining null keys', () => {
    const note = noteFromRow(noteRow(), NO_JOINS);
    const parsed = JSON.parse(JSON.stringify(note)) as Note;

    expect('deletedAt' in parsed).toBe(false);
    expect('color' in parsed).toBe(false);
  });

  it('omits notebook color and image fileName the same way', () => {
    const notebook = notebookFromRow({
      id: NOTEBOOK_ID,
      name: 'Notes',
      color: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    const image = imageAssetFromRow({ id: NOTE_ID, mime_type: 'image/png', file_name: null });

    expect('color' in notebook).toBe(false);
    expect('fileName' in image).toBe(false);
  });
});

describe('key order', () => {
  it('matches the desktop Note declaration order when every optional is present', () => {
    const note = noteFromRow(
      noteRow({ type: 'checklist', color: 'teal', deleted_at: '2026-02-01T00:00:00.000Z' }),
      NO_JOINS,
    );

    expect(Object.keys(note)).toEqual([
      'id',
      'notebookId',
      'type',
      'title',
      'content',
      'checklist',
      'imageIds',
      'pinned',
      'archived',
      'color',
      'labels',
      'deletedAt',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('keeps the surviving keys in the same relative order when optionals are absent', () => {
    const keys = Object.keys(noteFromRow(noteRow(), NO_JOINS));

    expect(keys).toEqual([
      'id',
      'notebookId',
      'type',
      'title',
      'content',
      'imageIds',
      'pinned',
      'archived',
      'labels',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('matches the desktop Notebook declaration order', () => {
    const notebook = notebookFromRow({
      id: NOTEBOOK_ID,
      name: 'Notes',
      color: 'blue',
      sort_order: 3,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    expect(Object.keys(notebook)).toEqual([
      'id',
      'name',
      'color',
      'createdAt',
      'updatedAt',
      'sortOrder',
    ]);
  });
});

describe('round-tripping', () => {
  it('preserves every authored column through domain and back', () => {
    const original = noteRow({
      type: 'checklist',
      color: 'teal',
      pinned: 1,
      archived: 1,
      deleted_at: '2026-02-01T00:00:00.000Z',
    });
    const { search_text, ...authored } = original;

    expect(noteToRow(noteFromRow(original, NO_JOINS))).toEqual(authored);
  });

  it('drops search_text rather than leaking the derived column into the domain', () => {
    const note = noteFromRow(noteRow({ search_text: 'derived' }), NO_JOINS);

    expect('search_text' in note).toBe(false);
    expect('searchText' in note).toBe(false);
    expect(Object.values(note)).not.toContain('derived');
  });

  it('maps 0/1 back to booleans rather than truthy numbers', () => {
    const note = noteFromRow(noteRow({ pinned: 1, archived: 0 }), NO_JOINS);

    expect(note.pinned).toBe(true);
    expect(note.archived).toBe(false);
  });

  it('preserves a notebook through domain and back', () => {
    const original: NotebookRow = {
      id: NOTEBOOK_ID,
      name: 'Notes',
      color: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    expect(notebookToRow(notebookFromRow(original))).toEqual(original);
  });
});

describe('assembleNotes', () => {
  const checklistRows: ChecklistItemRow[] = [
    { id: 'a', note_id: NOTE_ID, text: 'first', checked: 0, sort_order: 0 },
    { id: 'b', note_id: NOTE_ID, text: 'second', checked: 1, sort_order: 1 },
  ];
  const imageRows: NoteImageRow[] = [
    { note_id: NOTE_ID, image_id: 'img-1', sort_order: 0 },
    { note_id: NOTE_ID, image_id: 'img-2', sort_order: 1 },
    { note_id: OTHER_NOTE_ID, image_id: 'img-3', sort_order: 0 },
  ];
  const labelRows: NoteLabelRow[] = [{ note_id: OTHER_NOTE_ID, label_id: 'label-1' }];

  it('attaches each joined row to the right note', () => {
    const [first, second] = assembleNotes(
      [noteRow({ type: 'checklist' }), noteRow({ id: OTHER_NOTE_ID })],
      checklistRows,
      imageRows,
      labelRows,
    );

    expect(first?.checklist?.map((item) => item.text)).toEqual(['first', 'second']);
    expect(first?.imageIds).toEqual(['img-1', 'img-2']);
    expect(first?.labels).toEqual([]);
    expect(second?.imageIds).toEqual(['img-3']);
    expect(second?.labels).toEqual(['label-1']);
  });

  it('preserves the order it is given rather than re-sorting', () => {
    const reversed: ChecklistItemRow[] = [...checklistRows].reverse();
    const [note] = assembleNotes([noteRow({ type: 'checklist' })], reversed, [], []);

    expect(note?.checklist?.map((item) => item.text)).toEqual(['second', 'first']);
  });

  it('returns notes in the order the note rows arrived', () => {
    const notes = assembleNotes([noteRow({ id: OTHER_NOTE_ID }), noteRow()], [], [], []);

    expect(notes.map((note) => note.id)).toEqual([OTHER_NOTE_ID, NOTE_ID]);
  });

  it('handles a note with no joined rows at all', () => {
    const [note] = assembleNotes([noteRow()], [], [], []);

    expect(note?.imageIds).toEqual([]);
    expect(note?.labels).toEqual([]);
  });
});
