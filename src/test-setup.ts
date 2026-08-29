// Polyfills for running unit tests under jsdom (the default Vitest environment).
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement.

type Listener = (event: MediaQueryListEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const matchingQueries = new Set<string>();

/**
 * Flips a media query's `matches` and notifies listeners, so specs can drive
 * `prefers-color-scheme` without stubbing matchMedia themselves.
 */
export function setMediaQueryMatches(query: string, matches: boolean): void {
  if (matches) {
    matchingQueries.add(query);
  } else {
    matchingQueries.delete(query);
  }
  const event = { matches, media: query } as MediaQueryListEvent;
  for (const listener of listeners.get(query) ?? []) {
    listener(event);
  }
}

export function resetMediaQueries(): void {
  matchingQueries.clear();
  listeners.clear();
}

// Overriding rather than filling a gap, so this is unconditional. Guarding on
// `!window.matchMedia` meant that the day jsdom grows one of its own,
// `setMediaQueryMatches` would silently stop working and the theme specs would
// pass vacuously instead of failing.
window.matchMedia = (query: string): MediaQueryList => {
  const add = (listener: Listener): void => {
    const existing = listeners.get(query) ?? new Set<Listener>();
    existing.add(listener);
    listeners.set(query, existing);
  };
  const remove = (listener: Listener): void => {
    listeners.get(query)?.delete(listener);
  };

  return {
    get matches() {
      return matchingQueries.has(query);
    },
    media: query,
    onchange: null,
    addListener: add,
    removeListener: remove,
    addEventListener: (_type: string, listener: Listener) => add(listener),
    removeEventListener: (_type: string, listener: Listener) => remove(listener),
    dispatchEvent: () => false,
  } as MediaQueryList;
};
