import { Injectable, inject } from '@angular/core';

import type { DatabaseAdapter } from '../database/database-adapter';
import { IMAGE_FILE_STORE } from '../images/image-file-store';
import { CollectionRepository, readExistingIds } from '../repositories/collection-snapshot';
import { queryUnreferencedImageIds } from '../repositories/image-queries';
import { deleteImageAsset, insertImageAsset } from '../repositories/image-writes';
import { insertLabel, renameLabel } from '../repositories/label-writes';
import {
  deleteNotebookRow,
  insertNotebook,
  replaceNotebookRow,
  writeDefaultNotebookId,
} from '../repositories/notebook-writes';
import { insertNote, purgeNote } from '../repositories/note-writes';
import type { PickedDocument } from '../native/document-gateway';
import { RepositoryContext } from '../repositories/repository-context';
import { validateEnvelope } from './envelope-validation';
import { stripBom } from './strip-bom';
import {
  detectConflicts,
  envelopeCounts,
  type ExportEnvelope,
  type ImportCounts,
  type ImportStrategy,
  remapAsCopies,
} from './transfer-contract';

export type ImportInspectResult =
  /** `fileName` is null when the document provider reports no display name. */
  | { status: 'ready'; fileName: string | null; hasConflicts: boolean; counts: ImportCounts }
  | { status: 'invalid'; errors: string[] }
  | { status: 'failed' };

export type ImportApplyResult =
  | { status: 'done'; counts: ImportCounts }
  | { status: 'nothing-pending' }
  | { status: 'failed' };

/**
 * What V8 says when `JSON.parse` fails quotes the offending token, which can be a
 * character of the user's own note text. The message shown is therefore a
 * constant — the same reason no catch block in this folder logs its error.
 */
const UNPARSEABLE = 'The file is not valid JSON.';

/**
 * Reads a `.glacier.json` the user picked and applies it.
 *
 * Two phases, mirroring the desktop's `importInspect`/`importApply` IPC pair
 * (`electron/export-import.ts:150-219`). The validated envelope is held here
 * between them exactly as the desktop's main process holds `pendingImport`, so
 * the page never carries a multi-megabyte object in a signal.
 *
 * There is no `canceled` result, although a cancellation is now a real thing the
 * document picker reports: `DocumentGateway.open()` answers it one layer out and
 * the page simply never calls `inspect`. What reaches here is always a document.
 *
 * This is the one service outside `core/repositories` that takes a
 * `RepositoryContext` rather than a repository. It has to: an import is bulk
 * work, which `docs/repositories.md` requires be composed from the `*-writes.ts`
 * primitives inside a *single* `write()`, and it interleaves those with file
 * writes that no repository can see.
 */
@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly context = inject(RepositoryContext);
  private readonly collection = inject(CollectionRepository);
  private readonly files = inject(IMAGE_FILE_STORE);

  private pending: ExportEnvelope | null = null;

  /** Vets the document and reports what applying it would do. Writes nothing. */
  async inspect(document: PickedDocument): Promise<ImportInspectResult> {
    this.pending = null;

    let raw: unknown;
    try {
      raw = JSON.parse(stripBom(document.text));
    } catch {
      return { status: 'invalid', errors: [UNPARSEABLE] };
    }

    const validation = validateEnvelope(raw);
    if (!validation.ok) {
      return { status: 'invalid', errors: validation.errors };
    }

    let hasConflicts: boolean;
    try {
      hasConflicts = detectConflicts(validation.envelope, await this.collection.existingIds());
    } catch {
      return { status: 'failed' };
    }

    this.pending = validation.envelope;
    return {
      status: 'ready',
      fileName: document.name,
      hasConflicts,
      counts: envelopeCounts(validation.envelope),
    };
  }

  /**
   * The database side is one transaction; the file side is bracketed around it.
   *
   * `staged` names every file this write created, and is undone when the
   * transaction rolls back. `collected` names files whose rows the import
   * deleted, and is drained only after the commit — rows first, files second,
   * per `docs/images.md`. Both crash windows that leaves are ones
   * `ImageGcService.sweep()` already closes at startup.
   */
  async apply(strategy: ImportStrategy): Promise<ImportApplyResult> {
    const pending = this.pending;
    if (!pending) {
      return { status: 'nothing-pending' };
    }
    const envelope = strategy === 'copy' ? remapAsCopies(pending) : pending;

    const staged: string[] = [];
    const collected: string[] = [];
    try {
      await this.context.write('import.apply', (adapter) =>
        this.applyTo(adapter, envelope, strategy, staged, collected),
      );
    } catch {
      await this.discard(staged);
      return { status: 'failed' };
    }

    await this.discard(collected);
    this.pending = null;
    return { status: 'done', counts: envelopeCounts(envelope) };
  }

  /** Drops the inspected envelope, so a later `apply` has nothing to do. */
  cancel(): void {
    this.pending = null;
  }

  private async applyTo(
    adapter: DatabaseAdapter,
    envelope: ExportEnvelope,
    strategy: ImportStrategy,
    staged: string[],
    collected: string[],
  ): Promise<void> {
    const existing = await readExistingIds(adapter);

    // `export-import.ts:172-181`: only a `preserve` import of a whole collection
    // into a store that is still the freshly seeded one restores the file's own
    // default notebook and drops the notebooks the file does not carry.
    const pristine =
      existing.notebookIds.size === 1 &&
      existing.noteIds.size === 0 &&
      existing.labelIds.size === 0 &&
      existing.imageIds.size === 0;
    const restoredDefaultId =
      strategy === 'preserve' &&
      pristine &&
      envelope.scope?.kind === 'all' &&
      typeof envelope.defaultNotebookId === 'string'
        ? envelope.defaultNotebookId
        : null;

    for (const notebook of envelope.notebooks) {
      if (existing.notebookIds.has(notebook.id)) {
        await replaceNotebookRow(adapter, notebook);
      } else {
        await insertNotebook(adapter, notebook);
      }
    }

    if (restoredDefaultId !== null) {
      // Before the deletes, not after: `app_state.default_notebook_id` is
      // `ON DELETE SET NULL`, so removing the seeded notebook first would blank
      // the very setting this is here to write.
      await writeDefaultNotebookId(adapter, restoredDefaultId);
      const carried = new Set(envelope.notebooks.map((n) => n.id));
      for (const id of existing.notebookIds) {
        if (!carried.has(id)) {
          await deleteNotebookRow(adapter, id);
        }
      }
    }

    for (const label of envelope.labels) {
      if (existing.labelIds.has(label.id)) {
        await renameLabel(adapter, label.id, label.name);
      } else {
        await insertLabel(adapter, label);
      }
    }

    for (const image of envelope.images) {
      const known = existing.imageIds.has(image.id);
      // A UUID identifies one asset, so a known id means the local bytes are
      // already the right bytes. Skipping the write is a deliberate deviation
      // from the desktop's `ImageStore.addWithId`, which overwrites
      // unconditionally: it means no file this import writes can ever have
      // destroyed one, which is what makes `staged` a sufficient undo.
      if (known && (await this.files.read(image.id)) !== null) {
        continue;
      }
      await this.files.write(image.id, image.base64, image.mimeType);
      staged.push(image.id);
      if (!known) {
        await insertImageAsset(adapter, {
          id: image.id,
          mimeType: image.mimeType,
          ...(image.fileName !== undefined && { fileName: image.fileName }),
        });
      }
    }

    const priorImageIds = new Set<string>();
    for (const note of envelope.notes) {
      if (existing.noteIds.has(note.id)) {
        const prior = await purgeNote(adapter, note.id);
        if (strategy === 'replace') {
          for (const id of prior) {
            priorImageIds.add(id);
          }
        }
      }
      await insertNote(adapter, note);
    }

    // After the notes are back in, so an image the replacement still references
    // fails the `unreferenced` predicate rather than being collected.
    if (priorImageIds.size > 0) {
      for (const id of await queryUnreferencedImageIds(adapter, [...priorImageIds])) {
        await deleteImageAsset(adapter, id);
        collected.push(id);
      }
    }
  }

  /** A file that will not delete is an orphan, which the startup sweep collects. */
  private async discard(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.files.delete(id);
      } catch {
        // Intentionally ignored — see above.
      }
    }
  }
}
