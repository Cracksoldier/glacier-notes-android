import { describe, expect, it } from 'vitest';

import { de } from './de';
import { en } from './en';

describe('translations', () => {
  // The Record<TranslationKey, string> typing catches a missing key but not a
  // duplicated literal, which silently drops the earlier entry.
  it('define the same keys in both languages', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it('leave no entry blank', () => {
    const blank = [...Object.entries(en), ...Object.entries(de)]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);

    expect(blank).toEqual([]);
  });
});
