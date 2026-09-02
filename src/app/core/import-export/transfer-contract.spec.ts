import { describe, expect, it, vi } from 'vitest';

import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';
import { collectExport, type ExportSource } from './transfer-contract';

/**
 * Ported from the desktop's `src/app/features/transfer/transfer-core.spec.ts`,
 * which is the only executable statement of what the wire format means. The
 * cases for `detectConflicts`, `remapAsCopies` and `envelopeCounts` are left
 * there until M13 ports those functions.
 *
 * The ids are the desktop's short strings rather than UUIDs on purpose:
 * `collectExport` does no validation, so using real ids here would hide the
 * fact that it does none. `envelope-validation.spec.ts` is where ids matter.
 */

const IMG_A = '11111111-1111-4111-8111-111111111111';
const IMG_B = '22222222-2222-4222-8222-222222222222';

const now = '2026-07-19T00:00:00.000Z';

const notebook = (id: string, name = id): Notebook => ({
  id,
  name,
  createdAt: now,
  updatedAt: now,
  sortOrder: 0,
});

const note = (id: string, notebookId: string, patch: Partial<Note> = {}): Note => ({
  id,
  notebookId,
  type: 'text',
  title: `title-${id}`,
  content: '',
  imageIds: [],
  pinned: false,
  archived: false,
  labels: [],
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const label = (id: string, name = id): Label => ({ id, name });

const source = (overrides: Partial<ExportSource> = {}): ExportSource => ({
  notebooks: [notebook('nb1'), notebook('nb2')],
  notes: [],
  labels: [],
  defaultNotebookId: 'nb1',
  readImage: (id) => ({ mimeType: 'image/png', base64: `data-${id}` }),
  ...overrides,
});

describe('collectExport', () => {
  it('exports everything for scope "all"', () => {
    const envelope = collectExport(
      { kind: 'all' },
      source({ notes: [note('n1', 'nb1'), note('n2', 'nb2')], labels: [label('l1')] }),
    );

    expect(envelope.format).toBe('glacier-notes-export');
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.notebooks.map((value) => value.id)).toEqual(['nb1', 'nb2']);
    expect(envelope.notes.map((value) => value.id)).toEqual(['n1', 'n2']);
    expect(envelope.labels.map((value) => value.id)).toEqual(['l1']);
  });

  it("keeps a notebook scope's archived and trashed notes but only its referenced labels", () => {
    const envelope = collectExport(
      { kind: 'notebook', notebookId: 'nb1' },
      source({
        notes: [
          note('n1', 'nb1', { labels: ['l1'] }),
          note('n2', 'nb1', { archived: true }),
          note('n3', 'nb1', { deletedAt: now }),
          note('n4', 'nb2', { labels: ['l2'] }),
        ],
        labels: [label('l1'), label('l2')],
      }),
    );

    expect(envelope.notebooks.map((value) => value.id)).toEqual(['nb1']);
    expect(envelope.notes.map((value) => value.id)).toEqual(['n1', 'n2', 'n3']);
    expect(envelope.notes.find((value) => value.id === 'n3')?.deletedAt).toBe(now);
    expect(envelope.labels.map((value) => value.id)).toEqual(['l1']);
  });

  it('exports a single note with only its dependencies', () => {
    const envelope = collectExport(
      { kind: 'note', noteId: 'n1' },
      source({
        notes: [note('n1', 'nb1', { labels: ['l1'], imageIds: [IMG_A] }), note('n2', 'nb1')],
        labels: [label('l1'), label('l2')],
        readImage: () => ({ mimeType: 'image/png', fileName: 'image.png', base64: 'AQID' }),
      }),
    );

    expect(envelope.notes.map((value) => value.id)).toEqual(['n1']);
    expect(envelope.notebooks.map((value) => value.id)).toEqual(['nb1']);
    expect(envelope.labels.map((value) => value.id)).toEqual(['l1']);
    expect(envelope.images[0]?.fileName).toBe('image.png');
  });

  it('collects each referenced image once and skips unresolvable ids', () => {
    const envelope = collectExport(
      { kind: 'all' },
      source({
        notes: [
          note('n1', 'nb1', { imageIds: [IMG_A], content: `![x](glacier-img://${IMG_B})` }),
          note('n2', 'nb1', { imageIds: [IMG_A] }),
        ],
        readImage: (id) => (id === IMG_B ? null : { mimeType: 'image/png', base64: 'AA==' }),
      }),
    );

    expect(envelope.images.map((value) => value.id)).toEqual([IMG_A]);
  });

  it('collects images from the notes rather than from the image table', () => {
    const readImage = vi.fn(() => ({ mimeType: 'image/png', base64: 'AA==' }));
    const envelope = collectExport(
      { kind: 'note', noteId: 'n1' },
      source({
        notes: [note('n1', 'nb1'), note('n2', 'nb1', { imageIds: [IMG_A] })],
        readImage,
      }),
    );

    // n2's image is not in scope, so it is never even read.
    expect(envelope.images).toEqual([]);
    expect(readImage).not.toHaveBeenCalled();
  });

  it('always writes the scope and adds defaultNotebookId only for "all"', () => {
    const all = collectExport({ kind: 'all' }, source());
    expect(all.scope).toEqual({ kind: 'all' });
    expect(all.defaultNotebookId).toBe('nb1');

    const single = collectExport({ kind: 'note', noteId: 'n1' }, source());
    expect(single.scope).toEqual({ kind: 'note', noteId: 'n1' });
    expect('defaultNotebookId' in single).toBe(false);
  });

  it('copies the entities rather than aliasing the source', () => {
    const original = note('n1', 'nb1');
    const envelope = collectExport({ kind: 'all' }, source({ notes: [original] }));

    expect(envelope.notes[0]).not.toBe(original);
    expect(envelope.notes[0]).toEqual(original);
  });
});
