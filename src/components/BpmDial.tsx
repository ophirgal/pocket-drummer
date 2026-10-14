import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/lib/theme';

/**
 * The tempo dial from the recording screen: an arc showing tempo within the
 * exercise's range, the BPM, and a play button that pulses on each beat.
 */
export function BpmDial({
  bpm,
  min,
  max,
  pulse,
  running,
  onPress,
  size = 190,
}: {
  bpm: number;
  min: number;
  max: number;
  pulse: boolean;
  running: boolean;
  onPress?: () => void;
  size?: number;
}) {
  const stroke = 8;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // the dial covers 270 degrees
  const frac = (bpm - min) / Math.max(1, max - min);
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="dial" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.teal} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * arc} ${c}`}
          strokeLinecap="round"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#dial)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${Math.max(0.02, frac) * c * arc} ${c}`}
          strokeLinecap="round"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.bpm}>{bpm}</Text>
        <Text style={styles.label}>BPM</Text>
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessibilityLabel={running ? 'Beat' : 'Start'}
          style={[styles.play, pulse && styles.playPulse]}>
          <Ionicons name={running ? 'radio-button-on' : 'play'} size={20} color={colors.teal} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  bpm: { color: colors.text, fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { color: colors.textMuted, fontSize: 13, letterSpacing: 1, marginTop: -4 },
  play: {
    marginTop: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  playPulse: { backgroundColor: colors.primaryDeep, borderColor: colors.teal, transform: [{ scale: 1.12 }] },
});
