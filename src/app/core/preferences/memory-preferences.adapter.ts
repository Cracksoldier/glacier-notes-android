import type { PreferencesAdapter } from './preferences-adapter';

/** Test double. jsdom's localStorage leaks between spec files in a worker. */
export class MemoryPreferencesAdapter implements PreferencesAdapter {
  private readonly entries: Map<string, string>;

  constructor(seed: Record<string, string> = {}) {
    this.entries = new Map(Object.entries(seed));
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.entries.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }
}
