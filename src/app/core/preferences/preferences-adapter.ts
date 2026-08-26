import { InjectionToken } from '@angular/core';

/**
 * The narrow slice of key/value storage the app needs. Injected rather than
 * called directly so specs can swap in an in-memory implementation.
 */
export interface PreferencesAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const PREFERENCES_ADAPTER = new InjectionToken<PreferencesAdapter>('PreferencesAdapter');
