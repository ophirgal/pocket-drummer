import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ClockSync, perfNow } from '@/lib/clockSync';
import type { Exercise } from '@/lib/exercises';
import { EnvelopeBuilder } from '@/lib/onset';
import { COUNT_IN_BEATS, scoreTest } from '@/lib/scoring';
import type { AudioRoute, SessionResult, Settings } from '@/state/store';
import { applyMicPreference, currentRoute, requestMicPermission } from './devices';
import { getEngine, type Engine } from './engine';
import { Metronome } from './metronome';
import { createMicCapture, type ChunkListener } from './recorder';

export type Phase = 'idle' | 'preparing' | 'countIn' | 'recording' | 'analyzing';
export type TestError = 'mic-denied' | 'no-audio' | 'too-short' | null;

const WAVE_POINTS = 64;
const UNKNOWN_ROUTE: AudioRoute = { key: 'unknown', label: 'Unknown output', headphones: false };

/** Everything about the test in progress. Kept in a ref so audio callbacks see it without re-renders. */
interface Run {
  exercise: Exercise;
  bpm: number;
  settings: Settings;
  bars: number;
  beatMs: number;
  /** Audio-clock time (ms) of the first count-in click. */
  t0: number;
  /** Tap times, on performance.now(). */
  taps: number[];
  /** Mic envelope; index 0 is the start of the recording. */
  env: EnvelopeBuilder | null;
  sync: ClockSync;
  route: AudioRoute;
  micName?: string;
}

/**
 * Runs one timing test: a one-bar count-in, then the click for the chosen
 * duration while the microphone listens (or the screen is tapped). When it ends,
 * hits are detected, aligned with the beat grid and scored (see lib/scoring.ts).
 *
 * The click is scheduled on the audio clock by the Metronome; mic audio and taps
 * are mapped onto that same clock by ClockSync, so hits and beats are compared
 * on one timeline.
 */
export function useTestSession(onComplete: (r: SessionResult) => void) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<TestError>(null);
  const [beat, setBeat] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [wave, setWave] = useState<number[]>(() => new Array(WAVE_POINTS).fill(0));
  const engine = useRef<Engine | null>(null);
  const metronome = useRef<Metronome | null>(null);
  const capture = useRef(createMicCapture());
  const stopping = useRef<Promise<void>>(Promise.resolve());
  const run = useRef<Run | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  /** Take a reading of the audio clock against performance.now() for ClockSync. */
  const sampleClock = (r: Run) => {
    if (engine.current) r.sync.observeContext(engine.current.nowMs(), perfNow());
  };

  const onChunk: ChunkListener = (samples, sampleRate, startMs) => {
    const r = run.current;
    if (!r) return;
    const arrived = perfNow();
    if (!r.env) r.env = new EnvelopeBuilder(sampleRate, r.settings.durationSec + 20);
    r.env.push(samples, Math.round((startMs * sampleRate) / 1000));
    r.sync.observeStream(startMs + (samples.length / sampleRate) * 1000, arrived);
    sampleClock(r);
  };

  /** Stop the click, the mic and the UI timer. */
  const teardown = useCallback(() => {
    metronome.current?.stop();
    engine.current?.stopAll();
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    stopping.current = capture.current.stop().catch(() => {});
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const finish = useCallback(() => {
    const r = run.current;
    const eng = engine.current;
    if (!r || !eng) return;
    metronome.current?.stop();
    eng.stopAll();
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setPhase('analyzing');
    const stoppedAt = eng.nowMs();
    // Let the last hit's audio arrive before stopping the mic.
    setTimeout(() => {
      teardown();
      run.current = null;
      setBeat(-1);
      const scored = scoreTest({
        exercise: r.exercise,
        bpm: r.bpm,
        inputMode: r.settings.inputMode,
        sensitivity: r.settings.sensitivity,
        pocketMs: r.settings.pocketMs,
        calibratedLatency: r.settings.latency[r.settings.inputMode][r.route.key] ?? null,
        t0: r.t0,
        bars: r.bars,
        stoppedAt,
        mic: r.env ? { envelope: r.env.envelope, hopMs: r.env.hopMs, startMs: r.sync.streamToContext(0) } : undefined,
        taps: r.taps.map((t) => r.sync.perfToContext(t)),
      });
      setPhase('idle');
      if (!scored) {
        setError('too-short');
        return;
      }
      onCompleteRef.current({ id: `${Date.now()}`, date: Date.now(), ...scored, route: r.route, micName: r.micName });
    }, 350);
  }, [teardown]);

  const start = useCallback(
    async (exercise: Exercise, bpm: number, settings: Settings) => {
      setError(null);
      setElapsed(0);
      setWave(new Array(WAVE_POINTS).fill(0));
      setPhase('preparing');
      const beatMs = 60000 / bpm;
      const bars = Math.max(1, Math.round((settings.durationSec * 1000) / (beatMs * exercise.beatsPerBar)));
      const r: Run = { exercise, bpm, settings, bars, beatMs, t0: 0, taps: [], env: null, sync: new ClockSync(), route: UNKNOWN_ROUTE };
      run.current = r;
      const fail = (e: TestError) => {
        if (run.current !== r) return;
        teardown();
        run.current = null;
        setError(e);
        setPhase('idle');
      };

      await stopping.current; // a restart may still be closing the previous recording
      let eng: Engine;
      try {
        eng = engine.current = await getEngine();
      } catch {
        return fail('no-audio');
      }
      metronome.current ??= new Metronome(eng);
      r.route = await currentRoute().catch(() => UNKNOWN_ROUTE);

      if (settings.inputMode === 'mic') {
        if (!(await requestMicPermission().catch(() => false))) return fail('mic-denied');
        r.micName = (await applyMicPreference(settings.micInput).catch(() => null))?.name;
        try {
          await capture.current.start(onChunk);
        } catch {
          return fail('no-audio');
        }
        // Wait for audio to flow before starting the click.
        const t = perfNow();
        while (!r.env && perfNow() - t < 2000) await new Promise((res) => setTimeout(res, 50));
        if (!r.env) return fail('no-audio');
      }
      if (run.current !== r) return; // cancelled while preparing

      const bpb = exercise.beatsPerBar;
      sampleClock(r);
      r.t0 = eng.nowMs() + 300;
      metronome.current.start({
        startMs: r.t0,
        intervalMs: beatMs,
        totalTicks: COUNT_IN_BEATS + bars * bpb,
        onSchedule: (index, whenMs) => eng.play(index % bpb === 0 ? 'accent' : 'click', whenMs / 1000, settings.clickVolume),
        onTick: (index) => {
          sampleClock(r);
          setBeat(index % bpb);
          if (index < COUNT_IN_BEATS) {
            setPhase('countIn');
            if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          } else if (index === COUNT_IN_BEATS) setPhase('recording');
        },
        // Half a beat more so the final notes of the last bar can land.
        onDone: () => setTimeout(finish, beatMs / 2),
      });

      const scoredStart = r.t0 + COUNT_IN_BEATS * beatMs;
      ticker.current = setInterval(() => {
        if (run.current !== r) return;
        sampleClock(r);
        setElapsed(Math.max(0, (eng.nowMs() - scoredStart) / 1000));
        const level = r.env ? r.env.recentPeak(80) : 0;
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

  /** Tap mode: record a hit at this performance.now() time. Returns false if not recording. */
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
