import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { analyze, buildExpectedNotes, median } from '@/lib/analysis';
import { coachFor } from '@/lib/coach';
import type { Exercise } from '@/lib/exercises';
import { EnvelopeBuilder, detectOnsets, maxIn } from '@/lib/onset';
import type { SessionResult, Settings } from '@/state/store';
import { now, TickClock } from './clock';
import { useMicStream } from './micStream';
import { initSounds, play, setPlaybackMode, setRecordingMode } from './sounds';

export type Phase = 'idle' | 'preparing' | 'countIn' | 'recording' | 'analyzing';
export type TestError = 'mic-denied' | 'no-audio' | 'too-short' | null;

const COUNT_IN_BEATS = 4;
const WAVE_POINTS = 64;

const SENSITIVITY = {
  low: { floor: 0.05, factor: 3 },
  medium: { floor: 0.03, factor: 2.2 },
  high: { floor: 0.015, factor: 1.6 },
} as const;

/** Everything about the test in progress. Kept in a ref so audio callbacks see it without re-renders. */
interface Run {
  exercise: Exercise;
  bpm: number;
  durationSec: number;
  settings: Settings;
  beatMs: number;
  barMs: number;
  bars: number;
  t0: number;
  scoredStart: number;
  taps: number[];
  env: EnvelopeBuilder | null;
  /** Smallest (callback time - stream time) seen: maps stream time onto performance.now(). */
  minOffset: number;
}

/**
 * Runs one timing test: a one-bar count-in, then the click for the chosen
 * duration while the microphone listens (or the screen is tapped). When it ends,
 * hits are detected, aligned with the beat grid and analysed.
 */
export function useTestSession(onComplete: (r: SessionResult) => void) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<TestError>(null);
  const [beat, setBeat] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [wave, setWave] = useState<number[]>(() => new Array(WAVE_POINTS).fill(0));
  const clock = useRef(new TickClock());
  const run = useRef<Run | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const mic = useMicStream((samples, sampleRate) => {
    const r = run.current;
    if (!r || r.settings.inputMode !== 'mic') return;
    if (!r.env) r.env = new EnvelopeBuilder(sampleRate, r.durationSec + 15);
    r.env.push(samples);
    const streamMs = (r.env.totalSamples / r.env.sampleRate) * 1000;
    r.minOffset = Math.min(r.minOffset, now() - streamMs);
  });

  const teardown = useCallback(() => {
    clock.current.stop();
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    mic.stop();
    setPlaybackMode().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const finish = useCallback(() => {
    const r = run.current;
    if (!r) return;
    clock.current.stop();
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setPhase('analyzing');
    const stoppedAt = now();
    // Let the last hit's audio arrive before stopping the mic.
    setTimeout(() => {
      teardown();
      run.current = null;
      const result = analyzeRun(r, stoppedAt);
      setBeat(-1);
      if (!result) {
        setError('too-short');
        setPhase('idle');
        return;
      }
      setPhase('idle');
      onCompleteRef.current(result);
    }, 350);
  }, [teardown]);

  const start = useCallback(
    async (exercise: Exercise, bpm: number, settings: Settings) => {
      setError(null);
      setElapsed(0);
      setWave(new Array(WAVE_POINTS).fill(0));
      setPhase('preparing');
      const beatMs = 60000 / bpm;
      const barMs = beatMs * exercise.beatsPerBar;
      const bars = Math.max(1, Math.round((settings.durationSec * 1000) / barMs));
      const r: Run = {
        exercise,
        bpm,
        durationSec: settings.durationSec,
        settings,
        beatMs,
        barMs,
        bars,
        t0: 0,
        scoredStart: 0,
        taps: [],
        env: null,
        minOffset: Infinity,
      };
      run.current = r;

      await initSounds();
      if (settings.inputMode === 'mic') {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          run.current = null;
          setError('mic-denied');
          setPhase('idle');
          return;
        }
        await setRecordingMode();
        try {
          await mic.start();
        } catch {
          run.current = null;
          setError('no-audio');
          setPhase('idle');
          return;
        }
        // Wait for audio to flow before starting the click.
        const t = now();
        while (!r.env && now() - t < 2000) await new Promise((res) => setTimeout(res, 50));
        if (!r.env) {
          teardown();
          run.current = null;
          setError('no-audio');
          setPhase('idle');
          return;
        }
      }
      if (run.current !== r) return; // cancelled while preparing

      const totalBeats = COUNT_IN_BEATS + bars * exercise.beatsPerBar;
      r.t0 = clock.current.begin({
        intervalMs: beatMs,
        leadInMs: 300,
        totalTicks: totalBeats,
        onTick: ({ index }) => {
          const inBar = index % exercise.beatsPerBar;
          play(inBar === 0 ? 'accent' : 'click', settings.clickVolume);
          setBeat(inBar);
          if (index < COUNT_IN_BEATS) {
            setPhase('countIn');
            if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          } else if (index === COUNT_IN_BEATS) setPhase('recording');
        },
        // One more beat so the final notes of the last bar can land.
        onDone: () => setTimeout(finish, beatMs),
      });
      r.scoredStart = r.t0 + COUNT_IN_BEATS * beatMs;

      ticker.current = setInterval(() => {
        const cur = run.current;
        if (!cur) return;
        setElapsed(Math.max(0, (now() - cur.scoredStart) / 1000));
        const level = cur.env ? cur.env.recentPeak(80) : 0;
        setWave((w) => [...w.slice(1), level]);
      }, 80);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teardown, finish],
  );

  const cancel = useCallback(() => {
    run.current = null;
    teardown();
    setBeat(-1);
    setPhase('idle');
  }, [teardown]);

  /** Tap mode: record a hit at this time. Returns false if not recording. */
  const tap = useCallback((time: number) => {
    const r = run.current;
    if (!r || r.settings.inputMode !== 'tap') return false;
    r.taps.push(time);
    setWave((w) => [...w.slice(1), 1]);
    return true;
  }, []);

  // phase/error/beat/elapsed/wave drive the UI; start/finish/cancel/tap control the test.
  return { phase, error, beat, elapsed, wave, start, finish, cancel, tap, clearError: () => setError(null) };
}

/** Detect hits, correct for latency, and score them against the exercise. */
function analyzeRun(r: Run, stoppedAt: number): SessionResult | null {
  const { exercise, bpm, settings, beatMs, barMs } = r;
  const barsPlayed = Math.min(r.bars, Math.floor((stoppedAt - r.scoredStart + beatMs * 0.5) / barMs));
  if (barsPlayed < 1) return null;
  const endTime = r.scoredStart + barsPlayed * barMs;
  const expected = buildExpectedNotes(exercise, bpm, r.scoredStart, barsPlayed);

  let hits: number[] = [];
  let latencyMs = 0;
  let latencySource: SessionResult['latencySource'] = 'none';
  let waveform: number[] = [];

  if (settings.inputMode === 'mic' && r.env) {
    const env = r.env.envelope;
    const hopMs = r.env.hopMs;
    const toIndex = (t: number) => Math.round((t - r.minOffset) / hopMs);
    const toTime = (i: number) => i * hopMs + r.minOffset;

    // The count-in bar is for listening: it tells us how loud the room and the click bleed are.
    const countInFrom = toIndex(r.t0 - 20);
    const countInTo = toIndex(r.scoredStart - 80);
    const noise = maxIn(env, countInFrom, countInTo);

    // If the click is audible through the mic (speaker, not headphones), its echo
    // measures the full output + input latency directly.
    if (noise > 0.008) {
      const bleed = detectOnsets(env, hopMs, { threshold: noise * 0.5, from: countInFrom, to: countInTo });
      const lags: number[] = [];
      for (let k = 0; k < COUNT_IN_BEATS; k++) {
        const click = r.t0 + k * beatMs;
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
    if (latencySource === 'none' && settings.latency.mic !== null) {
      latencyMs = settings.latency.mic;
      latencySource = 'calibrated';
    }

    // Hits must clear the count-in level (room noise + click bleed) by a margin. If the
    // count-in itself had loud hits in it (someone played early), fall back to half the
    // typical hit level so a noisy count-in can't silence the whole test.
    const { floor, factor } = SENSITIVITY[settings.sensitivity];
    const from = toIndex(r.scoredStart - beatMs / 2);
    const to = toIndex(endTime + beatMs / 2 + latencyMs);
    const candidates = detectOnsets(env, hopMs, { threshold: floor, from, to })
      .map((o) => o.peak)
      .sort((x, y) => x - y);
    const hitLevel = candidates.length ? candidates[Math.floor(candidates.length * 0.75)] : Infinity;
    const threshold = Math.max(floor, Math.min(noise * factor, hitLevel * 0.5));
    const onsets = detectOnsets(env, hopMs, { threshold, from, to });
    hits = onsets.map((o) => toTime(o.index));

    // Waveform of the scored part, for the result screens.
    const a = toIndex(r.scoredStart);
    const b = toIndex(endTime + latencyMs);
    const points = 240;
    const peak = Math.max(1e-4, maxIn(env, a, b));
    for (let p = 0; p < points; p++) {
      const from = a + Math.floor(((b - a) * p) / points);
      const to = a + Math.floor(((b - a) * (p + 1)) / points);
      waveform.push(Math.min(1, maxIn(env, from, to) / peak));
    }
  } else {
    hits = r.taps;
    if (settings.latency.tap !== null) {
      latencyMs = settings.latency.tap;
      latencySource = 'calibrated';
    }
  }

  const corrected = hits.map((h) => h - latencyMs);
  const analysis = analyze(corrected, expected, settings.pocketMs, exercise.bar.length);
  const span = endTime - r.scoredStart;
  const hitMarks = corrected.map((h) => (h - r.scoredStart) / span).filter((x) => x >= -0.02 && x <= 1.02);
  if (!waveform.length) {
    // Tap mode: draw a spike per tap.
    waveform = new Array(240).fill(0.04);
    for (const m of hitMarks) {
      const i = Math.round(m * 239);
      if (i >= 0 && i < 240) waveform[i] = 1;
    }
  }

  return {
    id: `${Date.now()}`,
    date: Date.now(),
    exerciseId: exercise.id,
    bpm,
    durationSec: Math.round(span / 1000),
    inputMode: settings.inputMode,
    offsets: analysis.notes.map((n) => n.offset),
    extraHits: analysis.extraHits,
    waveform,
    hitMarks,
    latencyMs,
    latencySource,
    pocketMs: settings.pocketMs,
    score: analysis.pocketScore,
    meanOffset: analysis.meanOffset,
    coach: coachFor(analysis, exercise, bpm),
  };
}
