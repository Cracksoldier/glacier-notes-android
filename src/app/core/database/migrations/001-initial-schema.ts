import { newId, nowIso } from '../../models/entity-id';
import { DEFAULT_NOTEBOOK_NAME } from '../../models/notebook';
import type { DatabaseAdapter } from '../database-adapter';
import type { Migration } from './migration';

/**
 * The v1 schema.
 *
 * The desktop persists JSON files and has no schema of its own, so none of this
 * is transcribed — every constraint is a decision. `docs/database.md` records
 * why each `ON DELETE` is what it is; the short version is that the desktop
 * performs its cascades explicitly in application code, and a database-level
 * cascade would take that sequencing away from us.
 *
 * `STRICT` throughout, so a column typed `TEXT` cannot quietly hold an integer.
 * Booleans are `INTEGER` with a `CHECK (x IN (0,1))` — SQLite has no boolean.
 *
 * No column is ever named `last_modified` or `sql_deleted`. A table carrying
 * both makes the Capacitor plugin rewrite `DELETE` into
 * `UPDATE ... SET sql_deleted = 1` (`Database.java:1084-1086`), silently turning
 * every delete into a soft delete. `schema.spec.ts` enforces this.
 *
 * No triggers: the plugin's `";\n"` statement splitter shreds a trigger body.
 */
const STATEMENTS: readonly string[] = [
  `CREATE TABLE notebooks (
     id         TEXT PRIMARY KEY,
     name       TEXT NOT NULL,
     color      TEXT,
     sort_order INTEGER NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   ) STRICT`,

  // Singleton row. The default notebook is a real foreign key rather than a
  // preference because it travels in the export envelope and must be set
  // atomically with the notebook it points at.
  `CREATE TABLE app_state (
     id                  INTEGER PRIMARY KEY CHECK (id = 1),
     default_notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL
   ) STRICT`,

  `CREATE TABLE labels (
     id   TEXT PRIMARY KEY,
     name TEXT NOT NULL
   ) STRICT`,

  `CREATE TABLE notes (
     id          TEXT PRIMARY KEY,
     notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE RESTRICT,
     type        TEXT NOT NULL CHECK (type IN ('text', 'checklist')),
     title       TEXT NOT NULL,
     content     TEXT NOT NULL,
     color       TEXT,
     pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
     archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
     deleted_at  TEXT,
     created_at  TEXT NOT NULL,
     updated_at  TEXT NOT NULL
   ) STRICT`,

  `CREATE TABLE note_labels (
     note_id  TEXT NOT NULL REFERENCES notes(id)  ON DELETE CASCADE,
     label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
     PRIMARY KEY (note_id, label_id)
   ) STRICT`,

  `CREATE TABLE checklist_items (
     id         TEXT PRIMARY KEY,
     note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
     text       TEXT NOT NULL,
     checked    INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0, 1)),
     sort_order INTEGER NOT NULL,
     UNIQUE (note_id, sort_order)
   ) STRICT`,

  `CREATE TABLE image_assets (
     id        TEXT PRIMARY KEY,
     mime_type TEXT NOT NULL,
     file_name TEXT
   ) STRICT`,

  // RESTRICT, not CASCADE: this junction only knows the ids a note *declares*.
  // An image is also referenced if it merely appears as `glacier-img://<id>` in
  // the Markdown body, so deleting the row here cannot prove the file is unused.
  `CREATE TABLE note_images (
     note_id    TEXT NOT NULL REFERENCES notes(id)        ON DELETE CASCADE,
     image_id   TEXT NOT NULL REFERENCES image_assets(id) ON DELETE RESTRICT,
     sort_order INTEGER NOT NULL,
     PRIMARY KEY (note_id, image_id),
     UNIQUE (note_id, sort_order)
   ) STRICT`,

  'CREATE INDEX idx_notebooks_sort ON notebooks (sort_order)',

  // The two list queries the app actually issues, both of which exclude trash:
  // one notebook's notes, and all notes filtered by archived. Pinned-first then
  // newest-first is the desktop's order, so the index carries it.
  `CREATE INDEX idx_notes_notebook ON notes (notebook_id, pinned DESC, updated_at DESC)
     WHERE deleted_at IS NULL`,
  `CREATE INDEX idx_notes_active ON notes (archived, pinned DESC, updated_at DESC)
     WHERE deleted_at IS NULL`,
  'CREATE INDEX idx_notes_trashed ON notes (deleted_at DESC) WHERE deleted_at IS NOT NULL',

  'CREATE INDEX idx_note_labels_label ON note_labels (label_id)',
  'CREATE INDEX idx_checklist_items_note ON checklist_items (note_id, sort_order)',
  'CREATE INDEX idx_note_images_image ON note_images (image_id)',
];

/**
 * A fresh database is never observable without a notebook: `notes.notebook_id`
 * is `NOT NULL`, so the first note cannot be written without one. Seeding here
 * — inside the migration's transaction — means there is no window in which the
 * app is running against an empty, unusable database.
 *
 * Matches the desktop, which creates a notebook named "Notes" with
 * `sortOrder: 0` on first run (`electron/storage/notebook-repo.ts:41-52`).
 */
async function seedDefaultNotebook(adapter: DatabaseAdapter): Promise<void> {
  const id = newId();
  const now = nowIso();

  await adapter.run(
    'INSERT INTO notebooks (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, DEFAULT_NOTEBOOK_NAME, null, 0, now, now],
  );
  await adapter.run('INSERT INTO app_state (id, default_notebook_id) VALUES (1, ?)', [id]);
}

export const initialSchema: Migration = {
  version: 1,
  name: 'initial-schema',
  statements: STATEMENTS,
  seed: seedDefaultNotebook,
};
