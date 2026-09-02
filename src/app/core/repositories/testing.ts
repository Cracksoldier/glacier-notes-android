import { TestBed } from '@angular/core/testing';

import { DATABASE_ADAPTER, type DatabaseAdapter } from '../database/database-adapter';
import { runMigrations } from '../database/migrations/migration-runner';
import { NodeSqliteAdapter } from '../database/node-sqlite.adapter';
import { EXPORT_FILE_WRITER } from '../filesystem/export-file-writer';
import { MemoryExportFileWriter } from '../filesystem/memory-export-file-writer';
import { IMAGE_FILE_STORE } from '../images/image-file-store';
import { MemoryImageFileStore } from '../images/memory-image-file-store';
import { newId } from '../models/entity-id';
import type { Note } from '../models/note';
import { ImageAssetRepository } from './image-asset.repository';
import { LabelRepository } from './label.repository';
import { insertNote } from './note-writes';
import { NoteRepository } from './note.repository';
import { NotebookRepository } from './notebook.repository';
import { RepositoryContext } from './repository-context';

/**
 * The repositories under test are the real ones, over a real SQLite engine held
 * in memory — the same choice M04 made for the schema specs. A hand-written fake
 * would only assert what we already believe about foreign keys, `ON DELETE`
 * behaviour and transaction rollback, which are exactly the parts most likely to
 * be wrong.
 *
 * Spec-only: `node:sqlite` must never enter the browser graph, and nothing
 * reachable from `src/main.ts` imports this file.
 */

export interface TestRepositories {
  adapter: DatabaseAdapter;
  notes: NoteRepository;
  notebooks: NotebookRepository;
  labels: LabelRepository;
  images: ImageAssetRepository;
  /** Image bytes, for the same reason the database is real: the garbage
   * collector's correctness is about what survives on both sides. */
  files: MemoryImageFileStore;
  /** Where an export lands, so a spec can assert on what was written — and on
   * the cases where nothing was. */
  exports: MemoryExportFileWriter;
  /** The notebook migration 001 seeds; every note needs one and this is it. */
  defaultNotebookId: string;
}

export async function createTestRepositories(): Promise<TestRepositories> {
  const adapter = new NodeSqliteAdapter();
  await adapter.open();
  await runMigrations(adapter);
  const files = new MemoryImageFileStore();
  const exports = new MemoryExportFileWriter();

  TestBed.configureTestingModule({
    providers: [
      { provide: DATABASE_ADAPTER, useValue: adapter },
      { provide: IMAGE_FILE_STORE, useValue: files },
      { provide: EXPORT_FILE_WRITER, useValue: exports },
    ],
  });

  const notebooks = TestBed.inject(NotebookRepository);
  return {
    adapter,
    notes: TestBed.inject(NoteRepository),
    notebooks,
    labels: TestBed.inject(LabelRepository),
    images: TestBed.inject(ImageAssetRepository),
    files,
    exports,
    defaultNotebookId: await notebooks.getDefaultId(),
  };
}

export interface SeedNotesOptions {
  /** Defaults to the notebook migration 001 seeds. */
  notebookId?: string;
  /** Every nth note is archived, every (n × 2)th pinned, every (n / 2)th a checklist. */
  every?: number;
}

/**
 * A word per note, cycled by index, so a benchmark has something to search for
 * that matches a known fraction of the collection rather than all of it or none.
 * The two German ones are here because the folding they exercise is the reason
 * `search_text` exists at all.
 */
const SEED_WORDS = [
  'glacier',
  'invoice',
  'einkaufsliste',
  'roadmap',
  'straße',
  'meeting',
  'recipe',
  'travel',
];

const SEED_EPOCH_MS = Date.parse('2026-01-01T00:00:00.000Z');

/**
 * Thousands of notes in one transaction, by composing `insertNote` rather than
 * calling `NoteRepository.create` in a loop: each call would queue its own
 * `write()`, and at this size the queue would spend longer than
 * `QUEUE_STALL_TIMEOUT_MS` getting through them. It is the same rule M12's
 * import follows (`docs/repositories.md`).
 *
 * Deterministic in every field, so a re-run measures the same collection.
 */
export async function seedNotes(
  repositories: TestRepositories,
  count: number,
  options: SeedNotesOptions = {},
): Promise<void> {
  const notebookId = options.notebookId ?? repositories.defaultNotebookId;
  const every = options.every ?? 10;
  const context = TestBed.inject(RepositoryContext);

  await context.write('seedNotes', async (adapter) => {
    for (let index = 0; index < count; index++) {
      await insertNote(adapter, seedNote(index, notebookId, every));
    }
  });
}

function seedNote(index: number, notebookId: string, every: number): Note {
  const word = SEED_WORDS[index % SEED_WORDS.length];
  // Descending in time, so the seeded order and the `updatedAt` order disagree
  // and a sort benchmark cannot accidentally measure an already-sorted array.
  const createdAt = new Date(SEED_EPOCH_MS - index * 60_000).toISOString();
  const updatedAt = new Date(SEED_EPOCH_MS - ((index * 7919) % 100_000) * 60_000).toISOString();
  const checklist = index % Math.max(1, Math.floor(every / 2)) === 0;

  return {
    id: newId(),
    notebookId,
    type: checklist ? 'checklist' : 'text',
    title: `Seeded note ${index} ${word}`,
    content: checklist ? '' : `# ${word}\n\nParagraph ${index} mentioning ${word} once more.`,
    ...(checklist
      ? {
          checklist: [0, 1, 2].map((position) => ({
            id: newId(),
            text: `Item ${position} of note ${index}: ${word}`,
            checked: position === 0,
            sortOrder: position,
          })),
        }
      : {}),
    imageIds: [],
    pinned: index % (every * 2) === 0,
    archived: index % every === 0,
    labels: [],
    createdAt,
    updatedAt,
  };
}
