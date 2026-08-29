import type { TranslationKey } from '../../core/localization/en';
import type { Note } from '../../core/models/note';
import type { NoteView } from '../../core/repositories/note-queries';

/**
 * What the note action sheet offers, and what each answer means.
 *
 * Built outside the `ActionSheetController` so it can be tested: an Ionic
 * overlay cannot be instantiated under jsdom, so a decision taken inside one is
 * a decision no spec can reach — the same rule `notebook-dispositions.ts`
 * follows.
 */
export type NoteAction =
  | 'pin'
  | 'unpin'
  | 'color'
  | 'labels'
  | 'archive'
  | 'unarchive'
  | 'trash'
  | 'restore'
  | 'deleteForever';

export interface NoteActionChoice {
  readonly action: NoteAction;
  readonly labelKey: TranslationKey;
  readonly destructive?: true;
}

/**
 * A trashed note offers only restore and delete-forever.
 *
 * Everything else is withheld rather than offered and then failed — the M07
 * precedent. It also protects an invariant in `NotesStore`: `sortActiveNotes`
 * encodes the active ordering, not the trash's `deleted_at DESC`, so pinning or
 * recolouring from the trash view would re-sort that list wrongly. There is no
 * such action to reach.
 */
export function noteActionChoices(note: Note, view: NoteView['kind']): readonly NoteActionChoice[] {
  if (view === 'trashed') {
    return [
      { action: 'restore', labelKey: 'note.restore' },
      { action: 'deleteForever', labelKey: 'note.deleteForever', destructive: true },
    ];
  }

  return [
    note.pinned
      ? ({ action: 'unpin', labelKey: 'note.unpin' } as const)
      : ({ action: 'pin', labelKey: 'note.pin' } as const),
    { action: 'color', labelKey: 'note.color' },
    { action: 'labels', labelKey: 'note.labels' },
    note.archived
      ? ({ action: 'unarchive', labelKey: 'note.unarchive' } as const)
      : ({ action: 'archive', labelKey: 'note.archive' } as const),
    { action: 'trash', labelKey: 'note.moveToTrash', destructive: true },
  ];
}

export function noteActionFor(
  choices: readonly NoteActionChoice[],
  value: unknown,
): NoteAction | undefined {
  return choices.find((choice) => choice.action === value)?.action;
}
