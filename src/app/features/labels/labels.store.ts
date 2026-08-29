import { Injectable, inject, signal } from '@angular/core';

import type { Label } from '../../core/models/label';
import { compareLabels, LabelRepository } from '../../core/repositories/label.repository';

export type LabelsStatus = 'loading' | 'ready' | 'error';

/**
 * The label list, held once for the whole app, for the same reason as
 * `NotebooksStore`: the drawer lists labels for the entire session and has no
 * navigation event to reload on. Note cards also resolve label ids to names on
 * every render, which a per-card query would turn into a query per card.
 */
@Injectable({ providedIn: 'root' })
export class LabelsStore {
  private readonly repository = inject(LabelRepository);

  private readonly all = signal<readonly Label[]>([]);
  private readonly state = signal<LabelsStatus>('loading');

  readonly labels = this.all.asReadonly();
  readonly status = this.state.asReadonly();

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.all.set(await this.repository.list());
      this.state.set('ready');
    } catch {
      this.all.set([]);
      this.state.set('error');
    }
  }

  find(id: string): Label | undefined {
    return this.all().find((label) => label.id === id);
  }

  /** Names for a note's label ids, dropping ids this store has never seen. */
  names(ids: readonly string[]): string[] {
    return ids.flatMap((id) => {
      const label = this.find(id);
      return label ? [label.name] : [];
    });
  }

  async create(name: string): Promise<Label> {
    const label = await this.repository.create(name);
    this.all.set(sorted([...this.all(), label]));
    return label;
  }

  async rename(id: string, name: string): Promise<void> {
    const renamed = await this.repository.rename(id, name);
    this.all.set(sorted(this.all().map((label) => (label.id === id ? renamed : label))));
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
    this.all.set(this.all().filter((label) => label.id !== id));
  }
}

/** Shares `LabelRepository`'s comparator rather than restating it, so the two cannot drift. */
function sorted(labels: readonly Label[]): readonly Label[] {
  return [...labels].sort(compareLabels);
}
