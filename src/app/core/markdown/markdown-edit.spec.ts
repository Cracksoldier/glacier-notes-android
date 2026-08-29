import { describe, expect, it } from 'vitest';

import {
  applyToolbarAction,
  insertImageReference,
  insertLink,
  orderedList,
  prefixLines,
  removeImageReference,
  stripImageReferences,
  type ToolbarAction,
  toggleCode,
  wrapSelection,
} from './markdown-edit';

const ID = '11111111-2222-3333-4444-555555555555';

describe('wrapSelection', () => {
  it('wraps a selection and keeps it selected', () => {
    const result = wrapSelection('hello world', 6, 11, '**');

    expect(result.value).toBe('hello **world**');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('world');
  });

  it('unwraps when the markers are already around the selection', () => {
    const result = wrapSelection('hello **world**', 8, 13, '**');

    expect(result.value).toBe('hello world');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('world');
  });

  it('leaves the caret between the markers when nothing is selected', () => {
    const result = wrapSelection('hello ', 6, 6, '*');

    expect(result.value).toBe('hello **');
    expect(result.selStart).toBe(7);
    expect(result.selEnd).toBe(7);
  });

  it('round-trips: wrapping then unwrapping the same range restores the text', () => {
    const wrapped = wrapSelection('abc', 0, 3, '**');
    const unwrapped = wrapSelection(wrapped.value, wrapped.selStart, wrapped.selEnd, '**');

    expect(unwrapped.value).toBe('abc');
  });
});

describe('prefixLines', () => {
  it('prefixes the caret line even when the caret sits mid-line', () => {
    const result = prefixLines('first\nsecond', 8, 8, '# ');

    expect(result.value).toBe('first\n# second');
  });

  it('prefixes every line of a multi-line selection', () => {
    const result = prefixLines('one\ntwo\nthree', 0, 13, '- ');

    expect(result.value).toBe('- one\n- two\n- three');
  });

  it('extends backwards to the start of the first touched line', () => {
    // Selection starts inside "one", so the whole line must still be prefixed.
    const result = prefixLines('one\ntwo', 1, 7, '> ');

    expect(result.value).toBe('> one\n> two');
  });

  it('removes the prefix when every selected line already has it', () => {
    const result = prefixLines('- one\n- two', 0, 11, '- ');

    expect(result.value).toBe('one\ntwo');
  });

  it('adds to all lines when only some are prefixed', () => {
    const result = prefixLines('- one\ntwo', 0, 9, '- ');

    expect(result.value).toBe('- - one\n- two');
  });

  it('shifts the selection start past the prefix it just inserted', () => {
    // The desktop moves selStart by the prefix length, so the selection still
    // begins at the user's text rather than at the marker it did not type.
    const result = prefixLines('one\ntwo', 0, 7, '## ');

    expect(result.value).toBe('## one\n## two');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('one\n## two');
  });
});

describe('orderedList', () => {
  it('numbers each line from one', () => {
    const result = orderedList('one\ntwo\nthree', 0, 13);

    expect(result.value).toBe('1. one\n2. two\n3. three');
  });

  it('numbers relative to the first selected line, not the document', () => {
    const result = orderedList('intro\none\ntwo', 6, 13);

    expect(result.value).toBe('intro\n1. one\n2. two');
  });

  it('strips the numbering when every line is already numbered', () => {
    const result = orderedList('1. one\n2. two', 0, 13);

    expect(result.value).toBe('one\ntwo');
  });

  it('numbers a single line under a collapsed caret', () => {
    const result = orderedList('todo', 2, 2);

    expect(result.value).toBe('1. todo');
  });
});

describe('insertLink', () => {
  it('uses the selection as the link text and selects the URL placeholder', () => {
    const result = insertLink('see docs here', 4, 8);

    expect(result.value).toBe('see [docs](https://) here');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('https://');
  });

  it('falls back to placeholder text when nothing is selected', () => {
    const result = insertLink('', 0, 0);

    expect(result.value).toBe('[link](https://)');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('https://');
  });
});

describe('toggleCode', () => {
  it('wraps a single-line selection in backticks', () => {
    const result = toggleCode('run npm test now', 4, 12);

    expect(result.value).toBe('run `npm test` now');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('npm test');
  });

  it('unwraps a single-line selection that is already code', () => {
    const result = toggleCode('run `npm test` now', 5, 13);

    expect(result.value).toBe('run npm test now');
  });

  it('uses a fence when the selection spans lines', () => {
    const result = toggleCode('a\nb', 0, 3);

    expect(result.value).toBe('```\na\nb\n```');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('a\nb');
  });

  // The single-line branch has always toggled; the fenced one only inserted, so
  // a second press nested the fences instead of removing them.
  it('removes a fence it already applied rather than nesting a second one', () => {
    const once = toggleCode('a\nb', 0, 3);
    const twice = toggleCode(once.value, once.selStart, once.selEnd);

    expect(twice.value).toBe('a\nb');
    expect(twice.value.slice(twice.selStart, twice.selEnd)).toBe('a\nb');
  });

  it('leaves surrounding text in place when it removes a fence', () => {
    const once = toggleCode('intro\na\nb\nend', 6, 9);
    const twice = toggleCode(once.value, once.selStart, once.selEnd);

    expect(twice.value).toBe('intro\na\nb\nend');
  });
});

describe('applyToolbarAction', () => {
  const cases: [ToolbarAction, string][] = [
    ['bold', '**note**'],
    ['italic', '*note*'],
    ['h1', '# note'],
    ['h2', '## note'],
    ['ul', '- note'],
    ['ol', '1. note'],
    ['quote', '> note'],
    ['link', '[note](https://)'],
    ['code', '`note`'],
  ];

  it.each(cases)('maps %s onto the whole selection', (action, expected) => {
    expect(applyToolbarAction(action, 'note', 0, 4).value).toBe(expected);
  });

  it('toggles back off when applied twice', () => {
    for (const [action] of cases) {
      // `link` inserts a template rather than toggling a marker.
      if (action === 'link') {
        continue;
      }
      const once = applyToolbarAction(action, 'note', 0, 4);
      const twice = applyToolbarAction(action, once.value, once.selStart, once.selEnd);

      expect(twice.value, action).toBe('note');
    }
  });
});

describe('insertImageReference', () => {
  it('writes the canonical reference the desktop reads', () => {
    expect(insertImageReference('', 0, 0, ID).value).toBe(`![](glacier-img://${ID})\n`);
  });

  it('gives the image its own line rather than folding it into a paragraph', () => {
    const result = insertImageReference('text', 4, 4, ID);

    expect(result.value).toBe(`text\n![](glacier-img://${ID})\n`);
  });

  it('adds no blank line when the caret already sits on one', () => {
    expect(insertImageReference('text\n', 5, 5, ID).value).toBe(`text\n![](glacier-img://${ID})\n`);
  });

  it('leaves the caret after the markup so typing continues below the image', () => {
    const result = insertImageReference('', 0, 0, ID);

    expect(result.selStart).toBe(result.value.length);
    expect(result.selEnd).toBe(result.selStart);
  });

  // The caret used to stop short of a newline the body already had, which put
  // it on the image's own line — the one place the docstring promises it is not.
  it('steps over a newline the body already had, not only one it wrote', () => {
    const result = insertImageReference('one\n\ntwo', 4, 4, ID);

    expect(result.value).toBe(`one\n![](glacier-img://${ID})\ntwo`);
    expect(result.value.slice(result.selStart)).toBe('two');
  });

  it('sanitizes an alt text that would otherwise end the link early', () => {
    const result = insertImageReference('', 0, 0, ID, 'a [b] c\nd');

    expect(result.value).toBe(`![a  b  c d](glacier-img://${ID})\n`);
  });
});

describe('removeImageReference', () => {
  it('takes the markup and the line it occupied', () => {
    expect(removeImageReference(`one\n![a](glacier-img://${ID})\ntwo`, ID)).toBe('one\ntwo');
  });

  /**
   * The collector reads a bare mention as a reference too, so leaving one would
   * make it decide the image is still in use and strand the file.
   */
  it('takes a bare mention as well as the markup', () => {
    expect(removeImageReference(`see glacier-img://${ID} there`, ID)).toBe('see  there');
  });

  it('leaves another image alone', () => {
    const other = '99999999-8888-7777-6666-555555555555';
    const value = `![a](glacier-img://${ID})\n![b](glacier-img://${other})\n`;

    expect(removeImageReference(value, other)).toBe(`![a](glacier-img://${ID})\n`);
  });
});

describe('stripImageReferences', () => {
  it('removes every image and keeps the text between them', () => {
    const other = '99999999-8888-7777-6666-555555555555';
    const value = `one\n![a](glacier-img://${ID})\ntwo\n![b](glacier-img://${other})\n`;

    expect(stripImageReferences(value)).toBe('one\ntwo\n');
  });

  it('leaves a remote image, which is not ours to hide', () => {
    const value = '![a](https://example.com/a.png)';

    expect(stripImageReferences(value)).toBe(value);
  });
});
