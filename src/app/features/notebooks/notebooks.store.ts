import { Injectable, computed, inject, signal } from '@angular/core';

import type { Notebook } from '../../core/models/notebook';
import {
  type NotebookDisposition,
  NotebookRepository,
} from '../../core/repositories/notebook.repository';

export type NotebooksStatus = 'loading' | 'ready' | 'error';

/**
 * The notebook list, held once for the whole app.
 *
 * The drawer renders notebooks and is mounted for the entire session, so it has
 * no navigation event to reload on. Every other reader — the management page,
 * the editor's notebook chip, the Settings picker — then gets the same list for
 * free, and a rename shows up in all four without a round trip.
 */
@Injectable({ providedIn: 'root' })
export class NotebooksStore {
  private readonly repository = inject(NotebookRepository);

  private readonly all = signal<readonly Notebook[]>([]);
  private readonly state = signal<NotebooksStatus>('loading');
  private readonly currentDefaultId = signal<string | null>(null);

  readonly notebooks = this.all.asReadonly();
  readonly status = this.state.asReadonly();
  readonly defaultId = this.currentDefaultId.asReadonly();

  readonly defaultNotebook = computed(() =>
    this.all().find((notebook) => notebook.id === this.currentDefaultId()),
  );

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.all.set(await this.repository.list());
      this.currentDefaultId.set(await this.repository.getDefaultId());
      this.state.set('ready');
    } catch {
      this.all.set([]);
      this.state.set('error');
    }
  }

  find(id: string): Notebook | undefined {
    return this.all().find((notebook) => notebook.id === id);
  }

  countNotes(id: string): Promise<number> {
    return this.repository.countNotes(id);
  }

  async create(name: string): Promise<Notebook> {
    const notebook = await this.repository.create(name);
    // `create` assigns the next sort order, and `list()` orders by it, so a new
    // notebook always belongs at the end.
    this.all.set([...this.all(), notebook]);
    return notebook;
  }

  async rename(id: string, name: string): Promise<void> {
    const renamed = await this.repository.update(id, { name });
    this.all.set(this.all().map((notebook) => (notebook.id === id ? renamed : notebook)));
  }

  /**
   * Without a `disposition` this rejects with `NotebookNotEmptyError`, whose
   * `noteCount` is what the delete dialog shows. Callers are expected to catch
   * it and call again with the user's answer.
   */
  async remove(id: string, disposition?: NotebookDisposition): Promise<void> {
    await this.repository.delete(id, disposition);
    this.all.set(this.all().filter((notebook) => notebook.id !== id));
  }

  async setDefault(id: string): Promise<void> {
    await this.repository.setDefaultId(id);
    this.currentDefaultId.set(id);
  }
}
