/**
 * Pure text transformations for the markdown toolbar, ported function-for-
 * function from the desktop's src/app/features/notes/markdown-edit.ts. Each one
 * takes the textarea value plus its selection and returns the new value plus the
 * selection to restore, so the caller does the DOM work and these stay testable
 * without a textarea.
 *
 * Every transform toggles: applying it twice to the same selection returns the
 * original text. That is what makes the buttons behave like formatting toggles
 * rather than an append-only stamp.
 */

export interface EditResult {
  value: string;
  selStart: number;
  selEnd: number;
}

/**
 * `quote` has no desktop counterpart — the desktop toolbar has nine buttons and
 * none of them is a blockquote — and the desktop's `image` is absent here until
 * M10 gives `glacier-img://` something to point at.
 */
export type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'h1'
  | 'h2'
  | 'ul'
  | 'ol'
  | 'quote'
  | 'link'
  | 'code';

/**
 * The desktop keeps this switch inside the editor component, where it needs a
 * live textarea to run. Hoisting it here keeps the whole action-to-text mapping
 * unit-testable.
 */
export function applyToolbarAction(
  action: ToolbarAction,
  value: string,
  selStart: number,
  selEnd: number,
): EditResult {
  switch (action) {
    case 'bold':
      return wrapSelection(value, selStart, selEnd, '**');
    case 'italic':
      return wrapSelection(value, selStart, selEnd, '*');
    case 'h1':
      return prefixLines(value, selStart, selEnd, '# ');
    case 'h2':
      return prefixLines(value, selStart, selEnd, '## ');
    case 'ul':
      return prefixLines(value, selStart, selEnd, '- ');
    case 'ol':
      return orderedList(value, selStart, selEnd);
    case 'quote':
      return prefixLines(value, selStart, selEnd, '> ');
    case 'link':
      return insertLink(value, selStart, selEnd);
    case 'code':
      return toggleCode(value, selStart, selEnd);
  }
}

export function wrapSelection(
  value: string,
  selStart: number,
  selEnd: number,
  marker: string,
): EditResult {
  const before = value.slice(0, selStart);
  const selected = value.slice(selStart, selEnd);
  const after = value.slice(selEnd);
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: before.slice(0, before.length - marker.length) + selected + after.slice(marker.length),
      selStart: selStart - marker.length,
      selEnd: selEnd - marker.length,
    };
  }
  return {
    value: before + marker + selected + marker + after,
    selStart: selStart + marker.length,
    selEnd: selEnd + marker.length,
  };
}

export function prefixLines(
  value: string,
  selStart: number,
  selEnd: number,
  prefix: string,
): EditResult {
  // Extend backwards to the start of the first touched line: a caret parked
  // mid-line must still prefix that whole line.
  const segmentStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const segment = value.slice(segmentStart, selEnd);
  const lines = segment.split('\n');
  const allPrefixed = lines.every((line) => line.startsWith(prefix));
  const updated = lines
    .map((line) => (allPrefixed ? line.slice(prefix.length) : prefix + line))
    .join('\n');
  const firstLineDelta = allPrefixed ? -prefix.length : prefix.length;
  return {
    value: value.slice(0, segmentStart) + updated + value.slice(selEnd),
    selStart: Math.max(segmentStart, selStart + firstLineDelta),
    selEnd: selEnd + (updated.length - segment.length),
  };
}

export function orderedList(value: string, selStart: number, selEnd: number): EditResult {
  const segmentStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const segment = value.slice(segmentStart, selEnd);
  const lines = segment.split('\n');
  const numbered = /^\d+\. /;
  const allNumbered = lines.every((line) => numbered.test(line));
  const updated = lines
    .map((line, i) => (allNumbered ? line.replace(numbered, '') : `${i + 1}. ${line}`))
    .join('\n');
  return {
    value: value.slice(0, segmentStart) + updated + value.slice(selEnd),
    selStart: segmentStart,
    selEnd: selEnd + (updated.length - segment.length),
  };
}

export function insertLink(value: string, selStart: number, selEnd: number): EditResult {
  const selected = value.slice(selStart, selEnd) || 'link';
  const placeholder = 'https://';
  const urlStart = selStart + selected.length + 3; // "[" + text + "]("
  return {
    value: `${value.slice(0, selStart)}[${selected}](${placeholder})${value.slice(selEnd)}`,
    selStart: urlStart,
    // Leaves the URL selected so typing replaces it.
    selEnd: urlStart + placeholder.length,
  };
}

export function toggleCode(value: string, selStart: number, selEnd: number): EditResult {
  const selected = value.slice(selStart, selEnd);
  if (selected.includes('\n')) {
    const inserted = '```\n' + selected + '\n```';
    return {
      value: value.slice(0, selStart) + inserted + value.slice(selEnd),
      selStart: selStart + 4,
      selEnd: selStart + 4 + selected.length,
    };
  }
  return wrapSelection(value, selStart, selEnd, '`');
}
