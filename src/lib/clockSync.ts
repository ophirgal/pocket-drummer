/**
 * Lines up the three clocks a test involves, all in milliseconds:
 *
 * - the audio context clock (`ctx.currentTime`), on which every click is scheduled,
 * - the recorder stream clock (sample position of the microphone audio),
 * - `performance.now()`, the JS clock that taps and callbacks are stamped with.
 *
 * Neither the context nor the recorder can be read at the same instant as the
 * other, so each is related to `performance.now()` from many observations:
 *
 * - `ctx.currentTime` only advances once per render quantum, so it lags real time;
 *   the largest (context - perf) seen is the best estimate of the true offset.
 * - A mic buffer reaches JS some time after its last sample was captured; the
 *   smallest (arrival - stream end) seen is the best estimate of that offset.
 *
 * Any constant delay left over (hardware input/output latency, Bluetooth) is the
 * same for every hit and is removed by the speaker echo or by calibration.
 */
export class ClockSync {
  private ctxMinusPerf = -Infinity;
  private perfMinusStream = Infinity;

  /** Record a reading of the context clock taken at `perfMs`. */
  observeContext(ctxMs: number, perfMs: number): void {
    if (ctxMs - perfMs > this.ctxMinusPerf) this.ctxMinusPerf = ctxMs - perfMs;
  }

  /** Record that stream audio up to `streamEndMs` had arrived by `perfMs`. */
  observeStream(streamEndMs: number, perfMs: number): void {
    if (perfMs - streamEndMs < this.perfMinusStream) this.perfMinusStream = perfMs - streamEndMs;
  }

  get hasContext(): boolean {
    return this.ctxMinusPerf > -Infinity;
  }

  get hasStream(): boolean {
    return this.perfMinusStream < Infinity;
  }

  /** Context time (ms) of a moment stamped with performance.now(). */
  perfToContext(perfMs: number): number {
    return perfMs + this.ctxMinusPerf;
  }

  /** Context time (ms) at which the given stream position was captured. */
  streamToContext(streamMs: number): number {
    return streamMs + this.perfMinusStream + this.ctxMinusPerf;
  }
}

export const perfNow = (): number => performance.now();
