import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryPreferencesAdapter } from '../../core/preferences/memory-preferences.adapter';
import { PREFERENCES_ADAPTER } from '../../core/preferences/preferences-adapter';
import { createTestRepositories, type TestRepositories } from '../../core/repositories/testing';
import { LabelPrompts } from './label-prompts';
import { LabelsPage } from './labels.page';
import { LabelsStore } from './labels.store';

describe('LabelsPage', () => {
  let repositories: TestRepositories;
  let store: LabelsStore;
  /** Overlays cannot be presented under jsdom; the page must only delegate to these. */
  const prompts = { create: vi.fn(), actions: vi.fn(), rename: vi.fn(), delete: vi.fn() };

  beforeEach(async () => {
    for (const spy of Object.values(prompts)) {
      spy.mockReset().mockResolvedValue(undefined);
    }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PREFERENCES_ADAPTER, useValue: new MemoryPreferencesAdapter() },
        { provide: LabelPrompts, useValue: prompts },
      ],
    });
    repositories = await createTestRepositories();
    store = TestBed.inject(LabelsStore);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repositories.adapter.close();
  });

  async function render(): Promise<ComponentFixture<LabelsPage>> {
    await store.load();
    const fixture = TestBed.createComponent(LabelsPage);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state until there is a label', async () => {
    const host: HTMLElement = (await render()).nativeElement;

    expect(host.querySelector('app-empty-state')?.textContent).toContain('No labels yet');
    expect(host.querySelectorAll('ion-item')).toHaveLength(0);
  });

  it('lists every label in the order the store holds them', async () => {
    await repositories.labels.create('Work');
    await repositories.labels.create('Arbeit');

    const host: HTMLElement = (await render()).nativeElement;

    expect([...host.querySelectorAll('ion-item')].map((el) => el.textContent?.trim())).toEqual([
      'Arbeit',
      'Work',
    ]);
    expect(host.querySelector('app-empty-state')).toBeNull();
  });

  it('opens the label as a note view', async () => {
    const work = await repositories.labels.create('Work');
    const fixture = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.open(work);

    expect(navigate).toHaveBeenCalledWith(['/labels', work.id]);
  });

  // The row is itself a button, so an un-stopped click would navigate away
  // underneath the action sheet.
  it('opens the action sheet without also opening the label', async () => {
    const work = await repositories.labels.create('Work');
    const fixture = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    fixture.componentInstance.showActions(work, event);

    expect(prompts.actions).toHaveBeenCalledWith(work);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('hands the create button to the prompts', async () => {
    const fixture = await render();

    fixture.componentInstance.create();

    expect(prompts.create).toHaveBeenCalled();
  });
});
