import { afterAll, describe, expect, it } from 'vitest';

import type { NoteView } from '../app/core/repositories/note-queries';
import {
  createTestRepositories,
  seedNotes,
  type TestRepositories,
} from '../app/core/repositories/testing';

/**
 * What a large collection costs, measured rather than guessed.
 *
 * Kept out of `npm test` — `angular.json` gives the `test` target an `include`
 * of `src/app/**` and this file a `bench` configuration of its own, because
 * seeding tens of thousands of rows takes minutes and nobody would run the suite
 * if it did that on every change. `npm run test:bench` is the way in.
 *
 * These assertions are about *correctness at size* only. Wall-clock numbers are
 * printed for the record and asserted against nothing: the machine that runs
 * them varies, and a threshold here would be a flake generator rather than a
 * regression detector. `docs/search-and-sorting.md` holds the baselines this
 * produced and the hardware they came from.
 *
 * `node:sqlite` is not an Android WebView and the Capacitor plugin adds a bridge
 * hop per statement, so these numbers are a floor, not a prediction. The shape
 * they establish — which operation dominates — is what carries over, and that is
 * what the rendering decision in `NoteListComponent` was taken from.
 */

const SIZES = [1_000, 5_000, 10_000] as const;

/** One statement's worth of seeding, times ten thousand notes. */
const BENCH_TIMEOUT_MS = 600_000;

/** Roughly how many cards a first paint actually needs. */
const FIRST_WINDOW = 30;

interface Timing {
  readonly size: number;
  readonly operation: string;
  readonly medianMs: number;
  readonly rows: number;
}

const timings: Timing[] = [];

describe('a collection of thousands of notes', () => {
  afterAll(report);

  for (const size of SIZES) {
    it(
      `reads, searches and windows ${size} notes`,
      async () => {
        const repositories = await createTestRepositories();
        try {
          const seeding = performance.now();
          await seedNotes(repositories, size);
          // Not a median — seeding is one-shot by nature, and this number exists
          // for M12's import rather than for the read path below it.
          timings.push({
            size,
            operation: 'seed (one transaction)',
            medianMs: performance.now() - seeding,
            rows: size,
          });

          await measure(repositories, size, 'list active', { kind: 'active' });
          await measure(repositories, size, 'list active (first window)', { kind: 'active' }, true);
          await measure(repositories, size, 'search word', {
            kind: 'search',
            query: 'roadmap',
            scope: { kind: 'all' },
          });
          // The compound-substring case: no tokenizer finds this, which is why
          // FTS5 was rejected and `search_text LIKE '%…%'` is the primary path.
          await measure(repositories, size, 'search substring', {
            kind: 'search',
            query: 'kaufsliste',
            scope: { kind: 'all' },
          });
          // German folding, which is the reason the column is normalized in
          // JavaScript rather than compared with SQLite's ASCII-only `lower()`.
          await measure(repositories, size, 'search folded', {
            kind: 'search',
            query: 'Straße',
            scope: { kind: 'all' },
          });
        } finally {
          await repositories.adapter.close();
        }
      },
      BENCH_TIMEOUT_MS,
    );
  }
});

/**
 * Written straight to stdout rather than through `console.table`: the test
 * runner's reporter buffers console output per test and drops what arrives in an
 * `afterAll`, which is exactly where a summary belongs.
 */
function report(): void {
  const lines = timings.map(
    ({ size, operation, rows, medianMs }) =>
      `${String(size).padStart(6)}  ${operation.padEnd(28)}  ${String(rows).padStart(6)} rows  ${medianMs.toFixed(1).padStart(9)} ms`,
  );
  process.stdout.write(`\n  notes  operation                       rows       median\n`);
  process.stdout.write(`${lines.map((line) => `  ${line}`).join('\n')}\n\n`);
}

/**
 * Median of five, after one discarded warm-up: the first read of a fresh
 * collection pays for SQLite's page cache, and reporting that as the cost of the
 * query would overstate every first number in the table.
 */
async function measure(
  repositories: TestRepositories,
  size: number,
  operation: string,
  view: NoteView,
  windowed = false,
): Promise<void> {
  const window = windowed ? { limit: FIRST_WINDOW } : undefined;
  let rows = 0;

  const run = async (): Promise<number> => {
    const started = performance.now();
    const notes = await repositories.notes.list(view, window);
    const elapsed = performance.now() - started;
    rows = notes.length;
    return elapsed;
  };

  await run();
  const samples: number[] = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    samples.push(await run());
  }
  samples.sort((a, b) => a - b);

  // Every operation here is expected to match something. A zero would mean the
  // seed drifted away from what this searches for, and the timing beside it
  // would be the cost of returning nothing.
  expect(rows).toBeGreaterThan(0);
  timings.push({ size, operation, medianMs: samples[2] ?? 0, rows });
}
