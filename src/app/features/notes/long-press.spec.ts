import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LongPressTracker } from './long-press';

describe('LongPressTracker', () => {
  let fired: number;
  let tracker: LongPressTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    fired = 0;
    tracker = new LongPressTracker({ onLongPress: () => fired++ });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once the press outlasts the threshold', () => {
    tracker.down(10, 10);
    vi.advanceTimersByTime(499);
    expect(fired).toBe(0);

    vi.advanceTimersByTime(1);
    expect(fired).toBe(1);
  });

  it('does not fire when the finger lifts first', () => {
    tracker.down(10, 10);
    vi.advanceTimersByTime(200);
    expect(tracker.up()).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(fired).toBe(0);
  });

  // The note list scrolls vertically, so a drifting finger is a scroll.
  it('cancels once the finger travels past the slop', () => {
    tracker.down(10, 10);
    tracker.move(10, 40);
    vi.advanceTimersByTime(600);
    expect(fired).toBe(0);
  });

  it('tolerates movement within the slop', () => {
    tracker.down(10, 10);
    tracker.move(18, 16);
    vi.advanceTimersByTime(600);
    expect(fired).toBe(1);
  });

  /**
   * The click that follows a fired press belongs to the same gesture. Without
   * this the sheet would open and the editor would open behind it.
   */
  it('reports the fired press so the caller can swallow the click', () => {
    tracker.down(10, 10);
    vi.advanceTimersByTime(600);

    expect(tracker.up()).toBe(true);
    // And the flag does not survive into the next gesture.
    tracker.down(10, 10);
    expect(tracker.up()).toBe(false);
  });

  it('abandons a pending press when a new one starts', () => {
    tracker.down(10, 10);
    vi.advanceTimersByTime(400);
    tracker.down(80, 80);
    vi.advanceTimersByTime(400);
    expect(fired).toBe(0);

    vi.advanceTimersByTime(100);
    expect(fired).toBe(1);
  });
});
