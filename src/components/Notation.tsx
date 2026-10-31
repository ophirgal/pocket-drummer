import type { ReactElement } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { classify } from '@/lib/analysis';
import type { Exercise } from '@/lib/exercises';
import { classColor, colors } from '@/lib/theme';

const T = 16; // top padding above the staff (room for accents)
const LINE_GAP = 10;
const NOTE_Y = T + 20 + LINE_GAP * 1.5; // third space from the bottom: the snare/pad position
const STEM_TOP = NOTE_Y - 30;
const LEFT = 34;
const RIGHT = 10;

/** Height of the notation without per-note offsets. */
export const NOTATION_HEIGHT = 108;
/** Vertical span of the staff, for drawing over it. */
export const STAFF_TOP = T + 20;
export const STAFF_BOTTOM = T + 60;

/**
 * x position of a (fractional) step of the bar. Notes are centred on their step,
 * so step s is drawn at s + 0.5 step widths from the left margin, and a moment in
 * time `t` ms into the bar is at step t / stepMs.
 */
export function notationX(exercise: Exercise, width: number, step: number): number {
  return LEFT + (step + 0.5) * ((width - LEFT - RIGHT) / exercise.bar.length);
}

/**
 * One bar of the exercise in drum notation, with sticking underneath. When
 * `stepMean` is given, each notehead is coloured by how that note of the pattern
 * landed on average (on time, rushed or dragged) and its average offset is shown.
 */
export function Notation({
  exercise,
  width,
  stepMean,
  pocketMs = 20,
}: {
  exercise: Exercise;
  width: number;
  stepMean?: (number | null)[];
  pocketMs?: number;
}) {
  const beats = exercise.beatsPerBar;
  const spb = exercise.stepsPerBeat;
  const xOf = (step: number) => notationX(exercise, width, step);
  const height = stepMean ? 122 : NOTATION_HEIGHT;

  const colorOf = (step: number) => {
    if (!stepMean) return colors.text;
    const m = stepMean[step];
    return m === null || m === undefined ? colors.textDim : classColor[classify(m, pocketMs)];
  };

  const beams: ReactElement[] = [];
  for (let b = 0; b < beats; b++) {
    const steps = exercise.bar.map((n, s) => (n && Math.floor(s / spb) === b ? s : -1)).filter((s) => s >= 0);
    if (steps.length >= 2) {
      const x1 = xOf(steps[0]) + 5;
      const x2 = xOf(steps[steps.length - 1]) + 5;
      beams.push(<Rect key={`b${b}`} x={x1} y={STEM_TOP} width={x2 - x1} height={4} fill={colors.text} />);
      if (spb === 4) beams.push(<Rect key={`bb${b}`} x={x1} y={STEM_TOP + 7} width={x2 - x1} height={4} fill={colors.text} />);
      if (spb === 3)
        beams.push(
          <SvgText key={`t${b}`} x={(x1 + x2) / 2} y={STEM_TOP - 4} fill={colors.textMuted} fontSize={10} textAnchor="middle">
            3
          </SvgText>,
        );
    } else if (steps.length === 1) {
      const x = xOf(steps[0]) + 5;
      beams.push(
        <Path key={`f${b}`} d={`M${x} ${STEM_TOP} q 8 6 7 16`} stroke={colors.text} strokeWidth={2.5} fill="none" />,
      );
    }
  }

  return (
    <Svg width={width} height={height}>
      {/* staff */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Line key={i} x1={4} x2={width - 4} y1={T + 20 + i * LINE_GAP} y2={T + 20 + i * LINE_GAP} stroke={colors.textDim} strokeWidth={1} />
      ))}
      {/* percussion clef */}
      <Rect x={12} y={T + 30} width={4} height={20} fill={colors.text} />
      <Rect x={20} y={T + 30} width={4} height={20} fill={colors.text} />
      {/* end bar line */}
      <Line x1={width - 4} x2={width - 4} y1={T + 20} y2={T + 60} stroke={colors.textMuted} strokeWidth={2} />

      {beams}

      {exercise.bar.map((note, step) => {
        const x = xOf(step);
        if (!note) {
          return (
            <G key={step}>
              <Path d={`M${x - 3} ${NOTE_Y - 6} l 6 0 l -5 12`} stroke={colors.textDim} strokeWidth={1.6} fill="none" />
              <Circle cx={x - 3} cy={NOTE_Y - 6} r={1.8} fill={colors.textDim} />
            </G>
          );
        }
        const c = colorOf(step);
        const m = stepMean?.[step];
        return (
          <G key={step}>
            {note.flam && (
              <G>
                <Ellipse cx={x - 10} cy={NOTE_Y + 1} rx={3.2} ry={2.4} fill={colors.textMuted} />
                <Line x1={x - 7} x2={x - 7} y1={NOTE_Y} y2={NOTE_Y - 16} stroke={colors.textMuted} strokeWidth={1.2} />
              </G>
            )}
            <Line x1={x + 5} x2={x + 5} y1={NOTE_Y - 1} y2={STEM_TOP} stroke={colors.text} strokeWidth={1.6} />
            <Ellipse cx={x} cy={NOTE_Y} rx={5.6} ry={4.1} fill={c} transform={`rotate(-20 ${x} ${NOTE_Y})`} />
            {note.accent && (
              <Path d={`M${x - 4} ${T - 12} l 8 3 l -8 3`} stroke={colors.textMuted} strokeWidth={1.5} fill="none" />
            )}
            <SvgText x={x} y={T + 78} fill={colors.textMuted} fontSize={12} fontWeight="600" textAnchor="middle">
              {note.hand}
            </SvgText>
            {stepMean && m !== null && m !== undefined && (
              <SvgText x={x} y={T + 96} fill={c} fontSize={9.5} textAnchor="middle">
                {m > 0 ? '+' : ''}
                {Math.round(m)}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}
