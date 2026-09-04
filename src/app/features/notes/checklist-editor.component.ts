import {
  afterEveryRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IonReorder, IonReorderGroup, type ItemReorderEventDetail } from '@ionic/angular';

import { I18nService } from '../../core/localization/i18n.service';
import type { ChecklistItem } from '../../core/models/checklist-item';
import { faGripVertical, faPlus, faXmark } from '../../shared/utilities/glacier-icons';
import {
  displayOrder,
  insertItemAfter,
  newItem,
  removeItem,
  reorderItems,
} from './checklist-model';

/**
 * The desktop's checklist editor with its HTML5 drag-and-drop replaced by
 * `ion-reorder-group`: `dragstart` never fires from a touch screen. The pure
 * functions in `checklist-model.ts` are shared unchanged, so the two apps agree
 * on what a reorder means.
 */
@Component({
  selector: 'app-checklist-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent, IonReorder, IonReorderGroup],
  template: `
    <div class="checklist" role="list" [attr.aria-label]="i18n.t('a11y.checklistItems')">
      <ion-reorder-group [disabled]="false" (ionItemReorder)="onReorder($event)">
        @for (item of displayed(); track item.id; let i = $index) {
          <div class="checklist__row" role="listitem">
            <!-- ion-reorder exposes no ARIA role, and a name is prohibited on a
                 role-less element, so an aria-label here is silently dropped.
                 The handle must carry hidden text instead. -->
            <ion-reorder class="checklist__handle">
              <fa-icon [icon]="gripIcon" />
              <span class="glacier-sr-only">{{ i18n.t('checklist.dragToReorder') }}</span>
            </ion-reorder>

            <input
              class="checklist__check"
              type="checkbox"
              [checked]="item.checked"
              (change)="toggle(item)"
              [attr.aria-label]="item.text || i18n.t('checklist.itemPlaceholder')"
            />

            <input
              #itemInput
              class="checklist__text"
              type="text"
              [class.checklist__text--checked]="item.checked"
              [value]="item.text"
              [placeholder]="i18n.t('checklist.itemPlaceholder')"
              [attr.aria-label]="i18n.t('a11y.checklistItem', { position: i + 1 })"
              (input)="onTextInput(item, $any($event.target).value)"
              (keydown)="onKeydown($event, i)"
            />

            <button
              class="checklist__remove"
              type="button"
              (click)="removeAt(i)"
              [attr.aria-label]="i18n.t('checklist.removeItem')"
            >
              <fa-icon [icon]="removeIcon" />
            </button>
          </div>
        }
      </ion-reorder-group>

      <button class="checklist__add" type="button" (click)="addItem()">
        <fa-icon [icon]="addIcon" />
        <span>{{ i18n.t('checklist.addItem') }}</span>
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .checklist__row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 0;
    }

    .checklist__handle {
      padding: 10px 4px;
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .checklist__check {
      flex: none;
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--color-accent);
    }

    .checklist__text {
      flex: 1 1 auto;
      min-width: 0;
      padding: 10px 0;
      border: none;
      background: transparent;
      color: var(--color-text);
      font: inherit;
      font-size: 15px;
    }

    .checklist__text:focus {
      outline: none;
    }

    .checklist__text--checked {
      color: var(--color-text-muted);
      text-decoration: line-through;
    }

    .checklist__remove {
      flex: none;
      padding: 10px;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .checklist__add {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 12px 4px;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      font: inherit;
      font-size: 15px;
      text-align: start;
    }
  `,
})
export class ChecklistEditorComponent {
  readonly i18n = inject(I18nService);

  /**
   * A `model()` rather than an input/output pair for the desktop's reason: a
   * handler that mutates twice in one tick would otherwise read the pre-mutation
   * array back out of the input.
   */
  readonly items = model.required<ChecklistItem[]>();
  readonly moveCheckedToBottom = input.required<boolean>();

  readonly gripIcon = faGripVertical;
  readonly removeIcon = faXmark;
  readonly addIcon = faPlus;

  protected readonly displayed = computed(() =>
    displayOrder(this.items(), this.moveCheckedToBottom()),
  );

  private readonly inputRefs = viewChildren<ElementRef<HTMLInputElement>>('itemInput');
  private pendingFocusId: string | null = null;

  constructor() {
    afterEveryRender(() => {
      if (this.pendingFocusId === null) {
        return;
      }
      const index = this.displayed().findIndex((item) => item.id === this.pendingFocusId);
      this.pendingFocusId = null;
      this.inputRefs()[index]?.nativeElement.focus();
    });
  }

  protected toggle(item: ChecklistItem): void {
    this.items.update((items) =>
      items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
    );
  }

  protected onTextInput(item: ChecklistItem, text: string): void {
    this.items.update((items) => items.map((i) => (i.id === item.id ? { ...i, text } : i)));
  }

  protected addItem(): void {
    const item = newItem('', this.items().length);
    this.pendingFocusId = item.id;
    this.items.update((items) => [...items, item]);
  }

  /**
   * The row is placed after the anchor's *canonical* neighbour, which with
   * "move checked to bottom" on is not always the row below it on screen. That
   * is the cost of never writing the display grouping back — see
   * `insertItemAfter`.
   */
  protected insertAfter(displayIndex: number): void {
    const anchor = this.displayed()[displayIndex];
    const item = newItem('', 0);
    this.pendingFocusId = item.id;
    this.items.update((items) => insertItemAfter(items, anchor.id, item));
  }

  protected removeAt(displayIndex: number): void {
    const { id } = this.displayed()[displayIndex];
    this.items.update((items) => removeItem(items, id));
  }

  protected onKeydown(event: KeyboardEvent, displayIndex: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.insertAfter(displayIndex);
    } else if (event.key === 'Backspace' && (event.target as HTMLInputElement).value === '') {
      event.preventDefault();
      const previous = this.displayed()[displayIndex - 1];
      this.pendingFocusId = previous?.id ?? null;
      this.removeAt(displayIndex);
    }
  }

  /**
   * `complete(false)` tells Ionic to put its own dragged node back. The signal
   * write has already re-ordered the list, and letting Ionic move the DOM as
   * well would leave Angular's view order out of step with the real one.
   */
  protected onReorder(event: CustomEvent<ItemReorderEventDetail>): void {
    const { from, to, complete } = event.detail;
    if (from !== to) {
      this.items.set(reorderItems(this.items(), from, to, this.moveCheckedToBottom()));
    }
    complete(false);
  }
}
