/**
 * Transcribed from the desktop's `electron/storage/models.ts`.
 * See `docs/desktop-audit.md` §4 — these values are part of the `.glacier.json`
 * contract and must not drift.
 */

export const SCHEMA_VERSION = 1;

/** Accepts UUID versions 1–5 with RFC-4122 variant bits, exactly as the desktop does. */
export const ENTITY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEntityId(value: unknown): value is string {
  return typeof value === 'string' && ENTITY_ID_PATTERN.test(value);
}

export function requireEntityId(id: string): string {
  if (!ENTITY_ID_PATTERN.test(id)) {
    throw new Error(`Invalid entity id: ${id}`);
  }
  return id;
}

export function newId(): string {
  return crypto.randomUUID();
}

/** UTC, millisecond precision — the shape the desktop writes and validates. */
export function nowIso(): string {
  return new Date().toISOString();
}
