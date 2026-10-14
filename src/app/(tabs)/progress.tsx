import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { SessionRow } from '@/components/SessionRow';
import { Body, Button, Card, Screen, Stat, Tabs } from '@/components/ui';
import { colors, space } from '@/lib/theme';
import { useStore } from '@/state/store';

const DAY = 86400000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function Sparkline({ values, width, height }: { values: number[]; width: number; height: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - ((v - min) / (max - min)) * height]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sp" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.primaryBright} />
        </LinearGradient>
      </Defs>
      <Path d={d} stroke="url(#sp)" strokeWidth={2.5} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

export default function Progress() {
  const { sessions } = useStore();
  const [tab, setTab] = useState<'overview' | 'history'>('overview');
  const { width } = useWindowDimensions();
  const [t] = useState(() => Date.now());

  if (!sessions.length) {
    return (
      <Screen>
        <Text style={styles.title}>Progress</Text>
        <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <Ionicons name="trending-up" size={40} color={colors.primaryBright} />
          <Text style={styles.emptyTitle}>No saved sessions yet</Text>
          <Body style={{ textAlign: 'center' }}>Finish a test and tap Save Result to start tracking your progress.</Body>
          <Button title="Start Practice" onPress={() => router.push('/library')} style={{ alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  const last7 = sessions.filter((s) => t - s.date < 7 * DAY).map((s) => s.score);
  const prev7 = sessions.filter((s) => t - s.date >= 7 * DAY && t - s.date < 14 * DAY).map((s) => s.score);
  const average = Math.round(avg(sessions.slice(0, 20).map((s) => s.score)));
  const change = last7.length && prev7.length ? Math.round(avg(last7) - avg(prev7)) : null;
  const best = Math.max(...sessions.map((s) => s.score));
  const practiced = sessions.reduce((a, s) => a + s.durationSec, 0);
  const hours = Math.floor(practiced / 3600);
  const mins = Math.round((practiced % 3600) / 60);

  return (
    <Screen>
      <Text style={styles.title}>Progress</Text>
      <Tabs
        options={[
          { label: 'Overview', value: 'overview' },
          { label: 'History', value: 'history' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'overview' ? (
        <>
          <Card>
            <Text style={styles.cardTitle}>Average Score</Text>
            <View style={styles.avgRow}>
              <Text style={styles.big}>
                {average}
                <Text style={styles.bigPct}>%</Text>
              </Text>
              {change !== null && (
                <View>
                  <Text style={[styles.change, { color: change >= 0 ? colors.onTime : colors.rushed }]}>
                    {change >= 0 ? '↑' : '↓'} {change >= 0 ? '+' : ''}
                    {change}%
                  </Text>
                  <Text style={styles.vs}>vs. last 7 days</Text>
                </View>
              )}
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Sparkline values={sessions.slice(0, 12).reverse().map((s) => s.score)} width={Math.min(140, width * 0.3)} height={44} />
              </View>
            </View>
          </Card>
          <Card>
            <Text style={styles.cardTitle}>Your Stats</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="Total Tests" value={String(sessions.length)} />
              <Stat label="Best Score" value={`${best}%`} />
              <Stat label="Time Practiced" value={hours ? `${hours}h ${mins}m` : `${mins}m`} />
            </View>
          </Card>
          <Text style={styles.section}>Recent Sessions</Text>
          <Card style={{ paddingVertical: 2, gap: 0 }}>
            {sessions.slice(0, 5).map((s, i) => (
              <SessionRow key={s.id} s={s} first={i === 0} />
            ))}
          </Card>
        </>
      ) : (
        <Card style={{ paddingVertical: 2, gap: 0 }}>
          {sessions.map((s, i) => (
            <SessionRow key={s.id} s={s} first={i === 0} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  big: { color: colors.text, fontSize: 40, fontWeight: '800' },
  bigPct: { fontSize: 22 },
  change: { fontSize: 14, fontWeight: '700' },
  vs: { color: colors.textMuted, fontSize: 11 },
  section: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
