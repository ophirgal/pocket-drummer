import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { exerciseById } from '@/lib/exercises';
import { formatDate, formatDuration } from '@/lib/session';
import { colors, scoreColor, space } from '@/lib/theme';
import { useStore, type SessionResult } from '@/state/store';

export function SessionRow({ s, first }: { s: SessionResult; first?: boolean }) {
  const { setCurrent } = useStore();
  const name = exerciseById(s.exerciseId)?.name ?? 'Exercise';
  return (
    <Pressable
      onPress={() => {
        setCurrent(s);
        router.push('/detail');
      }}
      style={[styles.row, !first && styles.divider]}>
      <View style={styles.play}>
        <Ionicons name="play" size={13} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {formatDate(s.date)} • {formatDuration(s.durationSec)} • {s.bpm} BPM
        </Text>
      </View>
      <Text style={[styles.score, { color: scoreColor(s.score) }]}>{s.score}%</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  play: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  score: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
