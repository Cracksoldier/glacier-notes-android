import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnDestroy,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { ImageAttachmentService } from '../../core/images/image-attachment.service';
import { IMAGE_FILE_STORE } from '../../core/images/image-file-store';
import { I18nService, type TranslationKey } from '../../core/localization/i18n.service';
import {
  applyToolbarAction,
  insertImageReference,
  removeImageReference,
  type ToolbarAction,
} from '../../core/markdown/markdown-edit';
import { MarkdownService } from '../../core/markdown/markdown.service';
import type { ChecklistItem } from '../../core/models/checklist-item';
import type { NoteType } from '../../core/models/note';
import { SettingsStore } from '../../core/preferences/settings.store';
import { NoteRepository } from '../../core/repositories/note.repository';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import {
  faArrowLeft,
  faBook,
  faCircleQuestion,
  faEye,
  faFileLines,
  faListCheck,
  faPen,
  faTag,
} from '../../shared/utilities/glacier-icons';
import { LabelPrompts } from '../labels/label-prompts';
import { LabelsStore } from '../labels/labels.store';
import { NotebookPrompts } from '../notebooks/notebook-prompts';
import { NotebooksStore } from '../notebooks/notebooks.store';
import { ChecklistEditorComponent } from './checklist-editor.component';
import { checklistToText, textToChecklist } from './checklist-model';
import { ImagePrompts, attachFailureKey } from './image-prompts';
import { MarkdownToolbarComponent } from './markdown-toolbar.component';
import { NotesStore } from './notes.store';

const SAVE_DEBOUNCE_MS = 500;

type EditorStatus = 'loading' | 'ready' | 'missing';

@Component({
  selector: 'app-note-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChecklistEditorComponent,
    EmptyStateComponent,
    FaIconComponent,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    MarkdownToolbarComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="back()" [attr.aria-label]="i18n.t('common.back')">
            <fa-icon [icon]="backIcon" />
          </ion-button>
        </ion-buttons>
        @if (status() === 'ready') {
          <ion-buttons slot="end">
            <ion-button
              class="editor__convert"
              (click)="convert()"
              [attr.aria-label]="
                isChecklist() ? i18n.t('editor.convertToText') : i18n.t('editor.convertToChecklist')
              "
            >
              <fa-icon [icon]="isChecklist() ? textNoteIcon : checklistIcon" />
            </ion-button>
            @if (!isChecklist()) {
              <ion-button
                class="editor__preview-toggle"
                (click)="previewMode.set(!previewMode())"
                [attr.aria-label]="previewMode() ? i18n.t('editor.edit') : i18n.t('editor.preview')"
              >
                <fa-icon [icon]="previewMode() ? editIcon : previewIcon" />
              </ion-button>
            }
          </ion-buttons>
        } @else {
          <ion-title>{{ i18n.t('sidebar.notes') }}</ion-title>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (status() === 'missing') {
        <app-empty-state
          [icon]="missingIcon"
          [title]="i18n.t('editor.notFound')"
          [message]="i18n.t('editor.notFoundHint')"
        />
      } @else if (status() === 'ready') {
        <div class="editor">
          <input
            class="editor__title"
            [attr.aria-label]="i18n.t('editor.titlePlaceholder')"
            [placeholder]="i18n.t('editor.titlePlaceholder')"
            [value]="title()"
            (input)="onTitleInput($any($event.target).value)"
          />

          <div class="editor__chips">
            <button
              type="button"
              class="editor__chip editor__notebook"
              (click)="chooseNotebook()"
              [attr.aria-label]="i18n.t('a11y.noteNotebook')"
            >
              <fa-icon [icon]="notebookIcon" />
              <span>{{ notebookName() }}</span>
            </button>

            <button
              type="button"
              class="editor__chip editor__labels"
              (click)="chooseLabels()"
              [attr.aria-label]="i18n.t('a11y.noteLabels')"
            >
              <fa-icon [icon]="labelIcon" />
              <span>{{ labelSummary() }}</span>
            </button>
          </div>

          @if (!isChecklist()) {
            <app-markdown-toolbar
              class="editor__toolbar"
              [disabled]="previewMode()"
              (action)="onToolbar($event)"
              (attach)="fileInput.click()"
            />
            <!-- The system picker with no plugin and no permission: Capacitor's
                 BridgeWebChromeClient turns this into an ACTION_GET_CONTENT
                 intent. No capture attribute, so the camera branch never
                 runs and CAMERA is never requested. -->
            <input
              #fileInput
              class="editor__file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              (change)="onFilePicked($event)"
            />
          }

          @if (store.saveFailed()) {
            <p class="editor__error" role="alert">{{ i18n.t('editor.saveFailed') }}</p>
          }

          @if (attachError(); as key) {
            <p class="editor__error" role="alert">{{ i18n.t(key) }}</p>
          }

          @if (!isChecklist() && imageIds().length) {
            <ul class="editor__images" [attr.aria-label]="i18n.t('a11y.noteImages')">
              @for (id of imageIds(); track id) {
                <li>
                  <button
                    type="button"
                    class="editor__thumb"
                    (click)="openImage(id)"
                    [attr.aria-label]="i18n.t('image.viewer')"
                  >
                    <img [src]="imageUrl(id)" alt="" />
                  </button>
                </li>
              }
            </ul>
          }

          @if (isChecklist()) {
            <app-checklist-editor
              class="editor__checklist"
              [items]="items()"
              (itemsChange)="onItemsChange($event)"
              [moveCheckedToBottom]="settings.moveCheckedToBottom()"
            />
          } @else if (previewMode()) {
            <div
              class="editor__preview markdown-body"
              [innerHTML]="previewHtml()"
              (click)="onPreviewClick($event)"
            ></div>
          } @else {
            <textarea
              #textarea
              class="editor__content"
              [attr.aria-label]="i18n.t('editor.contentPlaceholder')"
              [placeholder]="i18n.t('editor.contentPlaceholder')"
              [value]="content()"
              (input)="onContentInput($any($event.target).value)"
            ></textarea>
          }
        </div>
      }
    </ion-content>
  `,
  styles: `
    .editor {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      padding: 8px 12px 12px;
    }

    .editor__title {
      width: 100%;
      padding: 6px 0;
      border: none;
      background: transparent;
      color: var(--color-text);
      font-family: inherit;
      font-size: 18px;
      font-weight: 600;
    }

    .editor__title:focus {
      outline: none;
    }

    .editor__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 2px 0 6px;
    }

    .editor__chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border: none;
      border-radius: 999px;
      background-color: var(--color-surface-elevated);
      color: var(--color-text-muted);
      font-family: inherit;
      font-size: 12px;
    }

    .editor__toolbar {
      margin: 4px -12px 4px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--color-border);
    }

    .editor__file {
      display: none;
    }

    .editor__images {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
    }

    .editor__thumb {
      display: block;
      width: 64px;
      height: 64px;
      padding: 0;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background-color: var(--color-surface-elevated);
      overflow: hidden;
    }

    .editor__thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .editor__error {
      margin: 8px 0 0;
      padding: 8px 10px;
      border-radius: 8px;
      background-color: var(--color-surface-elevated);
      color: var(--color-danger-text);
      font-size: 13px;
    }

    .editor__content {
      flex: 1 1 auto;
      min-height: 40vh;
      margin-top: 8px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--color-text);
      font-family: inherit;
      font-size: 15px;
      line-height: 1.5;
      resize: none;
    }

    .editor__content:focus {
      outline: none;
    }

    .editor__preview {
      flex: 1 1 auto;
      margin-top: 8px;
      font-size: 15px;
    }

    .editor__checklist {
      margin-top: 4px;
    }
  `,
})
export class NoteEditorPage implements OnDestroy {
  readonly id = input.required<string>();

  /**
   * A query param the list's FAB sets, bound by `withComponentInputBinding`.
   * The FAB creates the row before navigating so the list never lies, and only
   * a note created that way may be discarded for being empty — a pre-existing
   * note the user empties is kept.
   */
  readonly created = input(false, { transform: booleanAttribute });

  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(NotesStore);
  private readonly notes = inject(NoteRepository);
  private readonly markdown = inject(MarkdownService);
  private readonly router = inject(Router);
  private readonly notebooks = inject(NotebooksStore);
  private readonly notebookPrompts = inject(NotebookPrompts);
  private readonly labels = inject(LabelsStore);
  private readonly labelPrompts = inject(LabelPrompts);
  private readonly attachments = inject(ImageAttachmentService);
  private readonly imageFiles = inject(IMAGE_FILE_STORE);
  private readonly imagePrompts = inject(ImagePrompts);
  protected readonly settings = inject(SettingsStore);

  protected readonly backIcon = faArrowLeft;
  protected readonly previewIcon = faEye;
  protected readonly editIcon = faPen;
  protected readonly missingIcon = faCircleQuestion;
  protected readonly notebookIcon = faBook;
  protected readonly labelIcon = faTag;
  protected readonly checklistIcon = faListCheck;
  protected readonly textNoteIcon = faFileLines;

  protected readonly title = signal('');
  protected readonly content = signal('');
  protected readonly type = signal<NoteType>('text');
  protected readonly items = signal<ChecklistItem[]>([]);
  protected readonly imageIds = signal<readonly string[]>([]);
  protected readonly attachError = signal<TranslationKey | undefined>(undefined);
  protected readonly previewMode = signal(false);
  protected readonly status = signal<EditorStatus>('loading');
  protected readonly previewHtml = computed(() => this.markdown.render(this.content()));
  protected readonly isChecklist = computed(() => this.type() === 'checklist');

  private readonly notebookId = signal('');
  protected readonly notebookName = computed(
    () => this.notebooks.find(this.notebookId())?.name ?? '',
  );

  private readonly labelIds = signal<readonly string[]>([]);
  protected readonly labelSummary = computed(() => {
    const names = this.labels.names(this.labelIds());
    return names.length ? names.join(', ') : this.i18n.t('label.assign');
  });

  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private discarded = false;
  private stateListener: PluginListenerHandle | undefined;

  constructor() {
    effect(() => {
      void this.loadNote(this.id());
    });
    // Android may kill a backgrounded process without a further callback, so
    // this is the only flush guaranteed to run before that happens.
    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        void this.flush();
      }
    }).then((handle) => {
      this.stateListener = handle;
    });
  }

  ngOnDestroy(): void {
    void this.stateListener?.remove();
    void this.leave();
  }

  /** Ionic does not await this; `NotesStore` is what makes that safe. */
  ionViewWillLeave(): void {
    void this.leave();
  }

  protected back(): void {
    void this.router.navigate(['/notes']);
  }

  protected onTitleInput(value: string): void {
    this.title.set(value);
    this.scheduleSave();
  }

  protected onContentInput(value: string): void {
    this.content.set(value);
    this.scheduleSave();
  }

  protected onItemsChange(items: ChecklistItem[]): void {
    this.items.set(items);
    this.scheduleSave();
  }

  protected onToolbar(action: ToolbarAction): void {
    const textarea = this.textareaRef()?.nativeElement;
    if (!textarea) {
      return;
    }
    const result = applyToolbarAction(
      action,
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    textarea.value = result.value;
    this.content.set(result.value);
    textarea.focus();
    textarea.setSelectionRange(result.selStart, result.selEnd);
    this.scheduleSave();
  }

  protected imageUrl(id: string): string {
    return this.imageFiles.url(id);
  }

  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so picking the same file twice in a row still fires `change`.
    input.value = '';
    if (file) {
      void this.attachImage(file);
    }
  }

  /**
   * Flushed first for the same `updatedAt` reason as `chooseNotebook`, then
   * written as one patch: the reference in the body and the `note_images` row
   * must land together, or the garbage collector could see a claim with no
   * referent.
   */
  protected async attachImage(file: File): Promise<void> {
    if (this.status() !== 'ready' || this.isChecklist()) {
      return;
    }
    this.attachError.set(undefined);
    await this.flush();

    const result = await this.attachments.attach(file);
    if (!result.ok) {
      this.attachError.set(attachFailureKey(result.reason));
      return;
    }

    const textarea = this.textareaRef()?.nativeElement;
    // The preview hides the textarea, so the reference goes to the end of the
    // source instead of to a caret that is not on screen.
    const value = textarea?.value ?? this.content();
    const caret = textarea?.selectionStart ?? value.length;
    const edit = insertImageReference(
      value,
      caret,
      textarea?.selectionEnd ?? caret,
      result.asset.id,
      result.asset.fileName ?? '',
    );
    if (textarea) {
      textarea.value = edit.value;
      textarea.focus();
      textarea.setSelectionRange(edit.selStart, edit.selEnd);
    }
    this.content.set(edit.value);
    this.imageIds.set([...this.imageIds(), result.asset.id]);
    await this.store.save(this.id(), { content: edit.value, imageIds: [...this.imageIds()] });
  }

  protected async openImage(id: string): Promise<void> {
    if ((await this.imagePrompts.viewImage(this.imageUrl(id))) === 'remove') {
      await this.removeImage(id);
    }
  }

  /**
   * The note is saved without the image *before* the file is collected: only
   * then does `unreferenced()` agree the image is gone, and the `RESTRICT` FK
   * on `note_images` would otherwise refuse the delete.
   */
  private async removeImage(id: string): Promise<void> {
    await this.flush();
    const content = removeImageReference(this.content(), id);
    const remaining = this.imageIds().filter((imageId) => imageId !== id);
    const textarea = this.textareaRef()?.nativeElement;
    if (textarea) {
      textarea.value = content;
    }
    this.content.set(content);
    this.imageIds.set(remaining);
    await this.store.save(this.id(), { content, imageIds: [...remaining] });
    await this.store.collectImages([id]);
  }

  /**
   * The WebView must never follow a link itself — navigating away would blank
   * the app shell. The protocol re-check is redundant against the sanitizer and
   * kept anyway: it is the last gate before an intent leaves the app.
   */
  protected onPreviewClick(event: MouseEvent): void {
    const image = (event.target as HTMLElement).closest('img[data-image-id]');
    if (image) {
      const id = image.getAttribute('data-image-id');
      if (id) {
        void this.openImage(id);
      }
      return;
    }
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) {
      return;
    }
    event.preventDefault();
    const href = anchor.getAttribute('href');
    if (href !== null && isWebUrl(href)) {
      window.open(href, '_blank');
    }
  }

  /**
   * The pending autosave is flushed *before* the move. Both writes bump
   * `updatedAt`, so a debounce landing afterwards would overwrite the move's
   * timestamp with an older one and reorder the list wrongly.
   */
  protected async chooseNotebook(): Promise<void> {
    const target = await this.notebookPrompts.pickNotebook(this.notebookId());
    if (target === undefined) {
      return;
    }
    await this.flush();
    await this.store.moveNote(this.id(), target);
    this.notebookId.set(target);
  }

  /** Flushed first for the same `updatedAt` reason as `chooseNotebook`. */
  protected async chooseLabels(): Promise<void> {
    const chosen = await this.labelPrompts.pickLabels(this.labelIds());
    if (chosen === undefined) {
      return;
    }
    await this.flush();
    await this.store.setLabels(this.id(), chosen);
    this.labelIds.set(chosen);
  }

  private async loadNote(id: string): Promise<void> {
    const note = await this.notes.find(id);
    if (!note) {
      this.status.set('missing');
      return;
    }
    this.title.set(note.title);
    this.content.set(note.content);
    this.type.set(note.type);
    this.items.set([...(note.checklist ?? [])]);
    this.notebookId.set(note.notebookId);
    this.labelIds.set(note.labels);
    this.imageIds.set(note.imageIds);
    this.status.set('ready');
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty || this.status() !== 'ready') {
      return;
    }
    this.dirty = false;
    // A checklist note must not write `content`: the patch is key-presence
    // based, so sending both would leave stale Markdown behind the items.
    await this.store.save(
      this.id(),
      this.isChecklist()
        ? { title: this.title(), checklist: this.items() }
        : { title: this.title(), content: this.content() },
    );
  }

  /**
   * Flushed first for the same `updatedAt` reason as `chooseNotebook`, then
   * written as one patch so the type change and the content it produces cannot
   * land as two rows-with-no-body states.
   */
  protected async convert(): Promise<void> {
    if (this.status() !== 'ready') {
      return;
    }
    await this.flush();
    if (this.isChecklist()) {
      const content = checklistToText(this.items());
      await this.store.save(this.id(), { type: 'text', content, checklist: [] });
      this.content.set(content);
      this.items.set([]);
      this.type.set('text');
    } else {
      const checklist = textToChecklist(this.content());
      await this.store.save(this.id(), { type: 'checklist', content: '', checklist });
      this.items.set(checklist);
      this.content.set('');
      this.type.set('checklist');
      this.previewMode.set(false);
    }
  }

  private async leave(): Promise<void> {
    await this.flush();
    if (this.discarded || !this.created() || this.status() !== 'ready') {
      return;
    }
    if (this.title().trim() === '' && this.isEmptyBody()) {
      this.discarded = true;
      await this.store.discard(this.id());
    }
  }

  /** A checklist of blank placeholder rows is as empty as an untouched textarea. */
  private isEmptyBody(): boolean {
    return this.isChecklist()
      ? this.items().every((item) => item.text.trim() === '')
      : this.content().trim() === '';
  }
}

function isWebUrl(href: string): boolean {
  try {
    const { protocol } = new URL(href, window.location.href);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
