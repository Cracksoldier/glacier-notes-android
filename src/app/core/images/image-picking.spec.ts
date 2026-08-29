import { describe, expect, it } from 'vitest';

import { MAX_IMAGE_BYTES } from '../models/image-asset';
import { base64FromDataUrl, pickedFileName, validatePick } from './image-picking';

describe('validatePick', () => {
  it('accepts every type the desktop reads, GIF included', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(validatePick({ type, size: 1024 })).toBeUndefined();
    }
  });

  it('rejects a type the desktop cannot render', () => {
    expect(validatePick({ type: 'image/svg+xml', size: 1024 })).toBe('type');
    expect(validatePick({ type: 'application/pdf', size: 1024 })).toBe('type');
    // A picker that reports nothing is a rejection, not a default.
    expect(validatePick({ type: '', size: 1024 })).toBe('type');
  });

  it('rejects above the limit but accepts exactly at it', () => {
    expect(validatePick({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeUndefined();
    expect(validatePick({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toBe('size');
  });

  it('reports the type before the size, so the actionable failure comes first', () => {
    expect(validatePick({ type: 'image/svg+xml', size: MAX_IMAGE_BYTES + 1 })).toBe('type');
  });
});

describe('pickedFileName', () => {
  it('keeps a real name and drops a blank one', () => {
    expect(pickedFileName('holiday.png')).toBe('holiday.png');
    expect(pickedFileName('   ')).toBeUndefined();
    expect(pickedFileName('')).toBeUndefined();
  });
});

describe('base64FromDataUrl', () => {
  it('returns the payload without the media-type prefix', () => {
    expect(base64FromDataUrl('data:image/png;base64,QUJD')).toBe('QUJD');
  });

  it('returns nothing for a string that is not a data URL', () => {
    expect(base64FromDataUrl('QUJD')).toBe('');
  });
});
