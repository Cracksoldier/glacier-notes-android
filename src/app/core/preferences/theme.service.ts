import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  type Signal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import type { ResolvedTheme, ThemeMode } from './settings.model';
import { SettingsStore } from './settings.store';

export type { ResolvedTheme, ThemeMode };

const THEME_CLASSES: Record<ResolvedTheme, string> = {
  dark: 'theme-dark',
  light: 'theme-light',
};

// Below this Capacitor cannot hand the window insets to CSS, so it pads the
// WebView natively and the bars show the activity's windowBackground instead of
// the app's own background. See https://issues.chromium.org/issues/40699457.
const WEBVIEW_CSS_INSETS_VERSION = 140;

/**
 * Owns the .theme-dark / .theme-light body class and the status bar, mirroring
 * the desktop app's effect() in app.ts. The chosen mode itself belongs to
 * SettingsStore, which persists it.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settings = inject(SettingsStore);
  private readonly systemPrefersDark = signal(false);

  readonly mode: Signal<ThemeMode> = this.settings.themeMode;

  readonly resolved = computed<ResolvedTheme>(() => {
    const mode = this.mode();
    if (mode !== 'system') {
      return mode;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    this.watchSystemPreference();
    this.applyTheme(this.resolved());
    effect(() => this.applyTheme(this.resolved()));
  }

  setMode(mode: ThemeMode): void {
    this.settings.setThemeMode(mode);
  }

  /** Flips between the two concrete themes; 'system' resolves first. */
  toggle(): void {
    this.settings.setThemeMode(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private watchSystemPreference(): void {
    const query = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)');
    if (!query) {
      return;
    }
    this.systemPrefersDark.set(query.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      this.systemPrefersDark.set(event.matches);
    };
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }

  private applyTheme(theme: ResolvedTheme): void {
    const { classList } = this.document.body;
    classList.toggle(THEME_CLASSES.dark, theme === 'dark');
    classList.toggle(THEME_CLASSES.light, theme === 'light');

    if (Capacitor.isNativePlatform()) {
      const behind = this.barBackdrop(theme);
      // Style.Dark means light glyphs, which is what a dark background needs.
      void StatusBar.setStyle({ style: behind === 'dark' ? Style.Dark : Style.Light });
    }
  }

  /**
   * What actually paints behind the system bars. Only once the insets reach CSS
   * does the app draw there itself; before that the bars carry windowBackground,
   * which is a DayNight resource and so follows the platform, not `mode`.
   */
  private barBackdrop(theme: ResolvedTheme): ResolvedTheme {
    const chromeMajor = Number(/Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] ?? 0);
    if (chromeMajor >= WEBVIEW_CSS_INSETS_VERSION) {
      return theme;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  }
}
