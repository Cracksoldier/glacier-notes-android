import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { Label } from '../../core/models/label';
import { NotesStore } from '../notes/notes.store';
import { labelCheckboxes, selectedLabelIds } from './label-selection';
import { LabelsStore } from './labels.store';

/**
 * Every label dialog in the app, mirroring `NotebookPrompts` for the same
 * reason: the drawer's "New label" row and the management page's FAB must open
 * the same prompt, and neither is a natural home for the other's copy.
 *
 * Nothing here decides anything. Overlays collect a value and hand it to
 * `label-selection.ts`, which is pure and therefore testable — an Ionic overlay
 * cannot be instantiated under jsdom.
 */
@Injectable({ providedIn: 'root' })
export class LabelPrompts {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(LabelsStore);
  private readonly notes = inject(NotesStore);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly actionSheets = inject(ActionSheetController);

  async create(): Promise<Label | undefined> {
    const name = await this.promptForName(this.i18n.t('label.create'), '');
    return name === undefined ? undefined : this.store.create(name);
  }

  async rename(label: Label): Promise<void> {
    const name = await this.promptForName(this.i18n.t('common.rename'), label.name);
    if (name !== undefined && name !== label.name) {
      await this.store.rename(label.id, name);
      // Cards show label names, so the list holds stale text until it reloads.
      await this.notes.load();
    }
  }

  async actions(label: Label): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: label.name,
      buttons: [
        { text: this.i18n.t('common.rename'), role: 'rename' },
        { text: this.i18n.t('common.delete'), role: 'destructive' },
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
    const { role } = await sheet.onDidDismiss();

    if (role === 'rename') {
      await this.rename(label);
    } else if (role === 'destructive') {
      await this.delete(label);
    }
  }

  /**
   * Unlike a notebook, deleting a label never deletes a note — the `note_labels`
   * cascade merely strips it. There is nothing to choose, so the dialog is a
   * confirmation that says so rather than a disposition picker.
   */
  async delete(label: Label): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('label.deleteTitle', { name: label.name }),
      message: this.i18n.t('label.deleteHint'),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.delete'), role: 'confirm' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') {
      return;
    }

    await this.store.remove(label.id);

    const view = this.notes.view();
    if (view.kind === 'label' && view.labelId === label.id) {
      // The view's WHERE clause now matches nothing and its title is gone.
      await this.router.navigate(['/notes']);
      return;
    }
    await this.notes.load();
  }

  /** The note's labels after the picker, or undefined if it was dismissed. */
  async pickLabels(current: readonly string[]): Promise<readonly string[] | undefined> {
    const labels = this.store.labels();
    const alert = await this.alerts.create({
      header: this.i18n.t('label.assign'),
      ...(labels.length === 0 && { message: this.i18n.t('label.noneAvailable') }),
      inputs: labelCheckboxes(labels, current).map((box) => ({
        type: 'checkbox' as const,
        label: box.label,
        value: box.value,
        checked: box.checked,
      })),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.done'), role: 'confirm' },
      ],
    });
    await alert.present();
    // Ionic wraps an alert's input values in `{ values }`; for a checkbox group
    // that is the array of checked values.
    const { data, role } = await alert.onDidDismiss<{ values: string[] }>();

    return role === 'confirm' ? selectedLabelIds(labels, data?.values) : undefined;
  }

  /** Re-asks until the name is non-empty or the user cancels. */
  private async promptForName(header: string, initial: string): Promise<string | undefined> {
    let value = initial;
    let message: string | undefined;

    for (;;) {
      const alert = await this.alerts.create({
        header,
        ...(message !== undefined && { message }),
        inputs: [{ name: 'name', type: 'text', value, placeholder: this.i18n.t('label.name') }],
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
      message = this.i18n.t('label.nameRequired');
    }
  }
}
