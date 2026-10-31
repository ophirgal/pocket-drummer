import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GridWaveform } from '@/components/GridWaveform';
import { HitTimeline } from '@/components/HitTimeline';
import { Notation } from '@/components/Notation';
import { Body, Card, Header, Screen, SliderRow, Stat } from '@/components/ui';
import { playedTempo } from '@/lib/analysis';
import { decodeRecording } from '@/lib/recording';
import { analysisOf, formatDuration } from '@/lib/session';
import { colors, space } from '@/lib/theme';
import { useStore } from '@/state/store';

/**
 * The in-depth view of the `current` session: per-note average offsets on the
 * notation, the recording laid over the beat grid with every intended note and
 * detected hit, each hit's offset on a timeline, summary stats, and a
 * pocket-width slider that rescores live.
 */
export default function Detail() {
  const { current, settings, updateSettings } = useStore();
  const { width } = useWindowDimensions();
  const built = useMemo(() => (current ? analysisOf(current, settings.pocketMs) : null), [current, settings.pocketMs]);
  const stored = current?.recording;
  const recording = useMemo(() => (stored ? decodeRecording(stored) : null), [stored]);
  if (!current || !built) return <Redirect href="/" />;
  const { analysis, exercise } = built;
  const inner = Math.min(width, 520) - space.md * 4;
  const tempo = playedTempo(analysis, current.bpm);

  return (
    <Screen>
      <Header title="Detailed View" onBack={() => router.back()} />
      <Card>
        <Text style={styles.name}>{exercise.name}</Text>
        <Text style={styles.meta}>
          {current.bpm} BPM • {formatDuration(current.durationSec)}
        </Text>
        <Notation exercise={exercise} width={inner} stepMean={analysis.stepMean} pocketMs={settings.pocketMs} />
        <View style={styles.legend}>
          <Legend color={colors.onTime} label="On time" />
          <Legend color={colors.rushed} label="Rushed" />
          <Legend color={colors.dragged} label="Dragged" />
          <Legend color={colors.primaryDeep} label="Pocket" square />
        </View>
        <Text style={styles.caption}>Numbers under each note are its average offset in ms (+ late, − early).</Text>
      </Card>

      <Card>
        <Text style={styles.section}>Your playing on the grid</Text>
        <GridWaveform
          exercise={exercise}
          bpm={current.bpm}
          notes={analysis.notes}
          hits={current.hits}
          recording={recording}
          pocketMs={settings.pocketMs}
          width={inner}
        />
        <Text style={styles.caption}>
          Dots are the notes you were meant to play, numbered by bar; lines below are your hits in the recording. Shaded bands are the
          pocket. Scroll sideways to see the whole test.
        </Text>
      </Card>

      <Card>
        <Text style={styles.section}>Every hit</Text>
        <HitTimeline notes={analysis.notes} pocketMs={settings.pocketMs} width={inner} />
        <Text style={styles.caption}>Above the line is late, below is early.</Text>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Average offset" value={`${analysis.meanOffset > 0 ? '+' : ''}${Math.round(analysis.meanOffset)} ms`} />
          <Stat label="Consistency" value={`±${Math.round(analysis.spread)} ms`} />
          <Stat label="Tempo played" value={tempo ? tempo.toFixed(1) : '–'} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Right hand" value={fmtMs(analysis.handMean.R)} />
          <Stat label="Left hand" value={fmtMs(analysis.handMean.L)} />
          <Stat label="Missed" value={String(analysis.expected - analysis.hits)} />
        </View>
      </Card>

      <Card>
        <SliderRow
          label="Pocket Width"
          value={settings.pocketMs}
          min={10}
          max={50}
          step={1}
          format={(v) => `± ${v} ms`}
          ticks={['10 ms', '20 ms', '30 ms', '40 ms', '50 ms']}
          onChange={(v) => updateSettings({ pocketMs: Math.round(v) })}
        />
        <Body>Drag to see how your score changes with a tighter or looser pocket.</Body>
      </Card>
    </Screen>
  );
}

const fmtMs = (v: number | null) => (v === null ? '–' : `${v > 0 ? '+' : ''}${Math.round(v)} ms`);

function Legend({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: square ? 2 : 5, backgroundColor: color }} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13, marginBottom: space.sm },
  legend: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  legendText: { color: colors.textMuted, fontSize: 12 },
  caption: { color: colors.textDim, fontSize: 11 },
  section: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
