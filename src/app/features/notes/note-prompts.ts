import { Injectable, inject } from '@angular/core';
import { ActionSheetController, AlertController } from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { Note } from '../../core/models/note';
import type { NoteView } from '../../core/repositories/note-queries';
import { LabelPrompts } from '../labels/label-prompts';
import { type NoteAction, noteActionChoices, noteActionFor } from './note-actions';
import { NOTE_COLORS, type NoteColor } from './note-colors';
import { NotesStore } from './notes.store';

/**
 * The note action sheet and everything it can open, in one place.
 *
 * The list page, the archive page and the trash page all raise the same sheet;
 * only the view kind differs. As with `NotebookPrompts`, the overlays decide
 * nothing — `note-actions.ts` builds the choices and resolves the answer, so
 * every branch is reachable from a spec.
 */
@Injectable({ providedIn: 'root' })
export class NotePrompts {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(NotesStore);
  private readonly labels = inject(LabelPrompts);
  private readonly alerts = inject(AlertController);
  private readonly actionSheets = inject(ActionSheetController);

  async actions(note: Note, view: NoteView['kind']): Promise<void> {
    const choices = noteActionChoices(note, view);
    const sheet = await this.actionSheets.create({
      header: this.i18n.t('note.actions'),
      buttons: [
        ...choices.map((choice) => ({
          text: this.i18n.t(choice.labelKey),
          ...(choice.destructive && { role: 'destructive' }),
          data: choice.action,
        })),
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<NoteAction>();

    const action = noteActionFor(choices, data);
    if (action) {
      await this.dispatch(note, action);
    }
  }

  async confirmEmptyTrash(count: number): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('trash.emptyTitle'),
      message:
        count === 1 ? this.i18n.t('trash.emptyHintOne') : this.i18n.t('trash.emptyHint', { count }),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.delete'), role: 'confirm' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role === 'confirm') {
      await this.store.emptyTrash();
    }
  }

  private async dispatch(note: Note, action: NoteAction): Promise<void> {
    switch (action) {
      case 'pin':
        return this.store.setPinned(note.id, true);
      case 'unpin':
        return this.store.setPinned(note.id, false);
      case 'color':
        return this.pickColor(note);
      case 'labels':
        return this.pickLabels(note);
      case 'archive':
        return this.store.setArchived(note.id, true);
      case 'unarchive':
        return this.store.setArchived(note.id, false);
      case 'trash':
        return this.store.trash(note.id);
      case 'restore':
        return this.store.restore(note.id);
      case 'deleteForever':
        return this.confirmDeleteForever(note);
    }
  }

  private async pickColor(note: Note): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('note.color'),
      cssClass: 'note-color-alert',
      inputs: [
        {
          type: 'radio' as const,
          label: this.i18n.t('note.colorNone'),
          value: '',
          checked: note.color === undefined,
        },
        ...NOTE_COLORS.map((color) => ({
          type: 'radio' as const,
          label: this.i18n.t(`color.${color}`),
          value: color,
          checked: note.color === color,
          // Read by `.note-color-alert` in global.scss to paint the swatch;
          // Ionic overlays render outside component style scope.
          cssClass: `note-color-alert__option note-color-alert__option--${color}`,
        })),
      ],
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.done'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { data, role } = await alert.onDidDismiss<{ values: string }>();
    if (role !== 'confirm') {
      return;
    }
    const value = data?.values;
    await this.store.setColor(note.id, value ? (value as NoteColor) : undefined);
  }

  private async pickLabels(note: Note): Promise<void> {
    const labelIds = await this.labels.pickLabels(note.labels);
    if (labelIds) {
      await this.store.setLabels(note.id, labelIds);
    }
  }

  private async confirmDeleteForever(note: Note): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('note.deleteForeverTitle'),
      message: this.i18n.t('note.deleteForeverHint'),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.delete'), role: 'confirm' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role === 'confirm') {
      await this.store.deleteForever(note.id);
    }
  }
}
