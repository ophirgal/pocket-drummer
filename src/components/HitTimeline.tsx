import { ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { classify, type NoteResult } from '@/lib/analysis';
import { classColor, colors } from '@/lib/theme';

const RANGE = 80; // ms shown above and below the beat

/**
 * Every note of the test along a timeline. Dots above the centre line were late,
 * below were early; the shaded band is the pocket. Scrolls sideways for long tests.
 */
export function HitTimeline({
  notes,
  pocketMs,
  width,
  height = 150,
  pxPerNote = 9,
}: {
  notes: NoteResult[];
  pocketMs: number;
  width: number;
  height?: number;
  pxPerNote?: number;
}) {
  const left = 34;
  const inner = Math.max(width - left - 8, notes.length * pxPerNote);
  const total = inner + left + 8;
  const mid = height / 2;
  const y = (ms: number) => mid - (Math.max(-RANGE, Math.min(RANGE, ms)) / RANGE) * (mid - 8);
  const step = inner / Math.max(1, notes.length);
  return (
    <View style={{ flexDirection: 'row' }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={total} height={height}>
          <Rect x={left} y={y(pocketMs)} width={inner} height={y(-pocketMs) - y(pocketMs)} fill={colors.pocket} />
          <Line x1={left} x2={left + inner} y1={mid} y2={mid} stroke={colors.primary} strokeWidth={1} />
          {[RANGE, RANGE / 2, -RANGE / 2, -RANGE].map((v) => (
            <G2 key={v} y={y(v)} left={left} inner={inner} label={`${v > 0 ? '+' : ''}${v}`} />
          ))}
          {notes.map((n, i) => {
            const x = left + (i + 0.5) * step;
            if (n.offset === null) return <Circle key={i} cx={x} cy={mid} r={2.5} fill="none" stroke={colors.textDim} />;
            return <Circle key={i} cx={x} cy={y(n.offset)} r={3.5} fill={classColor[classify(n.offset, pocketMs)]} />;
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

function G2({ y, left, inner, label }: { y: number; left: number; inner: number; label: string }) {
  return (
    <>
      <Line x1={left} x2={left + inner} y1={y} y2={y} stroke={colors.border} strokeWidth={0.6} strokeDasharray="3 4" />
      <SvgText x={left - 4} y={y + 3} fill={colors.textDim} fontSize={9} textAnchor="end">
        {label}
      </SvgText>
    </>
  );
}
