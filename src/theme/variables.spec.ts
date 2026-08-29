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
