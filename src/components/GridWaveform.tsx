import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { classify, type NoteResult } from '@/lib/analysis';
import type { Exercise } from '@/lib/exercises';
import { levelBetween, type Recording } from '@/lib/recording';
import { classColor, colors, space, type HitClass } from '@/lib/theme';
import { Chip } from './ui';

const ZOOMS = { Close: 150, Normal: 72, Overview: 28 } as const; // px per beat
type Zoom = keyof typeof ZOOMS;

const TILE_W = 512;
const HEIGHT = 176;
const RULER_Y = 11;
const NOTE_Y = 30;
const LANE_TOP = 22;
const WAVE_TOP = 48;
const WAVE_MID = (WAVE_TOP + HEIGHT - 6) / 2;
const WAVE_HALF = (HEIGHT - 6 - WAVE_TOP) / 2;
const CLASSES: HitClass[] = ['onTime', 'rushed', 'dragged'];

/**
 * The recording laid over the beat grid. Top to bottom: bar numbers, the
 * intended notes (coloured by how each one landed, with a line to where it was
 * actually played) and the recorded waveform with every detected hit. Shaded
 * bands are the pocket around each note. Scrolls sideways; drawn in tiles so
 * long tests stay fast.
 *
 * Times are in ms from the first scored beat, latency-corrected: `notes` from
 * analysisOf, `hits` and `recording` from the stored session.
 */
export function GridWaveform({
  exercise,
  bpm,
  notes,
  hits,
  recording,
  pocketMs,
  width,
}: {
  exercise: Exercise;
  bpm: number;
  notes: NoteResult[];
  hits?: number[];
  recording?: Recording | null;
  pocketMs: number;
  width: number;
}) {
  const [zoom, setZoom] = useState<Zoom>('Normal');
  const beatMs = 60000 / bpm;
  const stepMs = beatMs / exercise.stepsPerBeat;
  const bars = notes.length ? notes[notes.length - 1].bar + 1 : 1;
  const startT = -beatMs / 2;
  const endT = bars * beatMs * exercise.beatsPerBar + beatMs / 2;
  const pxPerMs = ZOOMS[zoom] / beatMs;
  const totalW = Math.ceil((endT - startT) * pxPerMs);
  const tiles = useMemo(() => Array.from({ length: Math.ceil(totalW / TILE_W) }, (_, i) => i), [totalW]);

  const tile = (i: number) => (
    <Tile
      w={Math.min(TILE_W, totalW - i * TILE_W)}
      t0={startT + (i * TILE_W) / pxPerMs}
      pxPerMs={pxPerMs}
      exercise={exercise}
      stepMs={stepMs}
      bars={bars}
      notes={notes}
      hits={hits}
      recording={recording}
      pocketMs={pocketMs}
    />
  );

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.zooms}>
        {(Object.keys(ZOOMS) as Zoom[]).map((z) => (
          <Chip key={z} label={z} active={zoom === z} onPress={() => setZoom(z)} />
        ))}
      </View>
      <View style={[styles.frame, { width }]}>
        <FlatList
          key={zoom}
          horizontal
          data={tiles}
          keyExtractor={(i) => String(i)}
          renderItem={({ item }) => tile(item)}
          getItemLayout={(_, i) => ({ length: TILE_W, offset: TILE_W * i, index: i })}
          initialNumToRender={Math.ceil(width / TILE_W) + 1}
          windowSize={5}
          showsHorizontalScrollIndicator={false}
        />
      </View>
      {!recording && <Text style={styles.note}>No recording for this session: showing the notes and hits only.</Text>}
    </View>
  );
}

/** One slice of the timeline, from time `t0` and `w` pixels wide. */
function Tile({
  w,
  t0,
  pxPerMs,
  exercise,
  stepMs,
  bars,
  notes,
  hits,
  recording,
  pocketMs,
}: {
  w: number;
  t0: number;
  pxPerMs: number;
  exercise: Exercise;
  stepMs: number;
  bars: number;
  notes: NoteResult[];
  hits?: number[];
  recording?: Recording | null;
  pocketMs: number;
}) {
  const t1 = t0 + w / pxPerMs;
  const x = (t: number) => (t - t0) * pxPerMs;
  const margin = 40 / pxPerMs; // draw a little past the edges so shapes aren't cut between tiles
  const inView = (t: number) => t >= t0 - margin && t <= t1 + margin;
  const stepPx = stepMs * pxPerMs;
  const spb = exercise.stepsPerBeat;
  const stepsPerBar = exercise.bar.length;

  // Grid: bar lines, beat lines, and subdivisions when there's room.
  let barPath = '';
  let beatPath = '';
  let subPath = '';
  const labels: { x: number; n: number }[] = [];
  const firstStep = Math.max(0, Math.floor(t0 / stepMs));
  const lastStep = Math.min(bars * stepsPerBar, Math.ceil(t1 / stepMs));
  for (let s = firstStep; s <= lastStep; s++) {
    const px = x(s * stepMs).toFixed(1);
    if (s % stepsPerBar === 0) {
      barPath += `M${px} ${LANE_TOP - 4}V${HEIGHT}`;
      if (s < bars * stepsPerBar) labels.push({ x: x(s * stepMs), n: s / stepsPerBar + 1 });
    } else if (s % spb === 0) beatPath += `M${px} ${LANE_TOP}V${HEIGHT}`;
    else if (stepPx >= 9) subPath += `M${px} ${WAVE_TOP}V${HEIGHT}`;
  }

  // Pocket bands, intended notes, and the line from each note to where it was played.
  let pocket = '';
  const dots: Record<HitClass | 'missed', string> = { onTime: '', rushed: '', dragged: '', missed: '' };
  const hitLines: Record<HitClass, string> = { onTime: '', rushed: '', dragged: '' };
  const links: Record<HitClass, string> = { onTime: '', rushed: '', dragged: '' };
  const hands: { x: number; hand: string }[] = [];
  for (const n of notes) {
    const played = n.offset === null ? null : n.time + n.offset;
    if (!inView(n.time) && (played === null || !inView(played))) continue;
    const nx = x(n.time);
    pocket += `M${x(n.time - pocketMs).toFixed(1)} ${LANE_TOP}H${x(n.time + pocketMs).toFixed(1)}V${HEIGHT - 4}H${x(n.time - pocketMs).toFixed(1)}Z`;
    const accent = exercise.bar[n.step]?.accent;
    const r = accent ? 4.5 : 3.5;
    const circle = `M${(nx - r).toFixed(1)} ${NOTE_Y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    if (played === null || n.offset === null) {
      dots.missed += circle;
    } else {
      const c = classify(n.offset, pocketMs);
      dots[c] += circle;
      const hx = x(played).toFixed(1);
      hitLines[c] += `M${hx} ${WAVE_TOP}V${HEIGHT - 6}`;
      links[c] += `M${nx.toFixed(1)} ${NOTE_Y}L${hx} ${WAVE_TOP}`;
    }
    if (stepPx >= 14) hands.push({ x: nx, hand: n.hand });
  }

  // Hits that didn't match a note (extra strokes), drawn faintly.
  let extra = '';
  if (hits) {
    const matched = notes.filter((n) => n.offset !== null).map((n) => n.time + n.offset!);
    for (const h of hits) {
      if (!inView(h) || matched.some((m) => Math.abs(m - h) < 0.5)) continue;
      const hx = x(h).toFixed(1);
      extra += `M${hx} ${WAVE_TOP}V${HEIGHT - 6}`;
    }
  }

  // The recording, one column per 1.5 px, mirrored around the lane's centre.
  let wave = '';
  if (recording) {
    const colPx = 1.5;
    const top: string[] = [];
    const bottom: string[] = [];
    for (let px = 0; px <= w; px += colPx) {
      const t = t0 + px / pxPerMs;
      // sqrt makes quiet strokes visible next to loud accents.
      const h = Math.max(0.5, Math.sqrt(levelBetween(recording, t, t + colPx / pxPerMs)) * WAVE_HALF);
      top.push(`${px.toFixed(1)} ${(WAVE_MID - h).toFixed(1)}`);
      bottom.push(`${px.toFixed(1)} ${(WAVE_MID + h).toFixed(1)}`);
    }
    wave = `M${top.join('L')}L${bottom.reverse().join('L')}Z`;
  }

  return (
    <Svg width={w} height={HEIGHT}>
      <Path d={pocket} fill={colors.pocket} />
      <Path d={subPath} stroke={colors.border} strokeWidth={0.5} opacity={0.5} />
      <Path d={beatPath} stroke={colors.border} strokeWidth={1} />
      <Path d={barPath} stroke={colors.textDim} strokeWidth={1.2} />
      {wave ? <Path d={wave} fill={colors.primaryDeep} opacity={0.85} /> : null}
      <Path d={extra} stroke={colors.textDim} strokeWidth={1.2} strokeDasharray="3 3" />
      {CLASSES.map((c) => (
        <Path key={`l${c}`} d={links[c]} stroke={classColor[c]} strokeWidth={1} opacity={0.7} />
      ))}
      {CLASSES.map((c) => (
        <Path key={`h${c}`} d={hitLines[c]} stroke={classColor[c]} strokeWidth={1.6} />
      ))}
      <Path d={dots.missed} fill="none" stroke={colors.textDim} strokeWidth={1.2} />
      {CLASSES.map((c) => (
        <Path key={`d${c}`} d={dots[c]} fill={classColor[c]} />
      ))}
      {labels.map((l) => (
        <SvgText key={`b${l.n}`} x={l.x + 3} y={RULER_Y} fill={colors.textMuted} fontSize={10} fontWeight="600">
          {l.n}
        </SvgText>
      ))}
      {hands.map((h, i) => (
        <SvgText key={`s${i}`} x={h.x} y={NOTE_Y + 14} fill={colors.textDim} fontSize={8} textAnchor="middle">
          {h.hand}
        </SvgText>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  zooms: { flexDirection: 'row', gap: space.sm },
  frame: { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface },
  note: { color: colors.textDim, fontSize: 12 },
});
