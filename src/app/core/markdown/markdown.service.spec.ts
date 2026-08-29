import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { IMAGE_FILE_STORE } from '../images/image-file-store';
import { MemoryImageFileStore } from '../images/memory-image-file-store';
import { MarkdownService } from './markdown.service';

describe('MarkdownService', () => {
  let markdown: MarkdownService;
  let files: MemoryImageFileStore;

  beforeEach(() => {
    files = new MemoryImageFileStore();
    TestBed.configureTestingModule({
      providers: [{ provide: IMAGE_FILE_STORE, useValue: files }],
    });
    markdown = TestBed.inject(MarkdownService);
  });

  describe('parsing', () => {
    it('renders GitHub-flavoured markdown', () => {
      const html = markdown.renderToHtml('# Title\n\n- one\n- two\n\n~~gone~~');

      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<li>one</li>');
      expect(html).toContain('<del>gone</del>');
    });

    it('turns single newlines into breaks', () => {
      expect(markdown.renderToHtml('one\ntwo')).toContain('<br>');
    });

    it('renders fenced code', () => {
      expect(markdown.renderToHtml('```\nnpm test\n```')).toContain('<code>');
    });
  });

  describe('sanitizing', () => {
    it('strips script tags', () => {
      const html = markdown.renderToHtml('<script>alert(1)</script>hi');

      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert(1)');
    });

    it('strips the tags the desktop forbids', () => {
      const html = markdown.renderToHtml(
        '<style>body{display:none}</style><form><input><button>x</button></form>',
      );

      expect(html).not.toContain('<style');
      expect(html).not.toContain('<form');
      expect(html).not.toContain('<input');
      expect(html).not.toContain('<button');
    });

    it('drops a javascript: href', () => {
      const html = markdown.renderToHtml('[x](javascript:alert(1))');

      expect(html).not.toContain('javascript:');
    });

    it('drops an inline event handler', () => {
      const html = markdown.renderToHtml('<a href="https://example.com" onclick="alert(1)">x</a>');

      expect(html).not.toContain('onclick');
    });

    it('adds rel="noopener" to links', () => {
      expect(markdown.renderToHtml('[x](https://example.com)')).toContain('rel="noopener"');
    });
  });

  describe('images', () => {
    it('removes a remote image entirely rather than blanking its src', () => {
      const html = markdown.renderToHtml('![alt](https://example.com/pixel.png)');

      expect(html).not.toContain('<img');
      expect(html).not.toContain('example.com');
    });

    it('removes a data: image', () => {
      const html = markdown.renderToHtml('![alt](data:image/png;base64,AAAA)');

      expect(html).not.toContain('<img');
    });

    it('keeps an app image reference', () => {
      const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
      const html = markdown.renderToHtml(`![alt](glacier-img://${id})`);

      expect(html).toContain(`src="glacier-img://${id}"`);
    });

    it('removes a malformed app image reference', () => {
      expect(markdown.renderToHtml('![alt](glacier-img://not-a-uuid)')).not.toContain('<img');
    });
  });

  describe('renderPreview', () => {
    it('truncates the source at 600 characters before parsing', () => {
      const preview = String(markdown.renderPreview(`${'x'.repeat(600)}TAIL`));

      expect(preview).toContain('…');
      expect(preview).not.toContain('TAIL');
    });

    it('leaves shorter sources untouched', () => {
      expect(String(markdown.renderPreview('short'))).not.toContain('…');
    });
  });

  describe('renderInline', () => {
    it('renders inline emphasis, code and links', () => {
      const html = markdown.renderInlineToHtml('**milk** and `eggs`');

      expect(html).toContain('<strong>milk</strong>');
      expect(html).toContain('<code>eggs</code>');
      expect(markdown.renderInlineToHtml('[x](https://example.com)')).toContain('rel="noopener"');
    });

    // A checklist item is one line in a row that already has a checkbox beside it.
    it('leaves block syntax as literal text', () => {
      const html = markdown.renderInlineToHtml('# Title\n\n- one');

      expect(html).not.toContain('<h1');
      expect(html).not.toContain('<li');
      expect(html).toContain('# Title');
    });

    it('strips scripts and the forbidden tags', () => {
      const html = markdown.renderInlineToHtml('<script>alert(1)</script><button>x</button>hi');

      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert(1)');
      expect(html).not.toContain('<button');
    });

    it('drops even an app image reference', () => {
      const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

      expect(markdown.renderInlineToHtml(`![alt](glacier-img://${id})`)).not.toContain('<img');
    });

    it('drops a javascript: href', () => {
      expect(markdown.renderInlineToHtml('[x](javascript:alert(1))')).not.toContain('javascript:');
    });
  });
});
