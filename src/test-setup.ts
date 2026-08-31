// Polyfills for running unit tests under jsdom (the default Vitest environment).
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement, and `NoteListComponent` grows its render
// window from an `IntersectionObserver`, which jsdom does not implement either.

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

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

const intersectionObservers = new Map<IntersectionCallback, Set<Element>>();

/**
 * Reports every currently observed element as having come into view.
 *
 * jsdom has no layout, so nothing here can decide on its own whether an element
 * intersects; a spec that wants a list to grow says so. Returns how many
 * elements were reported, which is the difference between "the sentinel is not
 * being observed" and "it was observed and the component ignored it".
 */
export function triggerIntersection(): number {
  let reported = 0;
  for (const [callback, elements] of intersectionObservers) {
    if (elements.size === 0) {
      continue;
    }
    reported += elements.size;
    callback(
      [...elements].map(
        (target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry,
      ),
    );
  }
  return reported;
}

export function resetIntersectionObservers(): void {
  intersectionObservers.clear();
}

class TestIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds: readonly number[] = [0];

  constructor(private readonly callback: IntersectionCallback) {
    intersectionObservers.set(this.callback, new Set());
  }

  observe(target: Element): void {
    intersectionObservers.get(this.callback)?.add(target);
  }

  unobserve(target: Element): void {
    intersectionObservers.get(this.callback)?.delete(target);
  }

  disconnect(): void {
    intersectionObservers.delete(this.callback);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

window.IntersectionObserver = TestIntersectionObserver as unknown as typeof IntersectionObserver;
globalThis.IntersectionObserver = window.IntersectionObserver;
