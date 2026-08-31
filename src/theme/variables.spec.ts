import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

// Guards the Ionic mapping: a botched SCSS refactor should fail here rather than
// ship an app that silently falls back to stock Ionic colours.

// Vitest runs with the repository root as its working directory.
const css = sass.compile('src/theme/variables.scss').css;

function tokens(themeClass: string): Map<string, string> {
  const block = new RegExp(`\\.${themeClass}\\s*\\{([^}]*)\\}`).exec(css);
  expect(block, `no .${themeClass} block emitted`).toBeTruthy();

  const declarations = new Map<string, string>();
  for (const [, name, value] of (block?.[1] ?? '').matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    declarations.set(name, value.trim());
  }
  return declarations;
}

// WCAG 2.1 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('Ionic theme variables', () => {
  it('maps the desktop accent onto --ion-color-primary', () => {
    expect(tokens('theme-dark').get('--ion-color-primary')).toBe('#4cc9f0');
    expect(tokens('theme-light').get('--ion-color-primary')).toBe('#0d8ecf');
  });

  it('keeps the rgb companions in sync with their hex colours', () => {
    expect(tokens('theme-dark').get('--ion-color-primary-rgb')).toBe('76, 201, 240');
    expect(tokens('theme-light').get('--ion-color-primary-rgb')).toBe('13, 142, 207');
    expect(tokens('theme-dark').get('--ion-background-color-rgb')).toBe('13, 27, 42');
    expect(tokens('theme-light').get('--ion-background-color-rgb')).toBe('244, 247, 250');
  });

  // Both themes draw accent-coloured text (markdown links, the checked segment
  // label, alert buttons). The raw light accent measures 3.37:1 on the page
  // background, so that text reads a darker token instead; this pins the ratio
  // rather than the hex, since the point is the threshold and not the colour.
  it('keeps accent text above the AA contrast bar in both themes', () => {
    const surfaces = {
      'theme-dark': ['#0d1b2a', '#1b263b'],
      'theme-light': ['#ffffff', '#f4f7fa'],
    };

    for (const [theme, backgrounds] of Object.entries(surfaces)) {
      const accentText = tokens(theme).get('--glacier-accent-text');
      expect(accentText, theme).toBeTruthy();

      for (const background of backgrounds) {
        expect(
          contrast(accentText ?? '', background),
          `${theme} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // A search highlight is the one place text sits on the raw accent rather than
  // on a background colour, so it needs its own ink; the desktop's choice of
  // --color-bg measures 3.37:1 in the light theme. Pinned as a ratio for the same
  // reason as the accent text above.
  it('keeps highlight ink above the AA contrast bar on each theme accent', () => {
    const accents = { 'theme-dark': '#4cc9f0', 'theme-light': '#0d8ecf' };

    for (const [theme, accent] of Object.entries(accents)) {
      const ink = tokens(theme).get('--glacier-mark-ink');
      expect(ink, theme).toBeTruthy();
      expect(contrast(ink ?? '', accent), `${theme} on ${accent}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('emits a full step ramp running from background to text', () => {
    for (const theme of ['theme-dark', 'theme-light']) {
      const declarations = tokens(theme);
      const steps = [...declarations.keys()].filter((name) => name.startsWith('--ion-color-step-'));
      expect(steps, theme).toHaveLength(19);
      expect(declarations.get('--ion-color-step-50'), theme).not.toBe(
        declarations.get('--ion-color-step-950'),
      );
    }
  });
});
