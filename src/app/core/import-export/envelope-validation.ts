import type { ChecklistItem } from '../models/checklist-item';
import { isEntityId, nowIso, SCHEMA_VERSION } from '../models/entity-id';
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, referencedImageIds } from '../models/image-asset';
import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';

import {
  EXPORT_FORMAT,
  type ExportedImage,
  type ExportEnvelope,
  type ExportScope,
} from './transfer-contract';

/**
 * `validateEnvelope`, ported from the desktop's `electron/transfer-core.ts`.
 *
 * M12 uses it two ways: as the exporter's own self-check before anything is
 * written, and as the assertion in the round-trip contract specs. M13 will use
 * it for what the desktop uses it for — vetting a file the user picked.
 *
 * The messages are English technical diagnostics rather than translated UI copy
 * on purpose. They name array indices and ids, they are what a user would paste
 * into a bug report, and M12 shows only their *count*; M13 decides how to
 * present them.
 */

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function addDuplicateErrors(
  values: readonly { id: string }[],
  name: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) errors.push(`${name}: duplicate id ${value.id}`);
    seen.add(value.id);
  }
}

/** Decoded byte length, or `-1` when the string is not decodable base64. */
function base64ByteLength(value: unknown): number {
  if (typeof value !== 'string') return -1;
  try {
    return atob(value).length;
  } catch {
    return -1;
  }
}

export type EnvelopeValidation =
  | { ok: true; envelope: ExportEnvelope }
  | { ok: false; errors: string[] };

export function validateEnvelope(raw: unknown): EnvelopeValidation {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Not a JSON object'] };
  }
  if (raw['format'] !== EXPORT_FORMAT) {
    errors.push(`Unknown format: expected "${EXPORT_FORMAT}"`);
  }
  if (!validDate(raw['exportedAt'])) errors.push('Missing or invalid exportedAt');
  const version = raw['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    errors.push('Missing or invalid schemaVersion');
  } else if (version > SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion ${version} (this app supports up to ${SCHEMA_VERSION})`);
  }
  for (const key of ['notebooks', 'notes', 'labels', 'images'] as const) {
    if (!Array.isArray(raw[key])) {
      errors.push(`Missing or invalid "${key}" array`);
    }
  }
  // Structural failures short-circuit: the per-entity passes below index into
  // these arrays and would otherwise report a second, derived set of errors.
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const notebooks: Notebook[] = [];
  (raw['notebooks'] as unknown[]).forEach((value, i) => {
    if (!isRecord(value) || !isEntityId(value['id'])) {
      errors.push(`notebooks[${i}]: invalid id`);
      return;
    }
    if (typeof value['name'] !== 'string' || value['name'] === '') {
      errors.push(`notebooks[${i}]: missing name`);
      return;
    }
    if (!validDate(value['createdAt']) || !validDate(value['updatedAt'])) {
      errors.push(`notebooks[${i}]: invalid timestamps`);
      return;
    }
    if (!Number.isInteger(value['sortOrder'])) {
      errors.push(`notebooks[${i}]: invalid sortOrder`);
      return;
    }
    notebooks.push({
      id: value['id'],
      name: value['name'],
      ...(typeof value['color'] === 'string' ? { color: value['color'] } : {}),
      createdAt: value['createdAt'],
      updatedAt: value['updatedAt'],
      sortOrder: value['sortOrder'] as number,
    });
  });

  const notes: Note[] = [];
  (raw['notes'] as unknown[]).forEach((value, i) => {
    if (!isRecord(value) || !isEntityId(value['id'])) {
      errors.push(`notes[${i}]: invalid id`);
      return;
    }
    if (!isEntityId(value['notebookId'])) {
      errors.push(`notes[${i}]: invalid notebookId`);
      return;
    }
    const type = value['type'];
    if (type !== 'text' && type !== 'checklist') {
      errors.push(`notes[${i}]: invalid type`);
      return;
    }
    const checklist: ChecklistItem[] = [];
    if (type === 'checklist') {
      if (!Array.isArray(value['checklist'])) {
        errors.push(`notes[${i}]: missing checklist`);
        return;
      }
      const itemIds = new Set<string>();
      value['checklist'].forEach((item: unknown, j: number) => {
        if (
          !isRecord(item) ||
          !isEntityId(item['id']) ||
          typeof item['text'] !== 'string' ||
          typeof item['checked'] !== 'boolean' ||
          !Number.isInteger(item['sortOrder'])
        ) {
          errors.push(`notes[${i}].checklist[${j}]: invalid item`);
          return;
        }
        if (itemIds.has(item['id'])) {
          errors.push(`notes[${i}].checklist: duplicate id ${item['id']}`);
        }
        itemIds.add(item['id']);
        checklist.push({
          id: item['id'],
          text: item['text'],
          checked: item['checked'],
          sortOrder: item['sortOrder'] as number,
        });
      });
    }
    if (
      typeof value['title'] !== 'string' ||
      typeof value['content'] !== 'string' ||
      !Array.isArray(value['imageIds']) ||
      !value['imageIds'].every(isEntityId) ||
      typeof value['pinned'] !== 'boolean' ||
      typeof value['archived'] !== 'boolean' ||
      !Array.isArray(value['labels']) ||
      !value['labels'].every(isEntityId) ||
      !validDate(value['createdAt']) ||
      !validDate(value['updatedAt']) ||
      (value['deletedAt'] !== undefined && !validDate(value['deletedAt']))
    ) {
      errors.push(`notes[${i}]: invalid structure`);
      return;
    }
    notes.push({
      id: value['id'],
      notebookId: value['notebookId'],
      type,
      title: value['title'],
      content: value['content'],
      ...(type === 'checklist' ? { checklist } : {}),
      imageIds: value['imageIds'] as string[],
      pinned: value['pinned'],
      archived: value['archived'],
      ...(typeof value['color'] === 'string' ? { color: value['color'] } : {}),
      labels: value['labels'] as string[],
      ...(typeof value['deletedAt'] === 'string' ? { deletedAt: value['deletedAt'] } : {}),
      createdAt: value['createdAt'],
      updatedAt: value['updatedAt'],
    });
  });

  const labels: Label[] = [];
  (raw['labels'] as unknown[]).forEach((value, i) => {
    if (!isRecord(value) || !isEntityId(value['id'])) {
      errors.push(`labels[${i}]: invalid id`);
      return;
    }
    if (typeof value['name'] !== 'string' || value['name'] === '') {
      errors.push(`labels[${i}]: missing name`);
      return;
    }
    labels.push({ id: value['id'], name: value['name'] });
  });

  const images: ExportedImage[] = [];
  (raw['images'] as unknown[]).forEach((value, i) => {
    if (!isRecord(value) || !isEntityId(value['id'])) {
      errors.push(`images[${i}]: invalid id`);
      return;
    }
    if (typeof value['mimeType'] !== 'string' || !IMAGE_MIME_TYPES.has(value['mimeType'])) {
      errors.push(`images[${i}]: unsupported mimeType`);
      return;
    }
    const base64 = value['base64'];
    const byteLength = base64ByteLength(base64);
    if (
      typeof base64 !== 'string' ||
      base64.length === 0 ||
      base64.length % 4 !== 0 ||
      !BASE64_PATTERN.test(base64) ||
      byteLength < 0 ||
      byteLength > MAX_IMAGE_BYTES
    ) {
      errors.push(`images[${i}]: invalid base64 data`);
      return;
    }
    images.push({
      id: value['id'],
      mimeType: value['mimeType'],
      ...(typeof value['fileName'] === 'string' ? { fileName: value['fileName'] } : {}),
      base64,
    });
  });

  // Referential integrity is only meaningful over entities that parsed.
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  addDuplicateErrors(notebooks, 'notebooks', errors);
  addDuplicateErrors(notes, 'notes', errors);
  addDuplicateErrors(labels, 'labels', errors);
  addDuplicateErrors(images, 'images', errors);

  const notebookIds = new Set(notebooks.map((n) => n.id));
  const labelIds = new Set(labels.map((l) => l.id));
  const imageIds = new Set(images.map((image) => image.id));
  for (const note of notes) {
    if (!notebookIds.has(note.notebookId)) {
      errors.push(`note ${note.id}: missing notebook ${note.notebookId}`);
    }
    for (const id of note.labels) {
      if (!labelIds.has(id)) errors.push(`note ${note.id}: missing label ${id}`);
    }
    // Why the exporter refuses to write when an image file is unreadable: an
    // omitted image lands here as a dangling reference and the desktop rejects
    // the whole file.
    for (const id of referencedImageIds(note)) {
      if (!imageIds.has(id)) errors.push(`note ${note.id}: missing image ${id}`);
    }
  }

  const scope = raw['scope'];
  let parsedScope: ExportScope | undefined;
  if (scope !== undefined) {
    if (!isRecord(scope) || !['all', 'notebook', 'note'].includes(String(scope['kind']))) {
      errors.push('Invalid export scope');
    } else if (scope['kind'] === 'all') {
      parsedScope = { kind: 'all' };
    } else if (scope['kind'] === 'notebook' && isEntityId(scope['notebookId'])) {
      parsedScope = { kind: 'notebook', notebookId: scope['notebookId'] };
    } else if (scope['kind'] === 'note' && isEntityId(scope['noteId'])) {
      parsedScope = { kind: 'note', noteId: scope['noteId'] };
    } else {
      errors.push('Invalid export scope');
    }
  }
  if (parsedScope?.kind === 'notebook' && !notebookIds.has(parsedScope.notebookId)) {
    errors.push('Export scope references a missing notebook');
  }
  if (parsedScope?.kind === 'note') {
    const { noteId } = parsedScope;
    if (!notes.some((note) => note.id === noteId)) {
      errors.push('Export scope references a missing note');
    }
  }

  const defaultNotebookId = raw['defaultNotebookId'];
  if (
    defaultNotebookId !== undefined &&
    defaultNotebookId !== null &&
    (!isEntityId(defaultNotebookId) || !notebookIds.has(defaultNotebookId))
  ) {
    errors.push('Invalid defaultNotebookId');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    envelope: {
      format: EXPORT_FORMAT,
      schemaVersion: version as number,
      exportedAt: validDate(raw['exportedAt']) ? raw['exportedAt'] : nowIso(),
      notebooks,
      notes,
      labels,
      images,
      ...(parsedScope ? { scope: parsedScope } : {}),
      ...(defaultNotebookId === null || typeof defaultNotebookId === 'string'
        ? { defaultNotebookId }
        : {}),
    },
  };
}
