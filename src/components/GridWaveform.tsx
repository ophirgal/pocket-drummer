import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { classify, type NoteResult } from '@/lib/analysis';
import type { Exercise } from '@/lib/exercises';
import { levelBetween, type Recording } from '@/lib/recording';
import { classColor, colors, space, type HitClass } from '@/lib/theme';
import { Chip } from './ui';

export const ZOOMS = { Strokes: 320, Beats: 120, Bars: 44 } as const; // px per beat
export type Zoom = keyof typeof ZOOMS;

const TILE_W = 512;
const HEIGHT = 190;
/** Without a recording there's no waveform lane, only the notes and hits. */
const HEIGHT_NO_RECORDING = 100;
const RULER_Y = 12;
const HAND_Y = 27;
const NOTE_Y = 44;
const LANE_TOP = 33; // top of the pocket bands and beat lines
const TICK_TOP = NOTE_Y - 11;
const WAVE_TOP = 66;
const WAVE_MID = (WAVE_TOP + HEIGHT - 6) / 2;
const WAVE_HALF = (HEIGHT - 6 - WAVE_TOP) / 2;
const CLASSES: HitClass[] = ['onTime', 'rushed', 'dragged'];

/**
 * Where each hit landed relative to the note it was meant to be.
 *
 * Every note of the test sits on the beat grid as a white ring (bigger for
 * accents, dashed if it was missed). Each hit the app detected is a tick through
 * that same row, coloured on time / rushed / dragged, with a bar from the note
 * to the hit showing how far off it was; when zoomed in, the offset is written
 * under it. The ticks continue down into the recorded waveform, so each one can
 * be matched to the sound that made it. Shaded bands are the pocket.
 *
 * Scrolls sideways and is drawn in tiles, so long tests stay fast. Times are in
 * ms from the first scored beat, latency-corrected: `notes` from analysisOf,
 * `hits` and `recording` from the stored session.
 */
export function GridWaveform({
  exercise,
  bpm,
  notes,
  hits,
  recording,
  pocketMs,
  width,
  initialZoom = 'Beats',
}: {
  exercise: Exercise;
  bpm: number;
  notes: NoteResult[];
  hits?: number[];
  recording?: Recording | null;
  pocketMs: number;
  width: number;
  initialZoom?: Zoom;
}) {
  const [zoom, setZoom] = useState<Zoom>(initialZoom);
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
      height={recording ? HEIGHT : HEIGHT_NO_RECORDING}
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
      <View style={styles.legend}>
        <Key ring label="Note to play" />
        <Key color={classColor.onTime} label="Your hit: on time" />
        <Key color={classColor.rushed} label="early" />
        <Key color={classColor.dragged} label="late" />
      </View>
      {!recording && <Text style={styles.note}>No recording for this session: showing the notes and hits only.</Text>}
    </View>
  );
}

function Key({ color, ring, label }: { color?: string; ring?: boolean; label: string }) {
  return (
    <View style={styles.key}>
      {ring ? <View style={styles.ring} /> : <View style={[styles.tick, { backgroundColor: color }]} />}
      <Text style={styles.keyText}>{label}</Text>
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
  height,
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
  height: number;
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
      barPath += `M${px} ${RULER_Y + 4}V${height}`;
      if (s < bars * stepsPerBar) labels.push({ x: x(s * stepMs), n: s / stepsPerBar + 1 });
    } else if (s % spb === 0) beatPath += `M${px} ${LANE_TOP}V${height}`;
    else if (stepPx >= 9) subPath += `M${px} ${LANE_TOP}V${height}`;
  }

  // Pocket bands, the notes to play, and each hit with its distance from its note.
  let pocket = '';
  let rings = '';
  let missed = '';
  const ticks: Record<HitClass, string> = { onTime: '', rushed: '', dragged: '' };
  const gaps: Record<HitClass, string> = { onTime: '', rushed: '', dragged: '' };
  const hands: { x: number; hand: string }[] = [];
  const offsets: { x: number; text: string; c: HitClass }[] = [];
  for (const n of notes) {
    const played = n.offset === null ? null : n.time + n.offset;
    if (!inView(n.time) && (played === null || !inView(played))) continue;
    const nx = x(n.time);
    pocket += `M${x(n.time - pocketMs).toFixed(1)} ${LANE_TOP}H${x(n.time + pocketMs).toFixed(1)}V${height - 4}H${x(n.time - pocketMs).toFixed(1)}Z`;
    const r = exercise.bar[n.step]?.accent ? 6.5 : 5;
    const ring = `M${(nx - r).toFixed(1)} ${NOTE_Y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    if (played === null || n.offset === null) {
      missed += ring;
    } else {
      rings += ring;
      const c = classify(n.offset, pocketMs);
      const hx = x(played).toFixed(1);
      ticks[c] += `M${hx} ${TICK_TOP}V${height - 6}`;
      gaps[c] += `M${nx.toFixed(1)} ${NOTE_Y}H${hx}`;
      if (stepPx >= 28) offsets.push({ x: x(played), text: `${n.offset > 0 ? '+' : ''}${Math.round(n.offset)}`, c });
    }
    if (stepPx >= 14) hands.push({ x: nx, hand: n.hand });
  }

  // Hits that didn't match a note (extra strokes), drawn faintly.
  let extra = '';
  if (hits) {
    const matched = notes.filter((n) => n.offset !== null).map((n) => n.time + n.offset!);
    for (const h of hits) {
      if (!inView(h) || matched.some((m) => Math.abs(m - h) < 0.5)) continue;
      extra += `M${x(h).toFixed(1)} ${TICK_TOP}V${height - 6}`;
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
    <Svg width={w} height={height}>
      <Path d={pocket} fill={colors.pocket} />
      <Path d={subPath} stroke={colors.border} strokeWidth={0.5} opacity={0.6} />
      <Path d={beatPath} stroke={colors.border} strokeWidth={1} />
      <Path d={barPath} stroke={colors.textDim} strokeWidth={1.2} />
      {wave ? <Path d={wave} fill={colors.primaryDeep} opacity={0.85} /> : null}
      <Path d={missed} fill="none" stroke={colors.textDim} strokeWidth={1.2} strokeDasharray="2 2" />
      <Path d={rings} fill={colors.surface} stroke={colors.text} strokeWidth={1.6} />
      {CLASSES.map((c) => (
        <Path key={`g${c}`} d={gaps[c]} stroke={classColor[c]} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      ))}
      <Path d={extra} stroke={colors.textDim} strokeWidth={1.5} strokeDasharray="3 3" />
      {CLASSES.map((c) => (
        <Path key={`t${c}`} d={ticks[c]} stroke={classColor[c]} strokeWidth={2} />
      ))}
      {labels.map((l) => (
        <SvgText key={`b${l.n}`} x={l.x + 3} y={RULER_Y} fill={colors.textMuted} fontSize={10} fontWeight="600">
          {l.n}
        </SvgText>
      ))}
      {hands.map((h, i) => (
        <SvgText key={`s${i}`} x={h.x} y={HAND_Y} fill={colors.textDim} fontSize={9} textAnchor="middle">
          {h.hand}
        </SvgText>
      ))}
      {offsets.map((o, i) => (
        <SvgText key={`o${i}`} x={o.x + 4} y={WAVE_TOP + 8} fill={classColor[o.c]} fontSize={9} fontWeight="600">
          {o.text}
        </SvgText>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  zooms: { flexDirection: 'row', gap: space.sm },
  frame: { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: 4 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ring: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: colors.text },
  tick: { width: 2.5, height: 12, borderRadius: 1 },
  keyText: { color: colors.textMuted, fontSize: 12 },
  note: { color: colors.textDim, fontSize: 12 },
});
