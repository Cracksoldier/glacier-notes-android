import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import type { PreferencesAdapter } from './preferences-adapter';

/**
 * On Android this is SharedPreferences; on the dev server the plugin's own web
 * implementation persists to localStorage under the CapacitorStorage. prefix,
 * so `npm start` behaves the same across reloads.
 */
@Injectable({ providedIn: 'root' })
export class CapacitorPreferencesAdapter implements PreferencesAdapter {
  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
