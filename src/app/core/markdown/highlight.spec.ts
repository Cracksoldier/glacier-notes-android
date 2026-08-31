import { describe, expect, it } from 'vitest';

import { highlightHtml, splitText } from './highlight';

describe('splitText', () => {
  it('returns the whole text unmarked when the query is empty', () => {
    expect(splitText('Hello', '  ')).toEqual([{ text: 'Hello', match: false }]);
  });

  it('marks every occurrence, case-insensitively, keeping the original casing', () => {
    expect(splitText('Ein Kauf, ein KAUF', 'kauf')).toEqual([
      { text: 'Ein ', match: false },
      { text: 'Kauf', match: true },
      { text: ', ein ', match: false },
      { text: 'KAUF', match: true },
    ]);
  });

  it('marks inside a word, since the query is a substring test', () => {
    expect(splitText('Einkaufsliste', 'kauf')).toEqual([
      { text: 'Ein', match: false },
      { text: 'kauf', match: true },
      { text: 'sliste', match: false },
    ]);
  });

  it('folds German case both ways', () => {
    expect(splitText('MÜLLER', 'müller')).toEqual([{ text: 'MÜLLER', match: true }]);
  });

  it('reassembles into exactly the input, so nothing is lost or duplicated', () => {
    const text = 'kauf am Anfang und kauf am Ende: kauf';

    expect(
      splitText(text, 'kauf')
        .map((segment) => segment.text)
        .join(''),
    ).toBe(text);
  });

  // Folding `İ` yields two characters, which would shift every later offset.
  it('marks nothing rather than the wrong run when folding changes the length', () => {
    const text = 'İstanbul kauf';

    expect(splitText(text, 'kauf')).toEqual([{ text, match: false }]);
  });
});

describe('highlightHtml', () => {
  it('wraps a match in mark without disturbing the surrounding markup', () => {
    expect(highlightHtml('<p>Ein <strong>Kauf</strong> heute</p>', 'kauf')).toBe(
      '<p>Ein <strong><mark>Kauf</mark></strong> heute</p>',
    );
  });

  it('leaves the html untouched when the query is blank', () => {
    const html = '<p>Nothing to do</p>';

    expect(highlightHtml(html, '   ')).toBe(html);
  });

  // The property the whole after-DOMPurify placement exists for.
  it('never lets the query become markup', () => {
    const highlighted = highlightHtml('<p>a <img> b</p>', '<img>');

    expect(highlighted).not.toContain('<mark><img></mark>');
    expect(highlighted).toBe('<p>a <img> b</p>');
  });

  it('matches text only, never a tag name or an attribute value', () => {
    expect(highlightHtml('<a href="https://example.com/kauf">link</a>', 'kauf')).toBe(
      '<a href="https://example.com/kauf">link</a>',
    );
    expect(highlightHtml('<p>strong words</p>', 'strong')).toBe('<p><mark>strong</mark> words</p>');
  });

  it('escapes a match that contains markup characters', () => {
    expect(highlightHtml('<p>a &lt;b&gt; c</p>', '<b>')).toBe('<p>a <mark>&lt;b&gt;</mark> c</p>');
  });

  it('reaches every text node, not just the first', () => {
    expect(highlightHtml('<p>kauf</p><p>kauf</p>', 'kauf')).toBe(
      '<p><mark>kauf</mark></p><p><mark>kauf</mark></p>',
    );
  });
});
