/**
 * The stored form of a test's recording, for drawing it over the beat grid.
 *
 * The 0.5 ms detection envelope is too big to keep, so it's reduced to one peak
 * level every RECORDING_HOP_MS, scaled to 0..255 and base64-encoded: a 2-minute
 * test is about 32 KB. Times are relative to the first scored beat and already
 * latency-corrected, so the recording lines up with the expected notes.
 */

export const RECORDING_HOP_MS = 5;

export interface StoredRecording {
  /** Duration of one level, in ms. */
  hopMs: number;
  /** Time of the first level relative to the first scored beat, in ms. */
  startMs: number;
  /** base64 of one byte (0..255) per level, relative to the loudest level. */
  levels: string;
}

export interface Recording {
  hopMs: number;
  startMs: number;
  /** 0..1 */
  levels: Float32Array;
}

/**
 * Sample `peakIn` (the peak level between two times) every `hopMs` over
 * [fromMs, toMs) and encode the result.
 */
export function encodeRecording(
  fromMs: number,
  toMs: number,
  peakIn: (fromMs: number, toMs: number) => number,
  hopMs = RECORDING_HOP_MS,
): StoredRecording {
  const n = Math.max(0, Math.ceil((toMs - fromMs) / hopMs));
  const raw = new Float32Array(n);
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    const t = fromMs + i * hopMs;
    raw[i] = peakIn(t, t + hopMs);
    if (raw[i] > max) max = raw[i];
  }
  let bin = '';
  for (let i = 0; i < n; i++) bin += String.fromCharCode(Math.round(Math.min(1, raw[i] / max) * 255));
  return { hopMs, startMs: fromMs, levels: btoa(bin) };
}

export function decodeRecording(r: StoredRecording): Recording {
  const bin = atob(r.levels);
  const levels = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) levels[i] = bin.charCodeAt(i) / 255;
  return { hopMs: r.hopMs, startMs: r.startMs, levels };
}

/** Peak level of the recording between two times (ms from the first scored beat). */
export function levelBetween(r: Recording, fromMs: number, toMs: number): number {
  const a = Math.max(0, Math.floor((fromMs - r.startMs) / r.hopMs));
  const b = Math.min(r.levels.length, Math.ceil((toMs - r.startMs) / r.hopMs));
  let m = 0;
  for (let i = a; i < b; i++) if (r.levels[i] > m) m = r.levels[i];
  return m;
}
