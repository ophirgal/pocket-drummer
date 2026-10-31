import { useCallback, useEffect, useRef, useState } from 'react';
import type { Exercise } from '@/lib/exercises';
import { getEngine, type Engine } from './engine';
import { Metronome } from './metronome';

/**
 * Plays two bars of an exercise's pattern on the pad sound over a quiet click,
 * so you can hear it before playing it. `previewing` is the id of the exercise
 * playing, or null. Toggling the one that's playing stops it.
 */
export function usePatternPreview() {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const engine = useRef<Engine | null>(null);
  const metronome = useRef<Metronome | null>(null);

  const stop = useCallback(() => {
    metronome.current?.stop();
    engine.current?.stopAll();
    setPreviewing(null);
  }, []);

  const play = useCallback(
    async (e: Exercise, bpm = e.defaultBpm) => {
      stop();
      let eng: Engine;
      try {
        eng = engine.current = await getEngine();
      } catch {
        return;
      }
      metronome.current ??= new Metronome(eng);
      setPreviewing(e.id);
      metronome.current.start({
        startMs: eng.nowMs() + 100,
        intervalMs: 60000 / bpm / e.stepsPerBeat,
        totalTicks: e.bar.length * 2,
        onSchedule: (index, whenMs) => {
          const s = index % e.bar.length;
          if (s % e.stepsPerBeat === 0) eng.play(s === 0 ? 'accent' : 'click', whenMs / 1000, 0.35);
          const note = e.bar[s];
          if (note) eng.play('pad', whenMs / 1000, note.accent ? 1 : 0.6);
        },
        onDone: () => setPreviewing(null),
      });
    },
    [stop],
  );

  const toggle = useCallback(
    (e: Exercise, bpm?: number) => (previewing === e.id ? stop() : play(e, bpm)),
    [previewing, stop, play],
  );

  useEffect(
    () => () => {
      metronome.current?.stop();
      engine.current?.stopAll();
    },
    [],
  );

  return { previewing, toggle, stop };
}
