import { describe, expect, it } from 'vitest';

import { stripBom } from './strip-bom';

describe('stripBom', () => {
  /** The escape, not the character: a literal BOM is invisible in a diff. */
  const BOM = '\uFEFF';

  it('removes a leading byte order mark', () => {
    expect(stripBom(`${BOM}{"a":1}`)).toBe('{"a":1}');
  });

  it('leaves text without one untouched', () => {
    expect(stripBom('{"a":1}')).toBe('{"a":1}');
    expect(stripBom('')).toBe('');
  });

  /** U+FEFF is a zero-width no-break space anywhere but the first character. */
  it('removes only the first one', () => {
    expect(stripBom(`${BOM}${BOM}x`)).toBe(`${BOM}x`);
    expect(stripBom(`a${BOM}b`)).toBe(`a${BOM}b`);
  });

  /**
   * The whole point: a desktop editor may save a BOM, the native read hands back
   * the bytes as they are, and `JSON.parse` rejects it with a message quoting
   * the file's own content.
   */
  it('makes a BOM-prefixed export parseable', () => {
    expect(() => JSON.parse(`${BOM}{"format":"glacier-notes-export"}`)).toThrow();
    expect(JSON.parse(stripBom(`${BOM}{"format":"glacier-notes-export"}`))).toEqual({
      format: 'glacier-notes-export',
    });
  });
});
