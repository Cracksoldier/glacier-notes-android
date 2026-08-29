import type { NotebookDisposition } from '../../core/repositories/notebook.repository';
import type { Notebook } from '../../core/models/notebook';

/**
 * The delete dialog's radio options, and the answer they stand for.
 *
 * Building these outside the `AlertController` is what makes them testable: an
 * Ionic overlay cannot be instantiated under jsdom, so any decision taken inside
 * one is a decision no spec can reach. The controller only collects a `value`
 * and hands it back to `dispositionFor()`.
 */
export const PURGE_VALUE = 'purge';

export interface DispositionChoice {
  readonly value: string;
  readonly label: string;
  readonly disposition: NotebookDisposition;
}

/**
 * `notebook.deleteNotes` first, then one row per other notebook under
 * `notebook.moveTo` — the desktop's dialog order (`notebook-delete-dialog.html`).
 *
 * The notebook being deleted is excluded because the repository rejects a
 * notebook receiving its own notes, so offering it would be an option that can
 * only fail.
 */
export function dispositionChoices(
  notebooks: readonly Notebook[],
  deletingId: string,
  purgeLabel: string,
): readonly DispositionChoice[] {
  const targets = notebooks
    .filter((notebook) => notebook.id !== deletingId)
    .map((notebook) => ({
      value: notebook.id,
      label: notebook.name,
      disposition: { notes: 'moveTo', targetId: notebook.id } as const,
    }));

  return [{ value: PURGE_VALUE, label: purgeLabel, disposition: { notes: 'purge' } }, ...targets];
}

export function dispositionFor(
  choices: readonly DispositionChoice[],
  value: unknown,
): NotebookDisposition | undefined {
  return choices.find((choice) => choice.value === value)?.disposition;
}
