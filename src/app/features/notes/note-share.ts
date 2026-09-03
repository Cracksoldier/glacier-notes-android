import { IMAGE_REF_PATTERN } from '../../core/models/image-asset';
import type { Note } from '../../core/models/note';
import { checklistToText } from './checklist-model';

export interface NoteShareText {
  title: string;
  text: string;
}

/**
 * The whole Markdown image, not just its URL — removing only the URL would leave
 * a bare `![alt]()` behind. The id half is `IMAGE_REF_PATTERN.source` rather than
 * a second copy, because `docs/images.md` records that what counts as an image
 * reference is one rule and a second encoding of it drifts.
 */
const MARKDOWN_IMAGE = new RegExp(`!\\[[^\\]]*\\]\\(\\s*${IMAGE_REF_PATTERN.source}[^)]*\\)`, 'g');

/**
 * What a note looks like once it leaves the app.
 *
 * Pure, and outside `NotePrompts` for the usual reason: an Ionic overlay cannot
 * be instantiated under jsdom, so anything decided inside one is unreachable
 * from a spec.
 *
 * A checklist renders in canonical order via `checklistToText`, never
 * `displayOrder` — the completed-item grouping is display state that
 * `docs/checklists.md` says must not leave the editor.
 */
export function noteShareText(note: Note): NoteShareText {
  const body =
    note.type === 'checklist' ? checklistToText(note.checklist ?? []) : withoutImages(note.content);
  const title = note.title.trim();
  return { title, text: title && body ? `${title}\n\n${body}` : title || body };
}

/**
 * `glacier-img://<id>` resolves to a file only this app can read, so a shared
 * copy of one is a dead link in whatever received it. Dropping the image leaves
 * the blank lines around it behind, hence the collapse.
 */
function withoutImages(content: string): string {
  return content
    .replace(MARKDOWN_IMAGE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
