import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { LiveView } from '@/audio/useTestSession';
import { classify } from '@/lib/analysis';
import type { Exercise } from '@/lib/exercises';
import { classColor, colors } from '@/lib/theme';
import { NOTATION_HEIGHT, Notation, STAFF_BOTTOM, STAFF_TOP, notationX } from './Notation';

const StaticNotation = memo(Notation);

const LINE_TOP = STAFF_TOP - 14;
const LINE_BOTTOM = STAFF_BOTTOM + 8;

interface Frame {
  /** Playhead position, or null when there's nothing running. */
  playhead: number | null;
  hits: { x: number; color: string }[];
}

const EMPTY: Frame = { playhead: null, hits: [] };

/**
 * The bar of notation, standing still, with the test drawn over it as it runs:
 * a playhead sweeps left to right through each bar (the count-in bar too), and
 * every hit appears as a vertical line where it landed, coloured by how far it
 * is from the nearest note (on time, early or late). When the playhead wraps to
 * the next bar, the lines are cleared and the bar starts clean.
 *
 * Notes are centred on their beat, so a bar's drawing runs from half a step
 * before its first beat to half a step before the next bar's: a stroke slightly
 * early for beat one shows just left of the first note, in the new bar.
 */
export function LiveNotation({
  exercise,
  width,
  pocketMs,
  active,
  getLive,
}: {
  exercise: Exercise;
  width: number;
  pocketMs: number;
  /** Redraw every frame only while a test runs. */
  active: boolean;
  getLive: () => LiveView | null;
}) {
  const [frame, setFrame] = useState<Frame>(EMPTY);

  useEffect(() => {
    if (!active) return;
    const steps = exercise.bar.length;
    const noteSteps = exercise.bar.flatMap((n, s) => (n ? [s] : []));
    let id = 0;
    const draw = () => {
      id = requestAnimationFrame(draw);
      const v = getLive();
      if (!v) return setFrame(EMPTY);
      const stepMs = v.barMs / steps;
      // Which bar a moment is drawn in (-1 = count-in), and where in it, in steps.
      const place = (t: number) => {
        const rel = t - v.scoredStart + stepMs / 2;
        const bar = Math.floor(rel / v.barMs);
        return { bar, step: (rel - bar * v.barMs) / stepMs - 0.5 };
      };
      const now = place(v.now);
      if (now.bar < -1) return setFrame(EMPTY);
      const hits: Frame['hits'] = [];
      for (let i = v.hits.length - 1; i >= 0; i--) {
        const h = place(v.hits[i]);
        if (h.bar < now.bar) break; // hits are in time order; older bars are cleared
        if (h.bar !== now.bar) continue;
        const nearest = noteSteps.reduce((a, b) => (Math.abs(b - h.step) < Math.abs(a - h.step) ? b : a), noteSteps[0] ?? 0);
        hits.push({ x: notationX(exercise, width, h.step), color: classColor[classify((h.step - nearest) * stepMs, pocketMs)] });
      }
      setFrame({ playhead: notationX(exercise, width, now.step), hits });
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [active, getLive, exercise, width, pocketMs]);
  const shown = active ? frame : EMPTY;

  return (
    <View style={{ width, height: NOTATION_HEIGHT }}>
      <StaticNotation exercise={exercise} width={width} />
      <Svg width={width} height={NOTATION_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
        {shown.hits.map((h, i) => (
          <Line key={i} x1={h.x} x2={h.x} y1={LINE_TOP} y2={LINE_BOTTOM} stroke={h.color} strokeWidth={3} strokeLinecap="round" />
        ))}
        {shown.playhead !== null && (
          <Line
            x1={shown.playhead}
            x2={shown.playhead}
            y1={LINE_TOP - 4}
            y2={LINE_BOTTOM + 4}
            stroke={colors.teal}
            strokeWidth={2}
            opacity={0.9}
          />
        )}
      </Svg>
    </View>
  );
}
