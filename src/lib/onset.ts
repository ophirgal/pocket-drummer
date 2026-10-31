/**
 * Beat (onset) detection for drum-pad hits.
 *
 * Audio arrives in chunks from the microphone. EnvelopeBuilder reduces it on the fly
 * to a peak envelope with 0.5 ms resolution, which is small enough to keep for a
 * whole test and precise enough for timing. detectOnsets then finds hits in that
 * envelope after the recording ends.
 */

export const HOP_MS = 0.5;

/**
 * Streams microphone audio into a compact peak envelope: each 0.5 ms "hop" keeps
 * the loudest (high-passed) sample in it. Index i covers stream time i * hopMs.
 */
export class EnvelopeBuilder {
  readonly sampleRate: number;
  readonly hopSamples: number;
  private env: Float32Array;
  private length = 0;
  private hopPeak = 0;
  private hopFill = 0;
  private prevIn = 0;
  private prevOut = 0;
  private readonly hpCoef: number;
  totalSamples = 0;

  constructor(sampleRate: number, maxSeconds: number) {
    this.sampleRate = sampleRate;
    this.hopSamples = Math.max(1, Math.round((sampleRate * HOP_MS) / 1000));
    this.env = new Float32Array(Math.ceil((maxSeconds * 1000) / this.hopMs) + 16);
    // One-pole high-pass at ~120 Hz removes rumble and handling noise.
    this.hpCoef = Math.exp((-2 * Math.PI * 120) / sampleRate);
  }

  /** Real duration of one envelope step in ms (hopSamples / sampleRate). */
  get hopMs(): number {
    return (this.hopSamples / this.sampleRate) * 1000;
  }

  get envelope(): Float32Array {
    return this.env.subarray(0, this.length);
  }

  /**
   * Append a chunk of mono audio. `atSample` is where the chunk starts in the
   * stream; if the recorder dropped audio before it, the gap is filled with
   * silence so later hits keep their true time. Stops growing once the
   * preallocated length is full.
   */
  push(samples: Float32Array, atSample = this.totalSamples): void {
    const gap = Math.min(atSample - this.totalSamples, this.env.length * this.hopSamples);
    if (gap > 0) this.push(new Float32Array(gap));
    const { hopSamples, hpCoef } = this;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const y = hpCoef * (this.prevOut + x - this.prevIn);
      this.prevIn = x;
      this.prevOut = y;
      const a = y < 0 ? -y : y;
      if (a > this.hopPeak) this.hopPeak = a;
      if (++this.hopFill === hopSamples) {
        if (this.length < this.env.length) this.env[this.length++] = this.hopPeak;
        this.hopPeak = 0;
        this.hopFill = 0;
      }
    }
    this.totalSamples += samples.length;
  }

  /** Peak level of the last `ms` of audio, for live meters and waveforms. */
  recentPeak(ms: number): number {
    const hops = Math.max(1, Math.round(ms / this.hopMs));
    let p = 0;
    for (let i = Math.max(0, this.length - hops); i < this.length; i++) if (this.env[i] > p) p = this.env[i];
    return p;
  }
}

export interface DetectOptions {
  /** Envelope level a hit must reach. */
  threshold: number;
  /** Minimum gap between two hits, in ms. */
  refractoryMs?: number;
  /** Only search from/to these envelope indices. */
  from?: number;
  to?: number;
}

export interface Onset {
  /** Envelope index where the hit starts. */
  index: number;
  /** Peak level of the hit. */
  peak: number;
}

/**
 * Find hits: the envelope crosses the threshold coming from below, at least
 * `refractoryMs` after the previous hit, and has to fall back to half the
 * threshold before the next hit can fire, so one ringing stroke counts once.
 * The onset time is backed up to where the attack started (20% of the threshold).
 */
export function detectOnsets(env: Float32Array, hopMs: number, opts: DetectOptions): Onset[] {
  const { threshold } = opts;
  const refractory = Math.round((opts.refractoryMs ?? 45) / hopMs);
  const from = Math.max(1, opts.from ?? 1);
  const to = Math.min(env.length, opts.to ?? env.length);
  const out: Onset[] = [];
  let last = -Infinity;
  let armed = true;
  for (let i = from; i < to; i++) {
    const v = env[i];
    if (!armed) {
      if (v < threshold * 0.5 && i - last > refractory) armed = true;
      else continue;
    }
    if (v >= threshold && i - last > refractory) {
      let start = i;
      const floor = threshold * 0.2;
      const limit = Math.max(from, i - Math.round(8 / hopMs));
      while (start > limit && env[start - 1] > floor) start--;
      let peak = v;
      const peakEnd = Math.min(to, i + Math.round(15 / hopMs));
      for (let j = i; j < peakEnd; j++) if (env[j] > peak) peak = env[j];
      out.push({ index: start, peak });
      last = i;
      armed = false;
    }
  }
  return out;
}

/** Largest value in a slice of the envelope. */
export function maxIn(env: Float32Array, from: number, to: number): number {
  let m = 0;
  for (let i = Math.max(0, from); i < Math.min(env.length, to); i++) if (env[i] > m) m = env[i];
  return m;
}

/**
 * One stroke on a pad often produces a second, weaker bump 40–90 ms later (the
 * stick rebounding, the pad ringing), which the envelope rules alone can't tell
 * from a new stroke. The exercise can: notes are never closer than its shortest
 * note spacing. So onsets closer together than `minGapMs` are treated as one
 * stroke, and the louder one (the real attack) is kept.
 */
export function mergeCloseOnsets(onsets: Onset[], hopMs: number, minGapMs: number): Onset[] {
  const gap = minGapMs / hopMs;
  const out: Onset[] = [];
  for (const o of onsets) {
    const last = out[out.length - 1];
    if (last && o.index - last.index < gap) {
      if (o.peak > last.peak) out[out.length - 1] = o;
    } else out.push(o);
  }
  return out;
}

/** How long after a threshold crossing the peak of a hit is measured (same as detectOnsets). */
const PEAK_WINDOW_MS = 15;

/**
 * detectOnsets for audio that's still arriving: each scan() looks only at the
 * envelope added since the last call, with the same rules (cross the threshold,
 * re-arm below half of it, refractory period, back up to the attack). An onset
 * is reported once its whole peak window has arrived, so its peak matches what
 * detectOnsets measures. Used to show hits while a test runs; the final score
 * still uses detectOnsets on the whole recording, where the threshold can take
 * every hit into account.
 */
export class LiveOnsets {
  private next = 1;
  private last = -Infinity;
  private armed = true;
  /** Onsets found whose peak window hasn't fully arrived yet. */
  private pending: { start: number; crossing: number }[] = [];

  constructor(
    private readonly hopMs: number,
    private readonly refractoryMs = 45,
  ) {}

  /** Hits whose peak window is complete, oldest first. `threshold` may change between calls. */
  scan(env: Float32Array, threshold: number): Onset[] {
    const refractory = Math.round(this.refractoryMs / this.hopMs);
    for (; this.next < env.length; this.next++) {
      const i = this.next;
      const v = env[i];
      if (!this.armed) {
        if (v < threshold * 0.5 && i - this.last > refractory) this.armed = true;
        else continue;
      }
      if (v >= threshold && i - this.last > refractory) {
        let start = i;
        const limit = Math.max(1, i - Math.round(8 / this.hopMs));
        while (start > limit && env[start - 1] > threshold * 0.2) start--;
        this.pending.push({ start, crossing: i });
        this.last = i;
        this.armed = false;
      }
    }
    const window = Math.round(PEAK_WINDOW_MS / this.hopMs);
    const out: Onset[] = [];
    while (this.pending.length && this.pending[0].crossing + window <= env.length) {
      const { start, crossing } = this.pending.shift()!;
      out.push({ index: start, peak: maxIn(env, crossing, crossing + window) });
    }
    return out;
  }
}
