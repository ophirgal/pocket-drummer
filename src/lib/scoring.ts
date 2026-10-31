/**
 * Scores a finished test: finds the hits, corrects them for latency, matches
 * them to the exercise's notes and builds everything the result screens need.
 *
 * Pure (no audio or React), so it can be tested end to end on synthetic audio.
 * All times are in ms on the audio context clock, the one the clicks were
 * scheduled on.
 */
import { analyze, buildExpectedNotes, median } from './analysis';
import { coachFor } from './coach';
import type { Exercise } from './exercises';
import { detectOnsets, maxIn } from './onset';
import { encodeRecording } from './recording';
import type { InputMode, SessionResult, Sensitivity } from '@/state/store';

/** One bar of 4/4: listen, don't play. */
export const COUNT_IN_BEATS = 4;

/**
 * How far a hit must rise above the count-in level (`factor`), with an absolute
 * minimum (`floor`), per mic sensitivity setting.
 */
const SENSITIVITY = {
  low: { floor: 0.05, factor: 3 },
  medium: { floor: 0.03, factor: 2.2 },
  high: { floor: 0.015, factor: 1.6 },
} as const;

export interface TakenTest {
  exercise: Exercise;
  bpm: number;
  inputMode: InputMode;
  sensitivity: Sensitivity;
  pocketMs: number;
  /** Calibrated correction for this input and audio output, if there is one. */
  calibratedLatency: number | null;
  /** Time of the first count-in click. */
  t0: number;
  /** Bars the test was planned to last (after the count-in). */
  bars: number;
  /** When the test stopped. Stopping early scores the whole bars played. */
  stoppedAt: number;
  /** Mic mode: the detection envelope, and the time its index 0 was captured. */
  mic?: { envelope: Float32Array; hopMs: number; startMs: number };
  /** Tap mode: the time of each tap. */
  taps?: number[];
}

export type ScoredTest = Omit<SessionResult, 'id' | 'date' | 'route' | 'micName'>;

export function scoreTest(t: TakenTest): ScoredTest | null {
  const { exercise, bpm, pocketMs } = t;
  const beatMs = 60000 / bpm;
  const barMs = beatMs * exercise.beatsPerBar;
  const scoredStart = t.t0 + COUNT_IN_BEATS * beatMs;
  const barsPlayed = Math.min(t.bars, Math.floor((t.stoppedAt - scoredStart + beatMs * 0.5) / barMs));
  if (barsPlayed < 1) return null;
  const endTime = scoredStart + barsPlayed * barMs;
  const span = endTime - scoredStart;
  const expected = buildExpectedNotes(exercise, bpm, scoredStart, barsPlayed);

  let rawHits: number[] = [];
  let latencyMs = 0;
  let latencySource: SessionResult['latencySource'] = 'none';
  let recording: SessionResult['recording'];

  if (t.inputMode === 'mic' && t.mic) {
    const { envelope: env, hopMs, startMs } = t.mic;
    const toIndex = (time: number) => Math.round((time - startMs) / hopMs);
    const toTime = (i: number) => i * hopMs + startMs;

    // The count-in bar is for listening: it tells us how loud the room is, and
    // how loud the click is in the mic if it isn't going to headphones.
    const countInFrom = toIndex(t.t0 - 20);
    const countInTo = toIndex(scoredStart - 80);
    const noise = maxIn(env, countInFrom, countInTo);

    // If the click is audible through the mic (speaker, not headphones), its echo
    // measures the full output + input latency directly.
    if (noise > 0.008) {
      const bleed = detectOnsets(env, hopMs, { threshold: noise * 0.5, from: countInFrom, to: countInTo });
      const lags: number[] = [];
      for (let k = 0; k < COUNT_IN_BEATS; k++) {
        const click = t.t0 + k * beatMs;
        const o = bleed.find((b) => {
          const lag = toTime(b.index) - click;
          return lag > 5 && lag < 400;
        });
        if (o) lags.push(toTime(o.index) - click);
      }
      if (lags.length >= 3 && Math.max(...lags) - Math.min(...lags) < 25) {
        latencyMs = median(lags);
        latencySource = 'speaker';
      }
    }
    if (latencySource === 'none' && t.calibratedLatency !== null) {
      latencyMs = t.calibratedLatency;
      latencySource = 'calibrated';
    }

    // Hits must clear the count-in level (room noise + any click bleed) by a margin.
    // If the count-in itself had loud hits in it (someone played early), fall back to
    // half the typical hit level so a noisy count-in can't silence the whole test.
    const { floor, factor } = SENSITIVITY[t.sensitivity];
    const from = toIndex(scoredStart - beatMs / 2);
    const to = toIndex(endTime + beatMs / 2 + latencyMs);
    const candidates = detectOnsets(env, hopMs, { threshold: floor, from, to })
      .map((o) => o.peak)
      .sort((x, y) => x - y);
    const hitLevel = candidates.length ? candidates[Math.floor(candidates.length * 0.75)] : Infinity;
    const threshold = Math.max(floor, Math.min(noise * factor, hitLevel * 0.5));
    rawHits = detectOnsets(env, hopMs, { threshold, from, to }).map((o) => toTime(o.index));

    // Keep the recording, shifted by the latency so it lines up with the grid.
    recording = encodeRecording(-beatMs / 2, span + beatMs / 2, (a, b) =>
      maxIn(env, toIndex(scoredStart + a + latencyMs), toIndex(scoredStart + b + latencyMs)),
    );
  } else {
    rawHits = t.taps ?? [];
    if (t.calibratedLatency !== null) {
      latencyMs = t.calibratedLatency;
      latencySource = 'calibrated';
    }
  }

  const corrected = rawHits.map((h) => h - latencyMs);
  const analysis = analyze(corrected, expected, pocketMs, exercise.bar.length);
  const hits = corrected.map((h) => h - scoredStart).filter((x) => x >= -beatMs / 2 && x <= span + beatMs / 2);

  return {
    exerciseId: exercise.id,
    bpm,
    durationSec: Math.round(span / 1000),
    inputMode: t.inputMode,
    offsets: analysis.notes.map((n) => n.offset),
    extraHits: analysis.extraHits,
    hits,
    recording,
    latencyMs,
    latencySource,
    pocketMs,
    score: analysis.pocketScore,
    meanOffset: analysis.meanOffset,
    coach: coachFor(analysis, exercise, bpm),
  };
}
