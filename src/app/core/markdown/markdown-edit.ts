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
 * none of them is a blockquote. `image` is not in this union although the
 * toolbar has a button for it: attaching is asynchronous and needs the picked
 * file, so it travels on its own output and lands in `insertImageReference`.
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

/**
 * Writes the canonical `![alt](glacier-img://<id>)` the desktop reads, and
 * leaves the caret after it so typing continues below the image.
 */
export function insertImageReference(
  value: string,
  selStart: number,
  selEnd: number,
  imageId: string,
  alt = '',
): EditResult {
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);
  // An image is a block: it needs its own line, or Markdown folds it into the
  // paragraph the caret was sitting in.
  const lead = before === '' || before.endsWith('\n') ? '' : '\n';
  const trail = after.startsWith('\n') ? '' : '\n';
  const markup = `${lead}![${imageAlt(alt)}](glacier-img://${imageId})${trail}`;
  // Steps over the trailing newline whether this call wrote it or the body
  // already had one. Counting only the inserted character left the caret on the
  // image's own line whenever the caret was mid-body, so the next thing typed
  // ran into the image markup.
  const caret = selStart + markup.length + (trail === '' ? 1 : 0);
  return {
    value: before + markup + after,
    selStart: caret,
    selEnd: caret,
  };
}

/**
 * Removes the image markup *and* any bare mention left behind. Both count as a
 * reference (`referencedImageIds`), so leaving one would make the collector
 * decide the image is still in use and strand the file the user just deleted.
 */
export function removeImageReference(value: string, imageId: string): string {
  const id = escapeRegExp(imageId);
  return value
    .replace(new RegExp(`!\\[[^\\]]*\\]\\(glacier-img://${id}\\)\\n?`, 'g'), '')
    .replace(new RegExp(`glacier-img://${id}`, 'g'), '');
}

/**
 * Drops every image from a body without touching its text. The note card uses
 * this so an attachment appears once, in the card's thumbnail row, instead of
 * twice — the row covers images the 600-character preview cut off anyway.
 */
export function stripImageReferences(value: string): string {
  return value.replace(/!\[[^\]]*\]\(glacier-img:\/\/[0-9a-f-]{36}\)\n?/g, '');
}

/** Brackets and newlines would end the alt text early and break the link. */
function imageAlt(alt: string): string {
  return alt.replace(/[[\]\r\n]/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const FENCE_OPEN = '```\n';
const FENCE_CLOSE = '\n```';

export function toggleCode(value: string, selStart: number, selEnd: number): EditResult {
  const selected = value.slice(selStart, selEnd);
  if (!selected.includes('\n')) {
    return wrapSelection(value, selStart, selEnd, '`');
  }
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);
  // The same before/after test `wrapSelection` does, only across the newline the
  // fence markers carry. Without it the multiline branch was insert-only and a
  // second press nested the fences, against this file's own toggling contract.
  if (before.endsWith(FENCE_OPEN) && after.startsWith(FENCE_CLOSE)) {
    return {
      value: before.slice(0, -FENCE_OPEN.length) + selected + after.slice(FENCE_CLOSE.length),
      selStart: selStart - FENCE_OPEN.length,
      selEnd: selEnd - FENCE_OPEN.length,
    };
  }
  return {
    value: before + FENCE_OPEN + selected + FENCE_CLOSE + after,
    selStart: selStart + FENCE_OPEN.length,
    selEnd: selStart + FENCE_OPEN.length + selected.length,
  };
}
