/**
 * Wrapping search matches in `<mark>`, ported from the desktop's
 * `src/app/core/markdown/highlight.ts`.
 *
 * `highlightHtml` runs **after** DOMPurify and touches text nodes only, so the
 * query string can never become markup and no existing tag or attribute is
 * altered. Running it before sanitizing, or by string replacement, would hand an
 * attacker the note body as an injection point.
 *
 * One deliberate divergence from `search-text.ts`: matching here folds with a
 * bare `toLowerCase()` and does *not* NFC-normalize, although the query that
 * produced these results did. Normalizing changes the string's length —
 * `'Müller'` is seven characters and its NFC form is six — and the offsets
 * below index back into the original text, so a normalized haystack would mark
 * the wrong characters. The cost is a missing highlight on decomposed text that
 * the row query still matched; the guard in `splitText` keeps it to that rather
 * than letting it become a wrong one.
 */

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Case-insensitive segmentation of plain text into match / non-match runs. */
export function splitText(text: string, query: string): TextSegment[] {
  const whole: TextSegment[] = [{ text, match: false }];
  const needle = query.trim().toLowerCase();
  if (!needle || !text) {
    return whole;
  }

  const lower = text.toLowerCase();
  // Folding is length-preserving for everything this app displays, but not in
  // general: `'İ'.toLowerCase()` is two characters. Where it is not, every
  // offset after it is wrong, so nothing is marked rather than the wrong run.
  if (lower.length !== text.length) {
    return whole;
  }

  const segments: TextSegment[] = [];
  let pos = 0;
  for (let index = lower.indexOf(needle, pos); index !== -1; index = lower.indexOf(needle, pos)) {
    if (index > pos) {
      segments.push({ text: text.slice(pos, index), match: false });
    }
    segments.push({ text: text.slice(index, index + needle.length), match: true });
    pos = index + needle.length;
  }
  if (pos < text.length) {
    segments.push({ text: text.slice(pos), match: false });
  }
  return segments.length > 0 ? segments : whole;
}

/** Wraps query matches in already-sanitized HTML with `<mark>`. */
export function highlightHtml(html: string, query: string): string {
  if (!query.trim()) {
    return html;
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  // Collected before mutating: replacing a node while the walker is positioned
  // on it invalidates the traversal.
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node as Text);
  }

  for (const node of textNodes) {
    const segments = splitText(node.data, query);
    if (!segments.some((segment) => segment.match)) {
      continue;
    }
    const fragment = document.createDocumentFragment();
    for (const segment of segments) {
      if (segment.match) {
        const mark = document.createElement('mark');
        // `textContent`, never `innerHTML`: this is the line that keeps the
        // query a string rather than markup.
        mark.textContent = segment.text;
        fragment.append(mark);
      } else {
        fragment.append(document.createTextNode(segment.text));
      }
    }
    node.replaceWith(fragment);
  }
  return template.innerHTML;
}
