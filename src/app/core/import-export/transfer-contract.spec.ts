import { describe, expect, it, vi } from 'vitest';

import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';
import {
  collectExport,
  detectConflicts,
  envelopeCounts,
  type ExistingIds,
  type ExportEnvelope,
  type ExportSource,
  remapAsCopies,
} from './transfer-contract';

/**
 * Ported from the desktop's `src/app/features/transfer/transfer-core.spec.ts`,
 * which is the only executable statement of what the wire format means.
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

const envelope = (overrides: Partial<ExportEnvelope> = {}): ExportEnvelope => ({
  format: 'glacier-notes-export',
  schemaVersion: 1,
  exportedAt: now,
  notebooks: [notebook('nb1')],
  notes: [note('n1', 'nb1')],
  labels: [],
  images: [],
  scope: { kind: 'all' },
  defaultNotebookId: 'nb1',
  ...overrides,
});

const existing = (overrides: Partial<Record<keyof ExistingIds, string[]>> = {}): ExistingIds => ({
  notebookIds: new Set(overrides.notebookIds ?? []),
  noteIds: new Set(overrides.noteIds ?? []),
  labelIds: new Set(overrides.labelIds ?? []),
  imageIds: new Set(overrides.imageIds ?? []),
});

describe('detectConflicts', () => {
  it('is false when nothing in the envelope is already stored', () => {
    expect(detectConflicts(envelope(), existing({ noteIds: ['other'] }))).toBe(false);
  });

  it('is true for a shared id of any kind', () => {
    const full = envelope({
      labels: [label('l1')],
      images: [{ id: IMG_A, mimeType: 'image/png', base64: 'AA==' }],
    });

    expect(detectConflicts(full, existing({ notebookIds: ['nb1'] }))).toBe(true);
    expect(detectConflicts(full, existing({ noteIds: ['n1'] }))).toBe(true);
    expect(detectConflicts(full, existing({ labelIds: ['l1'] }))).toBe(true);
    expect(detectConflicts(full, existing({ imageIds: [IMG_A] }))).toBe(true);
  });
});

describe('remapAsCopies', () => {
  const original = envelope({
    notebooks: [notebook('nb1')],
    labels: [label('l1')],
    images: [{ id: IMG_A, mimeType: 'image/png', base64: 'AA==' }],
    notes: [
      note('n1', 'nb1', {
        labels: ['l1'],
        imageIds: [IMG_A],
        content: `See ![p](glacier-img://${IMG_A}) above.`,
        checklist: [{ id: 'c1', text: 'Item', checked: false, sortOrder: 0 }],
      }),
    ],
  });

  it('mints a fresh id for every entity, checklist items included', () => {
    const copy = remapAsCopies(original);

    expect(copy.notebooks[0].id).not.toBe('nb1');
    expect(copy.labels[0].id).not.toBe('l1');
    expect(copy.images[0].id).not.toBe(IMG_A);
    expect(copy.notes[0].id).not.toBe('n1');
    expect(copy.notes[0].checklist?.[0].id).not.toBe('c1');
  });

  it('repoints every cross-reference at the fresh ids', () => {
    const copy = remapAsCopies(original);
    const copied = copy.notes[0];

    expect(copied.notebookId).toBe(copy.notebooks[0].id);
    expect(copied.labels).toEqual([copy.labels[0].id]);
    expect(copied.imageIds).toEqual([copy.images[0].id]);
  });

  /**
   * A plain substring replace over the whole body, as the desktop does it —
   * porting it faithfully is what makes both apps produce the same copy.
   */
  it('rewrites the image reference inside the note body', () => {
    const copy = remapAsCopies(original);

    expect(copy.notes[0].content).toBe(`See ![p](glacier-img://${copy.images[0].id}) above.`);
    expect(copy.notes[0].content).not.toContain(IMG_A);
  });

  it('keeps everything that is not an id, and leaves the original alone', () => {
    const copy = remapAsCopies(original);

    expect(copy.notes[0]).toMatchObject({
      title: 'title-n1',
      createdAt: now,
      updatedAt: now,
    });
    expect(copy.exportedAt).toBe(now);
    expect(copy.scope).toEqual({ kind: 'all' });
    expect(original.notes[0].id).toBe('n1');
    expect(original.notes[0].content).toContain(IMG_A);
    expect(original.notes[0].checklist?.[0].id).toBe('c1');
  });

  it('gives two copies of one file different ids', () => {
    expect(remapAsCopies(original).notes[0].id).not.toBe(remapAsCopies(original).notes[0].id);
  });
});

describe('envelopeCounts', () => {
  it('counts each array', () => {
    expect(
      envelopeCounts(
        envelope({
          notebooks: [notebook('nb1'), notebook('nb2')],
          labels: [label('l1')],
          images: [{ id: IMG_A, mimeType: 'image/png', base64: 'AA==' }],
        }),
      ),
    ).toEqual({ notebooks: 2, notes: 1, labels: 1, images: 1 });
  });
});
