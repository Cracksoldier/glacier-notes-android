import { beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseAdapter } from '../database-adapter';
import { NodeSqliteAdapter } from '../node-sqlite.adapter';
import { initialSchema } from './001-initial-schema';
import { noteSearchTextColumn } from './002-note-search-text';
import { runMigrations } from './migration-runner';

const NOTEBOOK_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3310';
const TEXT_NOTE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const CHECKLIST_NOTE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302';
const STAMP = '2026-01-01T00:00:00.000Z';

describe('backfilling notes.search_text', () => {
  let adapter: DatabaseAdapter;

  async function insertNote(id: string, title: string, content: string): Promise<void> {
    await adapter.run(
      'INSERT INTO notes (id, notebook_id, type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, NOTEBOOK_ID, 'text', title, content, STAMP, STAMP],
    );
  }

  async function searchText(id: string): Promise<string | undefined> {
    const [row] = await adapter.query<{ search_text: string }>(
      'SELECT search_text FROM notes WHERE id = ?',
      [id],
    );
    return row?.search_text;
  }

  beforeEach(async () => {
    adapter = new NodeSqliteAdapter();
    await adapter.open();
    // Only v1, so the rows below are the ones an already-installed app would have.
    await runMigrations(adapter, [initialSchema]);
    await adapter.run(
      'INSERT INTO notebooks (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [NOTEBOOK_ID, 'Notes', 1, STAMP, STAMP],
    );
    await insertNote(TEXT_NOTE_ID, 'Einkauf bei MÜLLER', 'Über die **Straße**');
    await insertNote(CHECKLIST_NOTE_ID, 'Packliste', '');
    await adapter.run(
      'INSERT INTO checklist_items (id, note_id, text, checked, sort_order) VALUES (?, ?, ?, ?, ?)',
      ['item-b', CHECKLIST_NOTE_ID, 'Zahnbürste', 0, 1],
    );
    await adapter.run(
      'INSERT INTO checklist_items (id, note_id, text, checked, sort_order) VALUES (?, ?, ?, ?, ?)',
      ['item-a', CHECKLIST_NOTE_ID, 'Reisepass', 0, 0],
    );

    await runMigrations(adapter, [initialSchema, noteSearchTextColumn]);
  });

  it('folds the title and body of a note that predates the column', async () => {
    expect(await searchText(TEXT_NOTE_ID)).toBe('einkauf bei müller\nüber die **straße**');
  });

  it('includes checklist item text, in sort order rather than insertion order', async () => {
    expect(await searchText(CHECKLIST_NOTE_ID)).toBe('packliste\n\nreisepass\nzahnbürste');
  });

  it('leaves a note added afterwards at the empty default rather than NULL', async () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3303';
    await insertNote(id, 'Later', 'Body');

    expect(await searchText(id)).toBe('');
  });
});
