/**
 * Desktop `Label` (`electron/storage/models.ts`) — `{id, name}` only. The
 * Android specification adds `createdAt`/`updatedAt`; the desktop does not have
 * them and rejects nothing, but emitting them would be an invented field
 * (`docs/desktop-audit.md` §1 delta 6).
 */
export interface Label {
  id: string;
  name: string;
}
