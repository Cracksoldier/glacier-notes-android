/** Matches Android's own long-press timeout, so the gesture feels native. */
const DEFAULT_THRESHOLD_MS = 500;

/**
 * Slop before a press counts as a scroll instead. The note list is vertically
 * scrollable, so a finger that drifts must not fire an action sheet.
 */
const DEFAULT_MOVE_PX = 10;

export interface LongPressOptions {
  readonly thresholdMs?: number;
  readonly movePx?: number;
  readonly onLongPress: () => void;
}

/**
 * The long-press gesture, as timer and arithmetic over plain coordinates.
 *
 * Kept out of the component so the timing and the movement slop can be tested
 * with fake timers. Ionic's `createGesture` was the alternative and was
 * rejected: it needs a `GestureController` and requestAnimationFrame, neither
 * of which can be driven under jsdom, which would push the whole decision back
 * into untestable code.
 */
export class LongPressTracker {
  private readonly thresholdMs: number;
  private readonly movePx: number;
  private readonly onLongPress: () => void;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private originX = 0;
  private originY = 0;
  private fired = false;

  constructor(options: LongPressOptions) {
    this.thresholdMs = options.thresholdMs ?? DEFAULT_THRESHOLD_MS;
    this.movePx = options.movePx ?? DEFAULT_MOVE_PX;
    this.onLongPress = options.onLongPress;
  }

  down(x: number, y: number): void {
    this.cancel();
    this.originX = x;
    this.originY = y;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.fired = true;
      this.onLongPress();
    }, this.thresholdMs);
  }

  move(x: number, y: number): void {
    if (this.timer === null) {
      return;
    }
    if (Math.abs(x - this.originX) > this.movePx || Math.abs(y - this.originY) > this.movePx) {
      this.cancel();
    }
  }

  /**
   * True when the press already fired, meaning the click that follows is part of
   * the same gesture and the caller should swallow it rather than open the note.
   */
  up(): boolean {
    const fired = this.fired;
    this.cancel();
    return fired;
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.fired = false;
  }
}
