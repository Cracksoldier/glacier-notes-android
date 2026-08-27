import { beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseAdapter } from '../database-adapter';
import { NodeSqliteAdapter } from '../node-sqlite.adapter';
import { runMigrations } from './migration-runner';

const NOTEBOOK = '3f2504e0-4f89-41d3-9a0c-0305e82c3310';
const OTHER_NOTEBOOK = '3f2504e0-4f89-41d3-9a0c-0305e82c3311';
const NOTE = '3f2504e0-4f89-41d3-9a0c-0305e82c3320';
const LABEL = '3f2504e0-4f89-41d3-9a0c-0305e82c3330';
const IMAGE = '3f2504e0-4f89-41d3-9a0c-0305e82c3340';
const TS = '2026-01-01T00:00:00.000Z';

describe('the v1 schema', () => {
  let adapter: DatabaseAdapter;

  beforeEach(async () => {
    adapter = new NodeSqliteAdapter();
    await adapter.open();
    await runMigrations(adapter);
    await adapter.run(
      'INSERT INTO notebooks (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [NOTEBOOK, 'Work', null, 1, TS, TS],
    );
  });

  async function insertNote(id = NOTE, notebookId = NOTEBOOK, type = 'text'): Promise<void> {
    await adapter.run(
      'INSERT INTO notes (id, notebook_id, type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, notebookId, type, 'Title', 'Body', TS, TS],
    );
  }

  async function count(table: string): Promise<number> {
    const [row] = await adapter.query<{ n: number }>(`SELECT count(*) AS n FROM ${table}`);
    return row?.n ?? 0;
  }

  it('runs on a SQLite new enough for STRICT tables', async () => {
    const [row] = await adapter.query<{ v: string }>('SELECT sqlite_version() AS v');
    const [major, minor] = (row?.v ?? '0.0').split('.').map(Number);

    expect((major ?? 0) * 1000 + (minor ?? 0)).toBeGreaterThanOrEqual(3037);
  });

  it('enforces foreign keys rather than merely declaring them', async () => {
    const [row] = await adapter.query<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(row?.foreign_keys).toBe(1);

    await expect(insertNote(NOTE, OTHER_NOTEBOOK)).rejects.toThrow();
  });

  it('makes every table STRICT, so an INTEGER column cannot hold prose', async () => {
    // Without STRICT this would be stored verbatim as text and corrupt every
    // ORDER BY sort_order afterwards. (STRICT still permits *lossless*
    // conversions, so `42` into a TEXT column is legal and not a useful test.)
    await expect(
      adapter.run(
        'INSERT INTO notebooks (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [OTHER_NOTEBOOK, 'Personal', null, 'first', TS, TS],
      ),
    ).rejects.toThrow();
  });

  describe('CHECK constraints', () => {
    it("rejects the specification's 'markdown' note type", async () => {
      await expect(insertNote(NOTE, NOTEBOOK, 'markdown')).rejects.toThrow();
    });

    it('accepts both desktop note types', async () => {
      await insertNote(NOTE, NOTEBOOK, 'text');
      await insertNote(`${NOTE.slice(0, -1)}1`, NOTEBOOK, 'checklist');

      expect(await count('notes')).toBe(2);
    });

    it('rejects a boolean column value outside 0 and 1', async () => {
      await insertNote();
      await expect(
        adapter.run('UPDATE notes SET pinned = 2 WHERE id = ?', [NOTE]),
      ).rejects.toThrow();
    });

    it('allows only one app_state row', async () => {
      await expect(
        adapter.run('INSERT INTO app_state (id, default_notebook_id) VALUES (2, NULL)', []),
      ).rejects.toThrow();
    });
  });

  describe('ON DELETE behaviour', () => {
    it('RESTRICTs deleting a notebook that still has notes', async () => {
      await insertNote();

      await expect(adapter.run('DELETE FROM notebooks WHERE id = ?', [NOTEBOOK])).rejects.toThrow();
      expect(await count('notes')).toBe(1);
    });

    it('allows deleting an empty notebook', async () => {
      await adapter.run('DELETE FROM notebooks WHERE id = ?', [NOTEBOOK]);

      expect(await count('notebooks')).toBe(1);
    });

    it('CASCADEs a label deletion into the junction, stripping it from notes', async () => {
      await insertNote();
      await adapter.run('INSERT INTO labels (id, name) VALUES (?, ?)', [LABEL, 'Urgent']);
      await adapter.run('INSERT INTO note_labels (note_id, label_id) VALUES (?, ?)', [NOTE, LABEL]);

      await adapter.run('DELETE FROM labels WHERE id = ?', [LABEL]);

      expect(await count('note_labels')).toBe(0);
      expect(await count('notes')).toBe(1);
    });

    it('CASCADEs a note deletion into its checklist items and junctions', async () => {
      await insertNote(NOTE, NOTEBOOK, 'checklist');
      await adapter.run('INSERT INTO labels (id, name) VALUES (?, ?)', [LABEL, 'Urgent']);
      await adapter.run('INSERT INTO note_labels (note_id, label_id) VALUES (?, ?)', [NOTE, LABEL]);
      await adapter.run(
        'INSERT INTO checklist_items (id, note_id, text, checked, sort_order) VALUES (?, ?, ?, ?, ?)',
        [LABEL, NOTE, 'Buy milk', 0, 0],
      );
      await adapter.run('INSERT INTO image_assets (id, mime_type, file_name) VALUES (?, ?, ?)', [
        IMAGE,
        'image/png',
        null,
      ]);
      await adapter.run(
        'INSERT INTO note_images (note_id, image_id, sort_order) VALUES (?, ?, ?)',
        [NOTE, IMAGE, 0],
      );

      await adapter.run('DELETE FROM notes WHERE id = ?', [NOTE]);

      expect(await count('checklist_items')).toBe(0);
      expect(await count('note_labels')).toBe(0);
      expect(await count('note_images')).toBe(0);
      // The label and the image survive; only the associations went.
      expect(await count('labels')).toBe(1);
      expect(await count('image_assets')).toBe(1);
    });

    it('RESTRICTs deleting an image a note still references', async () => {
      await insertNote();
      await adapter.run('INSERT INTO image_assets (id, mime_type, file_name) VALUES (?, ?, ?)', [
        IMAGE,
        'image/png',
        'photo.png',
      ]);
      await adapter.run(
        'INSERT INTO note_images (note_id, image_id, sort_order) VALUES (?, ?, ?)',
        [NOTE, IMAGE, 0],
      );

      await expect(adapter.run('DELETE FROM image_assets WHERE id = ?', [IMAGE])).rejects.toThrow();
    });

    it('SET NULLs the default notebook rather than blocking its deletion', async () => {
      await adapter.run('UPDATE app_state SET default_notebook_id = ? WHERE id = 1', [NOTEBOOK]);

      await adapter.run('DELETE FROM notebooks WHERE id = ?', [NOTEBOOK]);

      const [row] = await adapter.query<{ default_notebook_id: string | null }>(
        'SELECT default_notebook_id FROM app_state WHERE id = 1',
      );
      expect(row?.default_notebook_id).toBeNull();
    });
  });

  describe('ordering constraints', () => {
    it('refuses two checklist items at the same position in one note', async () => {
      await insertNote(NOTE, NOTEBOOK, 'checklist');
      await adapter.run(
        'INSERT INTO checklist_items (id, note_id, text, checked, sort_order) VALUES (?, ?, ?, ?, ?)',
        [LABEL, NOTE, 'first', 0, 0],
      );

      await expect(
        adapter.run(
          'INSERT INTO checklist_items (id, note_id, text, checked, sort_order) VALUES (?, ?, ?, ?, ?)',
          [IMAGE, NOTE, 'second', 0, 0],
        ),
      ).rejects.toThrow();
    });

    it('refuses the same image twice in one note', async () => {
      await insertNote();
      await adapter.run('INSERT INTO image_assets (id, mime_type, file_name) VALUES (?, ?, ?)', [
        IMAGE,
        'image/png',
        null,
      ]);
      await adapter.run(
        'INSERT INTO note_images (note_id, image_id, sort_order) VALUES (?, ?, ?)',
        [NOTE, IMAGE, 0],
      );

      await expect(
        adapter.run('INSERT INTO note_images (note_id, image_id, sort_order) VALUES (?, ?, ?)', [
          NOTE,
          IMAGE,
          1,
        ]),
      ).rejects.toThrow();
    });
  });

  it('never names a column last_modified or sql_deleted', async () => {
    // A table carrying both makes the Capacitor plugin rewrite DELETE into
    // UPDATE ... SET sql_deleted = 1 (Database.java:1084-1086).
    const tables = await adapter.query<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    expect(tables.length).toBeGreaterThan(0);

    for (const { name } of tables) {
      const columns = await adapter.query<{ name: string }>(`PRAGMA table_info(${name})`);
      const banned = columns
        .map((column) => column.name)
        .filter((column) => column === 'last_modified' || column === 'sql_deleted');

      expect(banned, `${name} must not use the plugin's soft-delete column names`).toEqual([]);
    }
  });

  it('declares no triggers, which the plugin cannot transport intact', async () => {
    const triggers = await adapter.query<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'trigger'",
    );

    expect(triggers).toEqual([]);
  });

  it('creates exactly the indexes the list queries need', async () => {
    const indexes = await adapter.query<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    expect(indexes.map((index) => index.name)).toEqual([
      'idx_checklist_items_note',
      'idx_note_images_image',
      'idx_note_labels_label',
      'idx_notebooks_sort',
      'idx_notes_active',
      'idx_notes_notebook',
      'idx_notes_trashed',
    ]);
  });

  it('uses the trash index for the trash query rather than scanning', async () => {
    const plan = await adapter.query<{ detail: string }>(
      'EXPLAIN QUERY PLAN SELECT id FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC',
    );

    expect(plan.map((row) => row.detail).join(' ')).toContain('idx_notes_trashed');
  });
});
