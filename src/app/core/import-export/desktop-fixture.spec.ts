import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { newId } from '../models/entity-id';
import { createTestRepositories, type TestRepositories } from '../repositories/testing';
import { validateEnvelope } from './envelope-validation';
import { ExportService } from './export.service';

/**
 * `fixtures/desktop-all-v1.glacier.json` was produced by the **desktop app's own**
 * `collectExport` over its own JSON stores, with the same `readImage` closure
 * `electron/export-import.ts` passes for `transfer:exportData` — only the save
 * dialog was replaced, as the desktop's smoke-mode `filePath` override does.
 * Desktop commit `e217a7a`. `docs/import-export.md` records how to regenerate it.
 *
 * It is the only artefact in this repository that was not written here, and the
 * only evidence that the port is a port. Two things are asserted against it:
 * this app accepts what the desktop writes, and this app's own output carries
 * the same keys in the same order.
 */

const fixture: unknown = JSON.parse(
  readFileSync('src/app/core/import-export/fixtures/desktop-all-v1.glacier.json', 'utf-8'),
);

/**
 * The declaration orders in `models/*.ts`, which is the order this app writes.
 *
 * The desktop does **not** guarantee the same order: its `NoteRepo.update` does
 * `{...note, ...patch}`, so an optional key set after creation — `color` on a
 * colouring, `deletedAt` on a trash — lands after `updatedAt` instead of in
 * declaration position. The fixture shows both. Key *order* is therefore not
 * part of the contract; the key *set* is, and that is what is asserted here.
 */
const ENVELOPE_KEYS = [
  'format',
  'schemaVersion',
  'exportedAt',
  'notebooks',
  'notes',
  'labels',
  'images',
  'scope',
  'defaultNotebookId',
];
const NOTEBOOK_KEYS = ['id', 'name', 'color', 'createdAt', 'updatedAt', 'sortOrder'];
const NOTE_KEYS = [
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
];
const CHECKLIST_KEYS = ['id', 'text', 'checked', 'sortOrder'];
const LABEL_KEYS = ['id', 'name'];
const IMAGE_KEYS = ['id', 'mimeType', 'fileName', 'base64'];

/** Optional fields are absent keys, so a real object carries a subset, not all. */
function expectKnownKeys(value: Record<string, unknown>, canonical: readonly string[]): void {
  expect(Object.keys(value).filter((key) => !canonical.includes(key))).toEqual([]);
}

function expectKnownKeysThroughout(envelope: Record<string, unknown>): void {
  expectKnownKeys(envelope, ENVELOPE_KEYS);
  for (const notebook of envelope['notebooks'] as Record<string, unknown>[]) {
    expectKnownKeys(notebook, NOTEBOOK_KEYS);
  }
  for (const note of envelope['notes'] as Record<string, unknown>[]) {
    expectKnownKeys(note, NOTE_KEYS);
    for (const item of (note['checklist'] as Record<string, unknown>[] | undefined) ?? []) {
      expectKnownKeys(item, CHECKLIST_KEYS);
    }
  }
  for (const label of envelope['labels'] as Record<string, unknown>[]) {
    expectKnownKeys(label, LABEL_KEYS);
  }
  for (const image of envelope['images'] as Record<string, unknown>[]) {
    expectKnownKeys(image, IMAGE_KEYS);
  }
}

/** What this app writes, which — unlike the desktop — is order-deterministic. */
function expectDeclarationOrder(
  value: Record<string, unknown>,
  canonical: readonly string[],
): void {
  expect(Object.keys(value)).toEqual(canonical.filter((key) => key in value));
}

/** The set of keys each entity kind actually used, which is what "same shape" means. */
function keyUnion(values: Record<string, unknown>[]): string[] {
  return [...new Set(values.flatMap((value) => Object.keys(value)))].sort();
}

describe('the desktop fixture', () => {
  it('validates as an envelope this app would accept', () => {
    const result = validateEnvelope(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope).toMatchObject({
      format: 'glacier-notes-export',
      schemaVersion: 1,
      scope: { kind: 'all' },
    });
    expect(result.envelope.notebooks).toHaveLength(2);
    expect(result.envelope.notes).toHaveLength(6);
    expect(result.envelope.labels).toHaveLength(1);
    expect(result.envelope.images).toHaveLength(1);
  });

  it('carries the note variants that make the fixture worth having', () => {
    const result = validateEnvelope(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const notes = result.envelope.notes;

    expect(notes.filter((note) => note.type === 'checklist')).toHaveLength(1);
    expect(notes.filter((note) => note.archived)).toHaveLength(1);
    expect(notes.filter((note) => note.deletedAt !== undefined)).toHaveLength(1);
    expect(notes.filter((note) => note.pinned && note.color === 'teal')).toHaveLength(1);
    expect(notes.filter((note) => note.labels.length > 0)).toHaveLength(1);
    expect(notes.filter((note) => note.content.includes('glacier-img://'))).toHaveLength(1);
  });

  it('carries no field this app does not know', () => {
    expectKnownKeysThroughout(fixture as Record<string, unknown>);
  });

  /**
   * Documenting the desktop behaviour that makes key order unusable as a
   * contract, so a future byte-comparison is not written against it by mistake.
   */
  it('appends an optional key set after creation, rather than in model order', () => {
    const notes = (fixture as { notes: Record<string, unknown>[] }).notes;
    const coloured = notes.find((note) => note['color'] !== undefined);
    const trashed = notes.find((note) => note['deletedAt'] !== undefined);

    expect(Object.keys(coloured ?? {}).at(-1)).toBe('color');
    expect(Object.keys(trashed ?? {}).at(-1)).toBe('deletedAt');
  });
});

describe('an Android export beside the desktop fixture', () => {
  let repos: TestRepositories;
  let android: Record<string, unknown>;

  /** The same collection the fixture was generated from, seeded through this app. */
  beforeEach(async () => {
    repos = await createTestRepositories();
    const travel = await repos.notebooks.create('Travel');
    const label = await repos.labels.create('Urgent');
    const imageId = newId();
    await repos.images.insert({ id: imageId, mimeType: 'image/png', fileName: 'pixel.png' });
    await repos.files.write(imageId, 'iVBORw0KGgo=', 'image/png');

    const plain = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Plain note',
      content: 'A paragraph with **bold** text.',
    });
    await repos.notes.setLabels(plain.id, [label.id]);

    await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Note with an image',
      content: `Before\n\n![pixel](glacier-img://${imageId})\n\nAfter`,
    });

    await repos.notes.create({
      notebookId: travel.id,
      type: 'checklist',
      title: 'Packing list',
      checklist: [
        { id: newId(), text: 'Passport', checked: true, sortOrder: 0 },
        { id: newId(), text: 'Straßenkarte', checked: false, sortOrder: 1 },
      ],
    });

    const coloured = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Pinned and coloured',
      content: 'Stays at the top.',
    });
    await repos.notes.update(coloured.id, { color: 'teal' });
    await repos.notes.setPinned(coloured.id, true);

    const archived = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Archived note',
      content: 'Out of the way.',
    });
    await repos.notes.setArchived(archived.id, true);

    const trashed = await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title: 'Trashed note',
      content: 'On its way out.',
    });
    await repos.notes.trash(trashed.id);

    await TestBed.inject(ExportService).exportAll();
    const [json] = [...repos.exports.files.values()];
    android = JSON.parse(json as string) as Record<string, unknown>;
  });

  afterEach(async () => {
    await repos.adapter.close();
  });

  it('writes the same envelope keys the desktop does, in model order throughout', () => {
    expectKnownKeysThroughout(android);
    expect(Object.keys(android)).toEqual(Object.keys(fixture as Record<string, unknown>));

    expectDeclarationOrder(android, ENVELOPE_KEYS);
    for (const notebook of android['notebooks'] as Record<string, unknown>[]) {
      expectDeclarationOrder(notebook, NOTEBOOK_KEYS);
    }
    for (const note of android['notes'] as Record<string, unknown>[]) {
      expectDeclarationOrder(note, NOTE_KEYS);
    }
  });

  it('uses the same fields per entity kind as the desktop does', () => {
    const desktop = fixture as Record<string, Record<string, unknown>[]>;

    for (const kind of ['notebooks', 'notes', 'labels', 'images'] as const) {
      expect(keyUnion(android[kind] as Record<string, unknown>[])).toEqual(
        keyUnion(desktop[kind] as Record<string, unknown>[]),
      );
    }
  });

  it('carries the same notes, notebooks and labels once ids and times are set aside', () => {
    const desktop = fixture as {
      notes: { title: string; type: string; archived: boolean; content: string }[];
      notebooks: { name: string }[];
      labels: { name: string }[];
    };
    const byTitle = (values: { title: string }[]) =>
      [...values].sort((a, b) => a.title.localeCompare(b.title)).map((value) => value.title);

    expect(byTitle(android['notes'] as { title: string }[])).toEqual(byTitle(desktop.notes));
    expect((android['notebooks'] as { name: string }[]).map((value) => value.name).sort()).toEqual(
      desktop.notebooks.map((value) => value.name).sort(),
    );
    expect((android['labels'] as { name: string }[]).map((value) => value.name)).toEqual(
      desktop.labels.map((value) => value.name),
    );
  });
});
