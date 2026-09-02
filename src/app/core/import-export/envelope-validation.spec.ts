import { describe, expect, it } from 'vitest';

import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';
import { validateEnvelope } from './envelope-validation';
import { collectExport, type ExportEnvelope } from './transfer-contract';

/**
 * Ported from the desktop's `transfer-core.spec.ts`, plus the two Android cases
 * that justify `ExportService` refusing to write when an image is unreadable.
 *
 * Every fixture is built by `collectExport` and round-tripped through JSON,
 * because that is the only path a real file takes: anything the validator
 * rejects on a hand-written object but accepts on a real one would be a test
 * that proves nothing about interoperability.
 */

const IMG_A = '11111111-1111-4111-8111-111111111111';
const NB_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const NB_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const NOTE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const NOTE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const LABEL_A = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const ITEM_A = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const ABSENT = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

const now = '2026-07-19T00:00:00.000Z';

const notebook = (id: string): Notebook => ({
  id,
  name: `notebook-${id}`,
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

const label = (id: string): Label => ({ id, name: `label-${id}` });

function valid(): ExportEnvelope {
  return collectExport(
    { kind: 'all' },
    {
      notebooks: [notebook(NB_A), notebook(NB_B)],
      defaultNotebookId: NB_A,
      notes: [
        note(NOTE_A, NB_A, { imageIds: [IMG_A], labels: [LABEL_A] }),
        note(NOTE_B, NB_A, {
          type: 'checklist',
          checklist: [{ id: ITEM_A, text: 'a', checked: true, sortOrder: 0 }],
        }),
      ],
      labels: [label(LABEL_A)],
      readImage: () => ({ mimeType: 'image/png', base64: 'AAAA' }),
    },
  );
}

/** What the validator will really be handed: a parsed file, not a live object. */
function roundTrip(envelope: unknown): unknown {
  return JSON.parse(JSON.stringify(envelope));
}

function errorsOf(raw: unknown): string {
  const result = validateEnvelope(raw);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.errors.join(' | ');
}

describe('validateEnvelope', () => {
  it('accepts a round-tripped envelope that collectExport produced', () => {
    const result = validateEnvelope(roundTrip(valid()));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.notes).toHaveLength(2);
    expect(result.envelope.notes[1]?.checklist).toHaveLength(1);
    expect(result.envelope.images).toHaveLength(1);
    expect(result.envelope.defaultNotebookId).toBe(NB_A);
  });

  it('rejects anything that is not a JSON object', () => {
    expect(validateEnvelope(null).ok).toBe(false);
    expect(validateEnvelope('{}').ok).toBe(false);
    expect(validateEnvelope([valid()]).ok).toBe(false);
  });

  it('rejects an unknown format', () => {
    expect(errorsOf({ ...valid(), format: 'something-else' })).toContain('format');
  });

  it('rejects a newer schemaVersion', () => {
    expect(errorsOf({ ...valid(), schemaVersion: 999 })).toContain('schemaVersion');
  });

  it('rejects an invalid exportedAt', () => {
    expect(errorsOf({ ...valid(), exportedAt: 'yesterday' })).toContain('exportedAt');
  });

  it('rejects missing arrays', () => {
    const { notes: _notes, ...rest } = valid();
    expect(errorsOf(rest)).toContain('notes');
  });

  it('rejects unsupported image mime types and invalid base64', () => {
    const envelope = valid();
    expect(
      errorsOf({ ...envelope, images: [{ id: IMG_A, mimeType: 'image/svg+xml', base64: 'AAAA' }] }),
    ).toContain('mimeType');
    expect(
      errorsOf({
        ...envelope,
        images: [{ id: IMG_A, mimeType: 'image/png', base64: 'not base64!' }],
      }),
    ).toContain('base64');
  });

  it('rejects a note with an invalid type', () => {
    const envelope = roundTrip(valid()) as { notes: { type: string }[] };
    envelope.notes[0]!.type = 'audio';
    expect(errorsOf(envelope)).toContain('invalid type');
  });

  it('rejects a checklist note carrying no checklist', () => {
    const envelope = roundTrip(valid()) as { notes: { checklist?: unknown }[] };
    delete envelope.notes[1]!.checklist;
    expect(errorsOf(envelope)).toContain('missing checklist');
  });

  it('accepts legacy v1 envelopes without scope metadata', () => {
    const { scope: _scope, defaultNotebookId: _default, ...legacy } = valid();
    expect(validateEnvelope(roundTrip(legacy)).ok).toBe(true);
  });

  it('rejects traversal ids', () => {
    const envelope = roundTrip(valid()) as { notes: { id: string }[] };
    envelope.notes[0]!.id = '../../escape';
    expect(errorsOf(envelope)).toContain('invalid id');
  });

  it('rejects duplicate ids', () => {
    const envelope = roundTrip(valid()) as { notes: unknown[] };
    envelope.notes.push(structuredClone(envelope.notes[0]));
    expect(errorsOf(envelope)).toContain('duplicate id');
  });

  it('rejects a note pointing at a label that is not in the file', () => {
    const envelope = roundTrip(valid()) as { notes: { labels: string[] }[] };
    envelope.notes[0]!.labels = [ABSENT];
    expect(errorsOf(envelope)).toContain(`missing label ${ABSENT}`);
  });

  it('rejects a note pointing at a notebook that is not in the file', () => {
    const envelope = roundTrip(valid()) as { notes: { notebookId: string }[] };
    envelope.notes[0]!.notebookId = ABSENT;
    expect(errorsOf(envelope)).toContain(`missing notebook ${ABSENT}`);
  });

  it('rejects missing fields instead of silently repairing them', () => {
    const envelope = roundTrip(valid()) as { notes: { title?: string }[] };
    delete envelope.notes[0]!.title;
    expect(errorsOf(envelope)).toContain('invalid structure');
  });

  it('rejects a scope naming an entity the file does not carry', () => {
    expect(errorsOf({ ...valid(), scope: { kind: 'notebook', notebookId: ABSENT } })).toContain(
      'missing notebook',
    );
    expect(errorsOf({ ...valid(), scope: { kind: 'note', noteId: ABSENT } })).toContain(
      'missing note',
    );
  });

  it('rejects a defaultNotebookId that names no exported notebook', () => {
    expect(errorsOf({ ...valid(), defaultNotebookId: ABSENT })).toContain('defaultNotebookId');
  });

  /**
   * The case that decides `ExportService`'s one deviation from the desktop. The
   * desktop drops an unreadable image and writes the file anyway; this is what
   * the resulting file does when its own validator sees it, on either app.
   */
  it('rejects an envelope whose note references an image the file omits', () => {
    const envelope = roundTrip(valid()) as { images: unknown[] };
    envelope.images = [];
    expect(errorsOf(envelope)).toContain(`missing image ${IMG_A}`);
  });

  it('rejects an image referenced only from the Markdown body but not exported', () => {
    const envelope = collectExport(
      { kind: 'all' },
      {
        notebooks: [notebook(NB_A)],
        defaultNotebookId: NB_A,
        notes: [note(NOTE_A, NB_A, { content: `![x](glacier-img://${IMG_A})` })],
        labels: [],
        readImage: () => null,
      },
    );

    expect(envelope.images).toEqual([]);
    expect(errorsOf(roundTrip(envelope))).toContain(`missing image ${IMG_A}`);
  });
});
