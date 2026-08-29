import { describe, expect, it } from 'vitest';

import { resolveImageSources } from './glacier-image-src';

const ID = '11111111-2222-3333-4444-555555555555';

describe('resolveImageSources', () => {
  it('swaps the scheme for a loadable URL and keeps the id addressable', () => {
    const html = resolveImageSources(`<img src="glacier-img://${ID}" alt="x">`, (id) => `/f/${id}`);

    expect(html).toBe(`<img src="/f/${ID}" data-image-id="${ID}" alt="x">`);
  });

  it('resolves every image in the document, not just the first', () => {
    const other = '99999999-8888-7777-6666-555555555555';
    const html = resolveImageSources(
      `<img src="glacier-img://${ID}"><img src="glacier-img://${other}">`,
      (id) => `/f/${id}`,
    );

    expect(html).toContain(`/f/${ID}`);
    expect(html).toContain(`/f/${other}`);
  });

  it('leaves anything that is not a canonical reference alone', () => {
    const untouched = '<img src="https://example.com/a.png"><a href="glacier-img://x">t</a>';

    expect(resolveImageSources(untouched, () => '/f/x')).toBe(untouched);
  });

  /** A store is free to return a query string; unescaped it would end the attribute. */
  it('escapes the URL it is handed', () => {
    const html = resolveImageSources(`<img src="glacier-img://${ID}">`, () => '/f?a=1&b="x"');

    expect(html).toContain('src="/f?a=1&amp;b=&quot;x&quot;"');
  });
});
