/**
 * A look-ahead scheduler on the audio clock (the "tale of two clocks" pattern).
 *
 * A JS timer wakes up every 25 ms and hands each tick due in the next 150 ms to
 * `onSchedule` with its exact audio-clock time, where the sound is scheduled.
 * The JS timer only decides *how early* a tick is queued, never when it sounds,
 * so timer jitter can't reach the click. `onTick` fires (via a JS timeout) close
 * to when each tick is heard, for UI updates like the beat indicator.
 */
import type { Engine } from './engine';

const WAKE_MS = 25;
const LOOKAHEAD_MS = 150;

export interface MetronomeOptions {
  /** Audio-clock time of tick 0, in ms. */
  startMs: number;
  intervalMs: number;
  /** Stop after this many ticks (then `onDone` runs one interval after the last one). */
  totalTicks?: number;
  /** Schedule the sound(s) for tick `index` at `whenMs` on the audio clock. */
  onSchedule: (index: number, whenMs: number) => void;
  /** Runs on the JS thread at about the time tick `index` is heard. */
  onTick?: (index: number) => void;
  onDone?: () => void;
}

export class Metronome {
  private timer: ReturnType<typeof setInterval> | null = null;
  private uiTimers = new Set<ReturnType<typeof setTimeout>>();
  // Tick i sounds at anchorMs + (i - anchorIndex) * intervalMs. Changing the tempo
  // moves the anchor to the next unqueued tick, so the rhythm carries on without a jump.
  private next = 0;
  private anchorIndex = 0;
  private anchorMs = 0;
  private intervalMs = 0;

  constructor(private engine: Engine) {}

  get running(): boolean {
    return this.timer !== null;
  }

  private timeOf(index: number): number {
    return this.anchorMs + (index - this.anchorIndex) * this.intervalMs;
  }

  start(opts: MetronomeOptions): void {
    this.stop();
    this.next = 0;
    this.anchorIndex = 0;
    this.anchorMs = opts.startMs;
    this.intervalMs = opts.intervalMs;
    const later = (fn: () => void, atMs: number) => {
      const id = setTimeout(() => {
        this.uiTimers.delete(id);
        fn();
      }, Math.max(0, atMs - this.engine.nowMs()));
      this.uiTimers.add(id);
    };
    const pump = () => {
      const horizon = this.engine.nowMs() + LOOKAHEAD_MS;
      while (opts.totalTicks === undefined || this.next < opts.totalTicks) {
        const when = this.timeOf(this.next);
        if (when > horizon) return;
        const index = this.next++;
        opts.onSchedule(index, when);
        if (opts.onTick) later(() => opts.onTick!(index), when);
      }
      // All ticks are queued: stop waking up and finish one interval after the last.
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      later(() => opts.onDone?.(), this.timeOf(this.next));
    };
    this.timer = setInterval(pump, WAKE_MS);
    pump();
  }

  /**
   * Change the tempo while running. Ticks already queued (up to LOOKAHEAD_MS
   * ahead) keep their time; from the next one on, ticks follow the new spacing,
   * starting one new interval after the last queued tick.
   */
  setIntervalMs(intervalMs: number): void {
    if (!this.running || intervalMs === this.intervalMs) return;
    if (this.next > 0) this.anchorMs = this.timeOf(this.next - 1) + intervalMs;
    this.anchorIndex = this.next;
    this.intervalMs = intervalMs;
  }

  /** Stop queuing ticks and cancel pending UI callbacks. Sounds already queued keep playing unless the engine stops them. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.uiTimers.forEach(clearTimeout);
    this.uiTimers.clear();
  }
}
