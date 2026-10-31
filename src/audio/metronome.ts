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

  constructor(private engine: Engine) {}

  get running(): boolean {
    return this.timer !== null;
  }

  start(opts: MetronomeOptions): void {
    this.stop();
    let next = 0;
    const later = (fn: () => void, atMs: number) => {
      const id = setTimeout(() => {
        this.uiTimers.delete(id);
        fn();
      }, Math.max(0, atMs - this.engine.nowMs()));
      this.uiTimers.add(id);
    };
    const pump = () => {
      const horizon = this.engine.nowMs() + LOOKAHEAD_MS;
      while (opts.totalTicks === undefined || next < opts.totalTicks) {
        const when = opts.startMs + next * opts.intervalMs;
        if (when > horizon) return;
        const index = next++;
        opts.onSchedule(index, when);
        if (opts.onTick) later(() => opts.onTick!(index), when);
      }
      // All ticks are queued: stop waking up and finish one interval after the last.
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      later(() => opts.onDone?.(), opts.startMs + next * opts.intervalMs);
    };
    this.timer = setInterval(pump, WAKE_MS);
    pump();
  }

  /** Stop queuing ticks and cancel pending UI callbacks. Sounds already queued keep playing unless the engine stops them. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.uiTimers.forEach(clearTimeout);
    this.uiTimers.clear();
  }
}
