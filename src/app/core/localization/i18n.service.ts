import { DOCUMENT, Injectable, computed, effect, inject } from '@angular/core';

import { SettingsStore } from '../preferences/settings.store';
import { de } from './de';
import { type TranslationKey, en } from './en';

export type { TranslationKey };

/** Ported from the desktop's src/app/core/i18n/i18n.service.ts. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsStore);
  private readonly document = inject(DOCUMENT);

  // Reading the table through this computed makes every t()/formatDate() call
  // in a template binding reactive to language switches (zoneless signal CD).
  private readonly table = computed<Record<TranslationKey, string>>(() =>
    this.settings.language() === 'de' ? de : en,
  );

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.settings.language();
    });
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let text = this.table()[key] ?? en[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, String(value));
      }
    }
    return text;
  }

  formatDate(iso: string): string {
    const locale = this.settings.language() === 'de' ? 'de-DE' : 'en-US';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  }

  /** Localized because the decimal separator differs: `1.4 MB` against `1,4 MB`. */
  formatBytes(bytes: number): string {
    const locale = this.settings.language() === 'de' ? 'de-DE' : 'en-US';
    const units = ['B', 'kB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
      value /= 1000;
      unit++;
    }
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: unit === 0 ? 0 : 1,
    }).format(value);
    return `${formatted} ${units[unit]}`;
  }
}
