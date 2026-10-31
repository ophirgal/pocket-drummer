import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Mascot } from '@/components/art';
import { GridWaveform } from '@/components/GridWaveform';
import { Ring } from '@/components/Ring';
import { Body, Button, Card, Header, Screen } from '@/components/ui';
import { aiCoachAvailable, fetchAiReport } from '@/lib/aiCoach';
import { classShares } from '@/lib/analysis';
import { coachFor } from '@/lib/coach';
import { decodeRecording } from '@/lib/recording';
import { analysisOf } from '@/lib/session';
import { colors, space } from '@/lib/theme';
import { useStore } from '@/state/store';

/**
 * The score screen shown right after a test (or for any `current` session).
 * Scores are recomputed from the stored offsets with the current pocket width,
 * so they follow the setting. Below the score, every hit is drawn on top of the
 * note it was meant to be, so you can see exactly where each one landed. If an Anthropic key is configured, a Claude-written
 * report is fetched once and replaces the on-device coaching text. Save Result
 * adds the session to history.
 */
export default function Result() {
  const { current, settings, saveCurrent, updateCurrent } = useStore();
  const [aiDone, setAiDone] = useState(false);
  const { width } = useWindowDimensions();
  const built = useMemo(() => (current ? analysisOf(current, settings.pocketMs) : null), [current, settings.pocketMs]);
  const stored = current?.recording;
  const recording = useMemo(() => (stored ? decodeRecording(stored) : null), [stored]);

  useEffect(() => {
    if (!built || !current || !aiCoachAvailable || current.aiReport || built.analysis.hits < 4) return;
    let alive = true;
    fetchAiReport(built.analysis, built.exercise, current.bpm).then((text) => {
      if (!alive) return;
      setAiDone(true);
      if (text) updateCurrent({ aiReport: text });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current || !built) return <Redirect href="/" />;
  const { analysis, exercise } = built;
  const coach = coachFor(analysis, exercise, current.bpm);
  const shares = classShares(analysis);
  const loadingAi = aiCoachAvailable && !aiDone && !current.aiReport && analysis.hits >= 4;
  const mood = analysis.pocketScore >= 70 ? 'happy' : analysis.pocketScore >= 45 ? 'ok' : 'sad';

  const save = () => {
    updateCurrent({ score: analysis.pocketScore, meanOffset: analysis.meanOffset, pocketMs: settings.pocketMs, coach });
    saveCurrent();
  };

  return (
    <Screen>
      <Header title="Result" onBack={() => router.replace('/')} />
      <Ring value={analysis.pocketScore} />
      <Text style={styles.verdict}>{coach.verdictLine}</Text>

      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        <View style={styles.mascotRow}>
          <Mascot mood={mood} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.headline}>{coach.headline}</Text>
            <Body>{coach.summary}</Body>
          </View>
        </View>
        <ShareRow icon="arrow-up" color={colors.rushed} label="Rushing" pct={shares.rushed} note="(ahead of beat)" />
        <ShareRow icon="arrow-down" color={colors.dragged} label="Dragging" pct={shares.dragged} note="(behind beat)" />
        <ShareRow icon="remove" color={colors.textMuted} label="On time" pct={shares.onTime} note="(within pocket)" />
      </Card>

      <Card>
        <Text style={styles.coachTitle}>Where your hits landed</Text>
        <GridWaveform
          exercise={exercise}
          bpm={current.bpm}
          notes={analysis.notes}
          hits={current.hits}
          recording={recording}
          pocketMs={settings.pocketMs}
          width={Math.min(width, 520) - space.md * 4}
        />
        <Text style={styles.caption}>
          A tick left of its ring was early, right of it was late; the shaded band is the pocket. Scroll sideways through the test.
        </Text>
      </Card>

      <Card style={styles.coach}>
        <Ionicons name="sparkles" size={26} color={colors.primaryBright} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.coachTitle}>AI Coach</Text>
          {loadingAi ? (
            <ActivityIndicator color={colors.primaryBright} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Body>{current.aiReport ?? coach.report}</Body>
          )}
          <Text style={styles.caption}>
            {current.aiReport ? 'Written by Claude from your timing data.' : 'Generated on your device from your timing data.'}
          </Text>
        </View>
      </Card>

      <Text style={styles.footnote}>
        Pocket ±{settings.pocketMs} ms • {analysis.hits}/{analysis.expected} notes detected
        {current.latencySource !== 'none' ? ` • ${Math.round(current.latencyMs)} ms latency corrected` : ''}
        {current.route ? ` • ${current.route.label}` : ''}
        {current.micName ? ` • ${current.micName}` : ''}
      </Text>
      {current.latencySource === 'none' && current.route?.headphones && (
        <Card style={{ borderColor: colors.gold }}>
          <Body>
            Your headphones add a delay the app can&apos;t hear, so these timings aren&apos;t corrected for it yet. Calibrate once for{' '}
            {current.route.label} to make them exact.
          </Body>
          <Button title="Calibrate latency" variant="secondary" onPress={() => router.push('/calibrate')} />
        </Card>
      )}

      <Button title={current.saved ? 'Saved ✓' : 'Save Result'} onPress={save} disabled={current.saved} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Detailed View" variant="secondary" onPress={() => router.push('/detail')} style={{ flex: 1 }} />
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => router.replace({ pathname: '/practice/[id]', params: { id: exercise.id } })}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

/** One line of the rushing / dragging / on-time breakdown. */
function ShareRow({ icon, color, label, pct, note }: { icon: 'arrow-up' | 'arrow-down' | 'remove'; color: string; label: string; pct: number; note: string }) {
  return (
    <View style={styles.shareRow}>
      <View style={[styles.shareIcon, { backgroundColor: color + '30' }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.shareLabel, { color: label === 'On time' ? colors.text : color }]}>{label}</Text>
      <Text style={styles.sharePct}>{pct}%</Text>
      <Text style={styles.shareNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  verdict: { color: colors.textMuted, fontSize: 14, textAlign: 'center', fontStyle: 'italic', marginTop: -space.sm },
  mascotRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  headline: { color: colors.text, fontSize: 18, fontWeight: '700' },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  shareIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shareLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  sharePct: { color: colors.text, fontSize: 15, fontWeight: '700', width: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
  shareNote: { color: colors.textMuted, fontSize: 12, width: 104 },
  coach: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  coachTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  caption: { color: colors.textDim, fontSize: 11 },
  footnote: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
