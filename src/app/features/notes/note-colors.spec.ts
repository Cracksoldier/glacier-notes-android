import { describe, expect, it } from 'vitest';

import { NOTE_COLORS, isNoteColor, noteColorVar } from './note-colors';

describe('note colours', () => {
  // The desktop's eight names in its own order (docs/desktop-audit.md §2). A
  // rename or a reorder here silently changes what a .glacier.json means.
  it('carries the desktop palette names verbatim', () => {
    expect(NOTE_COLORS).toEqual([
      'red',
      'orange',
      'yellow',
      'green',
      'teal',
      'blue',
      'purple',
      'pink',
    ]);
  });

  it('maps a known name to its theme variable', () => {
    expect(noteColorVar('teal')).toBe('var(--note-teal)');
  });

  // A newer desktop build can export a colour this app has never heard of; such
  // a note must still render, uncoloured.
  it('degrades an unknown or absent colour to no colour', () => {
    expect(noteColorVar('chartreuse')).toBeNull();
    expect(noteColorVar(undefined)).toBeNull();
    expect(noteColorVar('')).toBeNull();
  });

  it('recognises exactly the palette names', () => {
    expect(isNoteColor('pink')).toBe(true);
    expect(isNoteColor('PINK')).toBe(false);
    expect(isNoteColor(null)).toBe(false);
  });
});
