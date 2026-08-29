/**
 * The desktop's eight note colours (`docs/desktop-audit.md` §2).
 *
 * The stable identifier is the bare palette *name* — `Note.color` stores
 * `"teal"`, never a hex value — because the two themes give the same name very
 * different values and a stored hex would freeze one theme's rendering into the
 * data. The values themselves live in `src/theme/glacier-theme.scss` as
 * `--note-<name>`, transcribed verbatim at M02.
 */
export const NOTE_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export function isNoteColor(value: unknown): value is NoteColor {
  return NOTE_COLORS.includes(value as NoteColor);
}

/**
 * The desktop's `noteColorVar()`: a CSS variable reference, or `null` for an
 * absent or unrecognised colour.
 *
 * Returning `null` rather than throwing is the point. A `.glacier.json` written
 * by a newer desktop build can carry a colour this app has never heard of, and
 * such a note must still open — it simply renders uncoloured.
 */
export function noteColorVar(color: string | undefined): string | null {
  return isNoteColor(color) ? `var(--note-${color})` : null;
}
