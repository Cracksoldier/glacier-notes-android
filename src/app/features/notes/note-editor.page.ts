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

import { I18nService } from '../../core/localization/i18n.service';
import { applyToolbarAction, type ToolbarAction } from '../../core/markdown/markdown-edit';
import { MarkdownService } from '../../core/markdown/markdown.service';
import { NoteRepository } from '../../core/repositories/note.repository';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { faArrowLeft, faCircleQuestion, faEye, faPen } from '../../shared/utilities/glacier-icons';
import { MarkdownToolbarComponent } from './markdown-toolbar.component';
import { NotesStore } from './notes.store';

const SAVE_DEBOUNCE_MS = 500;

type EditorStatus = 'loading' | 'ready' | 'missing';

@Component({
  selector: 'app-note-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
              (click)="previewMode.set(!previewMode())"
              [attr.aria-label]="previewMode() ? i18n.t('editor.edit') : i18n.t('editor.preview')"
            >
              <fa-icon [icon]="previewMode() ? editIcon : previewIcon" />
            </ion-button>
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

          <app-markdown-toolbar
            class="editor__toolbar"
            [disabled]="previewMode()"
            (action)="onToolbar($event)"
          />

          @if (store.saveFailed()) {
            <p class="editor__error" role="alert">{{ i18n.t('editor.saveFailed') }}</p>
          }

          @if (previewMode()) {
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

    .editor__toolbar {
      margin: 4px -12px 4px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--color-border);
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

  protected readonly backIcon = faArrowLeft;
  protected readonly previewIcon = faEye;
  protected readonly editIcon = faPen;
  protected readonly missingIcon = faCircleQuestion;

  protected readonly title = signal('');
  protected readonly content = signal('');
  protected readonly previewMode = signal(false);
  protected readonly status = signal<EditorStatus>('loading');
  protected readonly previewHtml = computed(() => this.markdown.render(this.content()));

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

  /**
   * The WebView must never follow a link itself — navigating away would blank
   * the app shell. The protocol re-check is redundant against the sanitizer and
   * kept anyway: it is the last gate before an intent leaves the app.
   */
  protected onPreviewClick(event: MouseEvent): void {
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

  private async loadNote(id: string): Promise<void> {
    const note = await this.notes.find(id);
    if (!note) {
      this.status.set('missing');
      return;
    }
    this.title.set(note.title);
    this.content.set(note.content);
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
    await this.store.save(this.id(), { title: this.title(), content: this.content() });
  }

  private async leave(): Promise<void> {
    await this.flush();
    if (this.discarded || !this.created() || this.status() !== 'ready') {
      return;
    }
    if (this.title().trim() === '' && this.content().trim() === '') {
      this.discarded = true;
      await this.store.discard(this.id());
    }
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
