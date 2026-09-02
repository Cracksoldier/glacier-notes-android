import { referencedImageIds } from '../models/image-asset';
import type { Label } from '../models/label';
import type { Note } from '../models/note';
import type { Notebook } from '../models/notebook';
import { nowIso, SCHEMA_VERSION } from '../models/entity-id';

/**
 * The `.glacier.json` exchange contract, ported from the desktop's
 * `electron/transfer-core.ts`. The desktop is authoritative: this file exists so
 * an Android export is byte-compatible with what the desktop already reads, and
 * every difference from that source is a bug rather than a local improvement.
 *
 * What "ported" excludes: the desktop's `detectConflicts`, `remapAsCopies` and
 * `envelopeCounts` are import-side and belong to M13, and the private constants
 * the desktop keeps here (`UUID_PATTERN`, `IMAGE_MIME_TYPES`, `MAX_IMAGE_BYTES`,
 * `IMAGE_REF_PATTERN`, `referencedImageIds`) already exist as public model
 * constants under `core/models` and are imported rather than re-declared.
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
 * not, until M14 can offer a share sheet.
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
