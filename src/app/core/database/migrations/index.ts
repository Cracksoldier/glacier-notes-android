import { initialSchema } from './001-initial-schema';
import { noteSearchTextColumn } from './002-note-search-text';
import type { Migration } from './migration';

/** Ordered by version. New steps are appended; existing ones are never edited. */
export const MIGRATIONS: readonly Migration[] = [initialSchema, noteSearchTextColumn];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
