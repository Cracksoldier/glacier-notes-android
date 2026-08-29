import { Injectable, inject } from '@angular/core';
import { ActionSheetController, AlertController } from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { Notebook } from '../../core/models/notebook';
import { NotesStore } from '../notes/notes.store';
import { dispositionChoices, dispositionFor } from './notebook-dispositions';
import { NotebooksStore } from './notebooks.store';

/**
 * Every notebook dialog in the app, in one place.
 *
 * The drawer's "New notebook" row and the management page's FAB must open the
 * same prompt and validate identically, and neither component is a natural home
 * for the other's copy of it.
 *
 * Nothing here decides anything: the overlays collect a value and hand it to
 * `notebook-dispositions.ts`, which is pure and therefore testable. An Ionic
 * overlay cannot be instantiated under jsdom, so logic living inside one is
 * logic no spec can reach.
 */
@Injectable({ providedIn: 'root' })
export class NotebookPrompts {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(NotebooksStore);
  private readonly notes = inject(NotesStore);
  private readonly alerts = inject(AlertController);
  private readonly actionSheets = inject(ActionSheetController);

  async create(): Promise<Notebook | undefined> {
    const name = await this.promptForName(this.i18n.t('notebook.create'), '');
    return name === undefined ? undefined : this.store.create(name);
  }

  async rename(notebook: Notebook): Promise<void> {
    const name = await this.promptForName(this.i18n.t('common.rename'), notebook.name);
    if (name !== undefined && name !== notebook.name) {
      await this.store.rename(notebook.id, name);
    }
  }

  /** Rename / set-as-default / delete, minus whatever the notebook cannot do. */
  async actions(notebook: Notebook): Promise<void> {
    const isDefault = notebook.id === this.store.defaultId();

    const sheet = await this.actionSheets.create({
      header: notebook.name,
      buttons: [
        { text: this.i18n.t('common.rename'), role: 'rename' },
        // The repository refuses to delete the default notebook, so neither
        // action is offered for it rather than offered and then failed.
        ...(isDefault
          ? []
          : [
              { text: this.i18n.t('notebook.setDefault'), role: 'default' },
              { text: this.i18n.t('common.delete'), role: 'destructive' },
            ]),
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
    const { role } = await sheet.onDidDismiss();

    if (role === 'rename') {
      await this.rename(notebook);
    } else if (role === 'default') {
      await this.store.setDefault(notebook.id);
    } else if (role === 'destructive') {
      await this.delete(notebook);
    }
  }

  /**
   * The desktop's delete dialog: the contained-note count and, when there is
   * one, a forced choice between purging the notes and moving them.
   *
   * Counting first is what lets a single dialog cover both cases. Deleting
   * optimistically and reading the count off the `NotebookNotEmptyError` would
   * save a query but leave an empty notebook with no confirmation at all.
   */
  async delete(notebook: Notebook): Promise<void> {
    const count = await this.store.countNotes(notebook.id);
    const header = this.i18n.t('notebook.deleteTitle', { name: notebook.name });

    if (count === 0) {
      if (await this.confirmDelete(header, this.i18n.t('notebook.empty'))) {
        await this.store.remove(notebook.id);
      }
      return;
    }

    const choices = dispositionChoices(
      this.store.notebooks(),
      notebook.id,
      this.i18n.t('notebook.deleteNotes'),
    );
    const contains =
      count === 1
        ? this.i18n.t('notebook.containsOne')
        : this.i18n.t('notebook.containsMany', { count });

    const alert = await this.alerts.create({
      header,
      message: `${contains} ${this.i18n.t('notebook.moveTo')}`,
      inputs: choices.map((choice, index) => ({
        type: 'radio' as const,
        name: 'disposition',
        label: choice.label,
        value: choice.value,
        checked: index === 0,
      })),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.delete'), role: 'confirm' },
      ],
    });
    await alert.present();
    // Ionic wraps an alert's input values in `{ values }` even when, as here,
    // the radio group has a single value.
    const { data, role } = await alert.onDidDismiss<{ values: string }>();
    if (role !== 'confirm') {
      return;
    }

    const disposition = dispositionFor(choices, data?.values);
    if (disposition) {
      await this.store.remove(notebook.id, disposition);
      // The disposition purged or moved notes behind the note list's back, so
      // its cache is now wrong for every view.
      await this.notes.load();
    }
  }

  /** The notebook to move a note into, or undefined if the sheet was dismissed. */
  async pickNotebook(excludeId: string): Promise<string | undefined> {
    const targets = this.store.notebooks().filter((notebook) => notebook.id !== excludeId);
    const sheet = await this.actionSheets.create({
      header: this.i18n.t('move.heading'),
      subHeader: targets.length === 0 ? this.i18n.t('move.empty') : undefined,
      buttons: [
        ...targets.map((notebook) => ({ text: notebook.name, role: notebook.id })),
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
    const { role } = await sheet.onDidDismiss();

    return targets.some((notebook) => notebook.id === role) ? (role as string) : undefined;
  }

  /** Re-asks until the name is non-empty or the user cancels. */
  private async promptForName(header: string, initial: string): Promise<string | undefined> {
    let value = initial;
    let message: string | undefined;

    for (;;) {
      const alert = await this.alerts.create({
        header,
        ...(message !== undefined && { message }),
        inputs: [
          { name: 'name', type: 'text', value, placeholder: this.i18n.t('sidebar.notebookName') },
        ],
        buttons: [
          { text: this.i18n.t('common.cancel'), role: 'cancel' },
          { text: header, role: 'confirm' },
        ],
      });
      await alert.present();
      const { data, role } = await alert.onDidDismiss<{ values: { name: string } }>();

      if (role !== 'confirm') {
        return undefined;
      }
      value = (data?.values.name ?? '').trim();
      if (value) {
        return value;
      }
      message = this.i18n.t('notebook.nameRequired');
    }
  }

  private async confirmDelete(header: string, message: string): Promise<boolean> {
    const alert = await this.alerts.create({
      header,
      message,
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.delete'), role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }
}
