import { TestBed } from '@angular/core/testing';
import { afterAll, describe, expect, it } from 'vitest';

import { ExportService } from '../app/core/import-export/export.service';
import { ImportService } from '../app/core/import-export/import.service';
import { newId } from '../app/core/models/entity-id';
import {
  createTestRepositories,
  seedNotes,
  type TestRepositories,
} from '../app/core/repositories/testing';

/**
 * What a large `.glacier.json` costs to import, measured rather than guessed.
 *
 * The milestone asks for a documented practical import size, and the two limits
 * that produce it are not in the database: the whole file is one JavaScript
 * string that `JSON.parse` turns into one object graph, and `remapAsCopies`
 * deep-copies that graph, so the copy path peaks at roughly twice the envelope.
 * `docs/import-export.md` holds the numbers this produced.
 *
 * Kept out of `npm test` for the same reason as `collection-performance.spec.ts`
 * — see its header. `npm run test:bench` is the way in.
 */

const SIZES = [1_000, 5_000, 10_000] as const;

/** Enough images to matter without turning the benchmark into a base64 test. */
const IMAGE_COUNT = 20;

/** Roughly 64 KB each, which is a small photo after base64. */
const IMAGE_BASE64 = 'A'.repeat(88_000);

const BENCH_TIMEOUT_MS = 600_000;

interface Timing {
  readonly size: number;
  readonly operation: string;
  readonly megabytes: number;
  readonly ms: number;
}

const timings: Timing[] = [];

describe('importing a large collection', () => {
  afterAll(report);

  for (const size of SIZES) {
    it(
      `imports ${size} notes end to end`,
      async () => {
        const json = await exportOf(size);
        const megabytes = new TextEncoder().encode(json).length / 1_000_000;

        for (const strategy of ['preserve', 'copy'] as const) {
          const target = await freshRepositories();
          try {
            const importer = TestBed.inject(ImportService);
            const file = { name: 'bench.glacier.json', text: json };

            const inspecting = performance.now();
            const inspected = await importer.inspect(file);
            timings.push({
              size,
              operation: `inspect (${strategy})`,
              megabytes,
              ms: performance.now() - inspecting,
            });
            expect(inspected.status).toBe('ready');

            const applying = performance.now();
            const applied = await importer.apply(strategy);
            timings.push({
              size,
              operation: `apply (${strategy})`,
              megabytes,
              ms: performance.now() - applying,
            });

            expect(applied).toMatchObject({ status: 'done' });
            expect(await target.notes.list({ kind: 'all' })).not.toHaveLength(0);
          } finally {
            await target.adapter.close();
          }
        }
      },
      BENCH_TIMEOUT_MS,
    );
  }
});

/**
 * Each case needs three databases — one to export from, one per strategy — and
 * `createTestRepositories` configures the testing module, which may only happen
 * once per instantiation. Every other spec takes one database per test and so
 * rides on the builder's own reset.
 */
async function freshRepositories(): Promise<TestRepositories> {
  TestBed.resetTestingModule();
  return createTestRepositories();
}

/** A seeded collection exported through the real exporter, as a file would be. */
async function exportOf(size: number): Promise<string> {
  const repositories = await freshRepositories();
  try {
    await seedNotes(repositories, size);
    const notes = await repositories.notes.list({ kind: 'active' });
    for (let index = 0; index < IMAGE_COUNT; index++) {
      const id = newId();
      await repositories.images.insert({
        id,
        mimeType: 'image/png',
        fileName: `bench-${index}.png`,
      });
      await repositories.files.write(id, IMAGE_BASE64, 'image/png');
      const note = notes[index];
      await repositories.notes.update(note.id, {
        content: `${note.content}\n\n![bench](glacier-img://${id})`,
        imageIds: [id],
      });
    }

    const result = await TestBed.inject(ExportService).exportAll('save');
    expect(result.status).toBe('saved');
    const [json] = [...repositories.exports.files.values()];
    return json as string;
  } finally {
    await repositories.adapter.close();
  }
}

/** Straight to stdout, for the reason `collection-performance.spec.ts` gives. */
function report(): void {
  const lines = timings.map(
    ({ size, operation, megabytes, ms }) =>
      `${String(size).padStart(6)}  ${operation.padEnd(20)}  ${megabytes.toFixed(1).padStart(7)} MB  ${ms.toFixed(1).padStart(9)} ms`,
  );
  process.stdout.write(`\n  notes  operation                 size          time\n`);
  process.stdout.write(`${lines.map((line) => `  ${line}`).join('\n')}\n\n`);
}
