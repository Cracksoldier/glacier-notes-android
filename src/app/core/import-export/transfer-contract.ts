import { referencedImageIds } from '../models/image-asset';
import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';
import { newId, nowIso, SCHEMA_VERSION } from '../models/entity-id';

/**
 * The `.glacier.json` exchange contract, ported from the desktop's
 * `electron/transfer-core.ts`. The desktop is authoritative: this file exists so
 * an Android export is byte-compatible with what the desktop already reads, and
 * every difference from that source is a bug rather than a local improvement.
 *
 * What "ported" excludes: the private constants the desktop keeps here
 * (`UUID_PATTERN`, `IMAGE_MIME_TYPES`, `MAX_IMAGE_BYTES`, `IMAGE_REF_PATTERN`,
 * `referencedImageIds`) already exist as public model constants under
 * `core/models` and are imported rather than re-declared.
 *
 * What the two apps must agree on is the *set* of keys, not their order: the
 * desktop's `NoteRepo.update` does `{...note, ...patch}`, so an optional key set
 * after creation lands at the end of the object rather than in declaration
 * position, and its own files are inconsistent about it
 * (`desktop-fixture.spec.ts` pins that behaviour). This app writes the
 * declaration order in `models/note.ts`, `notebook.ts` and `label.ts` because
 * `collectExport` spreads them verbatim, which makes its output deterministic —
 * a property worth keeping, but not one to compare a desktop file against.
 */

export const EXPORT_FORMAT = 'glacier-notes-export';

export interface ExportedImage {
  id: string;
  mimeType: string;
  fileName?: string;
  base64: string;
}

/**
 * All three scopes are ported although M12 only ever calls `'all'`: narrowing
 * the port would mean maintaining code that differs from the authoritative
 * source. `docs/desktop-audit.md` §11 left Android's adoption of the scoped
 * exports open; the answer is that the contract supports them and the UI does
 * not — M14 wired a share sheet and still exports only the whole collection,
 * because a per-note share is text rather than an envelope.
 */
export type ExportScope =
  | { kind: 'all' }
  | { kind: 'notebook'; notebookId: string }
  | { kind: 'note'; noteId: string };

export interface ExportEnvelope {
  format: 'glacier-notes-export';
  schemaVersion: number;
  exportedAt: string;
  notebooks: Notebook[];
  notes: Note[];
  labels: Label[];
  images: ExportedImage[];
  /** Optional for compatibility with exports produced before the desktop's M8. */
  scope?: ExportScope;
  /** Present for all-data exports; older v1 exports omit it. */
  defaultNotebookId?: string | null;
}

/**
 * What `collectExport` needs to see. `readImage` is deliberately **synchronous**
 * — the desktop reads files with `fs.readFileSync` — so an Android caller has to
 * have every referenced image in hand before calling. See `ExportService`.
 */
export interface ExportSource {
  notebooks: Notebook[];
  notes: Note[];
  labels: Label[];
  defaultNotebookId: string;
  readImage(id: string): Omit<ExportedImage, 'id'> | null;
}

/**
 * The note set handed in must already be the desktop's `allNotes()` — active,
 * archived *and* trashed. Note that images are collected from the notes rather
 * than from the image table, so an image nothing references is never exported.
 */
export function collectExport(scope: ExportScope, source: ExportSource): ExportEnvelope {
  const notes =
    scope.kind === 'all'
      ? source.notes
      : scope.kind === 'notebook'
        ? source.notes.filter((n) => n.notebookId === scope.notebookId)
        : source.notes.filter((n) => n.id === scope.noteId);
  const notebookIds = new Set(
    scope.kind === 'all'
      ? source.notebooks.map((n) => n.id)
      : scope.kind === 'notebook'
        ? [scope.notebookId]
        : notes.map((n) => n.notebookId),
  );
  const notebooks = source.notebooks.filter((n) => notebookIds.has(n.id));

  let labels: Label[];
  if (scope.kind === 'all') {
    labels = source.labels;
  } else {
    const used = new Set(notes.flatMap((n) => n.labels));
    labels = source.labels.filter((l) => used.has(l.id));
  }

  const images: ExportedImage[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    for (const id of referencedImageIds(note)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const image = source.readImage(id);
      if (image !== null) {
        images.push({ id, ...image });
      }
    }
  }

  return {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    notebooks: notebooks.map((n) => ({ ...n })),
    notes: notes.map((n) => ({ ...n })),
    labels: labels.map((l) => ({ ...l })),
    images: images,
    scope,
    ...(scope.kind === 'all' ? { defaultNotebookId: source.defaultNotebookId } : {}),
  };
}

// A type alias rather than an interface, so it keeps TypeScript's implicit index
// signature and can be passed straight to `I18nService.t()` as its params.
export type ImportCounts = {
  notebooks: number;
  notes: number;
  labels: number;
  images: number;
};

/**
 * All three of the desktop's strategies, although only two are ever offered:
 * `transfer-dialog.ts:116-137` applies `preserve` itself when a file has no id
 * conflicts and prompts for `copy` or `replace` when it does. `preserve` is
 * therefore the restore-a-backup path rather than a choice, which is what
 * `docs/desktop-audit.md` §11 left open.
 */
export type ImportStrategy = 'copy' | 'replace' | 'preserve';

export interface ExistingIds {
  notebookIds: Set<string>;
  noteIds: Set<string>;
  labelIds: Set<string>;
  imageIds: Set<string>;
}

/** Whether applying this envelope would overwrite anything already stored. */
export function detectConflicts(envelope: ExportEnvelope, existing: ExistingIds): boolean {
  return (
    envelope.notebooks.some((n) => existing.notebookIds.has(n.id)) ||
    envelope.notes.some((n) => existing.noteIds.has(n.id)) ||
    envelope.labels.some((l) => existing.labelIds.has(l.id)) ||
    envelope.images.some((i) => existing.imageIds.has(i.id))
  );
}

/**
 * A deep copy of the envelope in which every entity has a fresh id and every
 * cross-reference — note→notebook, note→labels, note→images, and the
 * `glacier-img://` URLs inside note content — points at it.
 *
 * Two things here look like bugs and are not. The content rewrite is a plain
 * substring replace over the whole body rather than a URL-aware one, so an image
 * id that appears in prose is rewritten too; porting it faithfully is what makes
 * an Android copy-import and a desktop copy-import produce the same note.
 * And a reference to an entity the envelope does not carry is left untouched for
 * the applier to resolve or drop — a case `validateEnvelope`'s referential
 * integrity pass has already made unreachable on this side.
 */
export function remapAsCopies(envelope: ExportEnvelope): ExportEnvelope {
  const notebookIds = new Map(envelope.notebooks.map((n) => [n.id, newId()]));
  const labelIds = new Map(envelope.labels.map((l) => [l.id, newId()]));
  const imageIds = new Map(envelope.images.map((i) => [i.id, newId()]));

  return {
    ...envelope,
    notebooks: envelope.notebooks.map((n) => ({ ...n, id: notebookIds.get(n.id) ?? n.id })),
    labels: envelope.labels.map((l) => ({ ...l, id: labelIds.get(l.id) ?? l.id })),
    images: envelope.images.map((i) => ({ ...i, id: imageIds.get(i.id) ?? i.id })),
    notes: envelope.notes.map((note) => {
      let content = note.content;
      for (const [oldId, freshId] of imageIds) {
        content = content.split(oldId).join(freshId);
      }
      return {
        ...note,
        id: newId(),
        notebookId: notebookIds.get(note.notebookId) ?? note.notebookId,
        labels: note.labels.map((id) => labelIds.get(id) ?? id),
        imageIds: note.imageIds.map((id) => imageIds.get(id) ?? id),
        content,
        ...(note.checklist
          ? { checklist: note.checklist.map((item) => ({ ...item, id: newId() })) }
          : {}),
      };
    }),
  };
}

export function envelopeCounts(envelope: ExportEnvelope): ImportCounts {
  return {
    notebooks: envelope.notebooks.length,
    notes: envelope.notes.length,
    labels: envelope.labels.length,
    images: envelope.images.length,
  };
}
