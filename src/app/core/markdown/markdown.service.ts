import { Injectable, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Renders note bodies to HTML. Ported from the desktop's
 * src/app/core/markdown/markdown.service.ts, including its parser options and
 * sanitizer configuration, so the same document produces the same output in
 * both apps -- which matters once M12 round-trips `.glacier.json` between them.
 *
 * Not ported: the search-highlight argument (M11), which would be dead code here.
 */

const PREVIEW_SOURCE_LIMIT = 600;

const GLACIER_IMG_SRC = /^glacier-img:\/\/[0-9a-f-]{36}$/;

// DOMPurify's default URI allow-list plus the app's glacier-img scheme. The
// scheme is kept even though M10 owns image storage: the regex is not
// reconstructible from first principles, and until real ids exist the hook
// below drops every image anyway.
const ALLOWED_URI =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|glacier-img):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('rel', 'noopener');
      }
      // Only app-stored images may render. The whole node goes, not just the
      // src, so no empty <img> boxes remain -- and so a remote URL never
      // reaches the network. The CSP in index.html is the backstop.
      if (node.tagName === 'IMG' && !GLACIER_IMG_SRC.test(node.getAttribute('src') ?? '')) {
        node.remove();
      }
    });
  }

  /**
   * The only place allowed to bypass Angular's sanitizer: DOMPurify has already
   * run, and the CSP is the second line of defence.
   */
  render(markdown: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.renderToHtml(markdown));
  }

  /** Card previews. Truncates the *source* first, so a long note costs one short parse. */
  renderPreview(markdown: string): SafeHtml {
    return this.render(
      markdown.length > PREVIEW_SOURCE_LIMIT
        ? `${markdown.slice(0, PREVIEW_SOURCE_LIMIT)}…`
        : markdown,
    );
  }

  /**
   * Checklist item text. Inline-only — bold, italic, code and links, but no
   * headings, lists or blockquotes, since an item is one line inside a row that
   * has a checkbox next to it. Images are forbidden outright rather than left
   * to the `afterSanitizeAttributes` hook: an item is not a place for one.
   */
  renderInline(markdown: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.renderInlineToHtml(markdown));
  }

  /** Exposed for the same reason as `renderToHtml`. */
  renderInlineToHtml(markdown: string): string {
    const html = marked.parseInline(markdown, { gfm: true, breaks: true, async: false });
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: ['img', 'style', 'form', 'input', 'button'],
      ALLOWED_URI_REGEXP: ALLOWED_URI,
    });
  }

  /** The sanitized string, exposed so specs can assert on markup rather than on a SafeHtml box. */
  renderToHtml(markdown: string): string {
    const html = marked.parse(markdown, { gfm: true, breaks: true, async: false });
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: ['style', 'form', 'input', 'button'],
      ALLOWED_URI_REGEXP: ALLOWED_URI,
    });
  }
}
