import { TestBed } from '@angular/core/testing';

import { DATABASE_ADAPTER, type DatabaseAdapter } from '../database/database-adapter';
import { runMigrations } from '../database/migrations/migration-runner';
import { NodeSqliteAdapter } from '../database/node-sqlite.adapter';
import { ImageAssetRepository } from './image-asset.repository';
import { LabelRepository } from './label.repository';
import { NoteRepository } from './note.repository';
import { NotebookRepository } from './notebook.repository';

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
  /** The notebook migration 001 seeds; every note needs one and this is it. */
  defaultNotebookId: string;
}

export async function createTestRepositories(): Promise<TestRepositories> {
  const adapter = new NodeSqliteAdapter();
  await adapter.open();
  await runMigrations(adapter);

  TestBed.configureTestingModule({
    providers: [{ provide: DATABASE_ADAPTER, useValue: adapter }],
  });

  const notebooks = TestBed.inject(NotebookRepository);
  return {
    adapter,
    notes: TestBed.inject(NoteRepository),
    notebooks,
    labels: TestBed.inject(LabelRepository),
    images: TestBed.inject(ImageAssetRepository),
    defaultNotebookId: await notebooks.getDefaultId(),
  };
}
