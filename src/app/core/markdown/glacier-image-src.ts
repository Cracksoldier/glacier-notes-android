/**
 * Rewrites `src="glacier-img://<id>"` to something the WebView can actually
 * load, and records the id in `data-image-id` so a tap can identify what was
 * hit without parsing the URL back.
 *
 * The desktop solves this with `glacier-img.pipe.ts` plus an Electron protocol
 * handler; Android has no protocol handler to register without native code, so
 * the substitution happens here, after DOMPurify and before the HTML is bound.
 *
 * Runs on sanitized markup only, which is why matching `src` with a regex is
 * safe: DOMPurify has already normalized the attribute and dropped every `img`
 * whose `src` is not exactly this shape.
 */

const SANITIZED_IMG_SRC = /src="glacier-img:\/\/([0-9a-f-]{36})"/g;

export function resolveImageSources(html: string, url: (id: string) => string): string {
  return html.replace(
    SANITIZED_IMG_SRC,
    (_match, id: string) => `src="${escapeAttribute(url(id))}" data-image-id="${id}"`,
  );
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
