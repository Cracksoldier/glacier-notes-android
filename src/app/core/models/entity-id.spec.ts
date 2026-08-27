import { describe, expect, it } from 'vitest';

import {
  ENTITY_ID_PATTERN,
  isEntityId,
  newId,
  nowIso,
  requireEntityId,
  SCHEMA_VERSION,
} from './entity-id';

describe('entity ids', () => {
  it('matches the desktop pattern literally', () => {
    expect(ENTITY_ID_PATTERN.source).toBe(
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    );
    expect(ENTITY_ID_PATTERN.flags).toBe('i');
  });

  it('accepts UUID versions 1 through 5', () => {
    for (const version of ['1', '2', '3', '4', '5']) {
      expect(isEntityId(`3f2504e0-4f89-${version}1d3-9a0c-0305e82c3301`)).toBe(true);
    }
  });

  it('rejects version 0, version 6 and the wrong variant nibble', () => {
    expect(isEntityId('3f2504e0-4f89-01d3-9a0c-0305e82c3301')).toBe(false);
    expect(isEntityId('3f2504e0-4f89-61d3-9a0c-0305e82c3301')).toBe(false);
    expect(isEntityId('3f2504e0-4f89-41d3-ca0c-0305e82c3301')).toBe(false);
  });

  it('rejects non-strings and malformed values', () => {
    expect(isEntityId(undefined)).toBe(false);
    expect(isEntityId(42)).toBe(false);
    expect(isEntityId('')).toBe(false);
    expect(isEntityId('not-a-uuid')).toBe(false);
  });

  it('generates ids that satisfy its own pattern', () => {
    expect(isEntityId(newId())).toBe(true);
  });

  it('throws on an invalid id without leaking anything but the id', () => {
    expect(() => requireEntityId('nope')).toThrow('Invalid entity id: nope');
  });
});

describe('timestamps', () => {
  it('emits UTC ISO-8601 with millisecond precision', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('schema version', () => {
  it('is 1, the version the desktop writes and accepts', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
