/**
 * A drift-free beat clock. Every tick is scheduled against an absolute start
 * time (tick n = start + n * interval) rather than chaining timeouts, so
 * timer jitter never accumulates over a test.
 */

export interface Tick {
  index: number;
  time: number;
}

export interface ClockOptions {
  intervalMs: number;
  onTick: (tick: Tick) => void;
  totalTicks?: number;
  onDone?: () => void;
  leadInMs?: number;
}

/** The one clock every timestamp in the app is measured on (ms, high resolution). */
export const now = (): number => performance.now();

/**
 * Fires `onTick` every `intervalMs`, starting `leadInMs` from now, until
 * `totalTicks` have fired (then `onDone`) or `stop()` is called. Used for the
 * test click and for library previews.
 */
export class TickClock {
  private opts: ClockOptions | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private start = 0;
  private next = 0;

  get running(): boolean {
    return this.opts !== null;
  }

  /** Starts ticking and returns the time of tick 0. */
  begin(opts: ClockOptions): number {
    this.stop();
    this.opts = opts;
    this.start = now() + (opts.leadInMs ?? 150);
    this.next = 0;
    this.schedule();
    return this.start;
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.opts = null;
  }

  private schedule(): void {
    if (!this.opts) return;
    const delay = this.start + this.next * this.opts.intervalMs - now();
    this.timer = setTimeout(this.tick, Math.max(0, delay));
  }

  private tick = (): void => {
    const opts = this.opts;
    if (!opts) return;
    if (opts.totalTicks !== undefined && this.next >= opts.totalTicks) {
      this.stop();
      opts.onDone?.();
      return;
    }
    opts.onTick({ index: this.next, time: this.start + this.next * opts.intervalMs });
    this.next++;
    this.schedule();
  };
}
