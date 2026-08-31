import { describe, expect, it } from 'vitest';

import {
  escapeLikePattern,
  noteSearchText,
  normalizeSearchText,
  searchPattern,
} from './search-text';

describe('normalizeSearchText', () => {
  it('folds ASCII case', () => {
    expect(normalizeSearchText('Shopping LIST')).toBe('shopping list');
  });

  // The whole reason `search_text` exists: SQLite's own `lower()` leaves these
  // alone, so folding them here is what makes a German collection searchable.
  it('folds German umlauts and eszett', () => {
    expect(normalizeSearchText('MÜLLER')).toBe('müller');
    expect(normalizeSearchText('STRASSE Größe ÄÖÜ')).toBe('strasse größe äöü');
  });

  it('composes decomposed input, so an IME-typed umlaut matches a precomposed one', () => {
    // Spelled with escapes because the two are indistinguishable on screen.
    const decomposed = 'Mu\u0308ller';
    const precomposed = 'M\u00fcller';
    expect(decomposed).not.toBe(precomposed);
    expect(normalizeSearchText(decomposed)).toBe(normalizeSearchText(precomposed));
  });
});

describe('noteSearchText', () => {
  it('covers title, body and every checklist item', () => {
    const text = noteSearchText('Title', 'Body', ['One', 'Two']);
    expect(text).toContain('title');
    expect(text).toContain('body');
    expect(text).toContain('one');
    expect(text).toContain('two');
  });

  it('separates fields so a query cannot straddle two of them', () => {
    const text = noteSearchText('ab', 'cd', []);
    expect(text).not.toContain('abcd');
    expect(text).toBe('ab\ncd');
  });

  it('keeps raw markdown, matching the desktop, which searches content verbatim', () => {
    expect(noteSearchText('', '**bold**', [])).toContain('**bold**');
  });
});

describe('escapeLikePattern', () => {
  it('escapes the wildcards and the escape character itself', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
    expect(escapeLikePattern('back\\slash')).toBe('back\\\\slash');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeLikePattern('milk')).toBe('milk');
  });
});

describe('searchPattern', () => {
  it('normalizes and wraps the needle', () => {
    expect(searchPattern('  MÜLLER')).toBe('%  müller%');
  });

  it('does not let a bare wildcard become a match-everything pattern', () => {
    expect(searchPattern('%')).toBe('%\\%%');
  });
});
