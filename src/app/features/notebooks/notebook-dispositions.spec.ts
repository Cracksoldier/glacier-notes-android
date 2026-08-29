import { describe, expect, it } from 'vitest';

import type { Notebook } from '../../core/models/notebook';
import { dispositionChoices, dispositionFor, PURGE_VALUE } from './notebook-dispositions';

function notebook(id: string, name: string): Notebook {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
  };
}

describe('notebook dispositions', () => {
  const work = notebook('work', 'Work');
  const home = notebook('home', 'Home');
  const notes = notebook('notes', 'Notes');

  it('offers the purge option first, then every other notebook', () => {
    const choices = dispositionChoices([notes, work, home], work.id, 'Delete the notes too');

    expect(choices.map((choice) => choice.label)).toEqual([
      'Delete the notes too',
      'Notes',
      'Home',
    ]);
  });

  // The repository rejects a notebook receiving its own notes, so listing it
  // would be an option that can only fail.
  it('never offers the notebook being deleted as a move target', () => {
    const choices = dispositionChoices([notes, work, home], work.id, 'purge');

    expect(choices.map((choice) => choice.value)).not.toContain(work.id);
  });

  it('maps each value to the disposition the repository expects', () => {
    const choices = dispositionChoices([notes, work], work.id, 'purge');

    expect(dispositionFor(choices, PURGE_VALUE)).toEqual({ notes: 'purge' });
    expect(dispositionFor(choices, notes.id)).toEqual({ notes: 'moveTo', targetId: notes.id });
  });

  // A dismissed alert hands back undefined, and no notebook may be deleted then.
  it('resolves nothing for a value that is not a choice', () => {
    const choices = dispositionChoices([notes, work], work.id, 'purge');

    expect(dispositionFor(choices, undefined)).toBeUndefined();
    expect(dispositionFor(choices, 'someone-elses-id')).toBeUndefined();
  });
});
