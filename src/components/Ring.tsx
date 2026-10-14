import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/lib/theme';

/** The big "78% In the Pocket" ring, with a few confetti dashes around it. */
export function Ring({ value, size = 170, label = 'In the Pocket' }: { value: number; size?: number; label?: string }) {
  const stroke = 12;
  const r = (size - stroke) / 2 - 14;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const confetti = [
    { a: -150, color: colors.teal },
    { a: -120, color: colors.rushed },
    { a: -40, color: colors.teal },
    { a: -10, color: colors.primaryBright },
    { a: 30, color: colors.rushed },
    { a: 150, color: colors.dragged },
    { a: 175, color: colors.teal },
  ];
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.teal} />
            <Stop offset="1" stopColor={colors.onTime} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {pct >= 60 &&
          confetti.map((k, i) => {
            const rad = (k.a * Math.PI) / 180;
            const r1 = r + 18;
            const r2 = r + 26;
            return (
              <Line
                key={i}
                x1={size / 2 + Math.cos(rad) * r1}
                y1={size / 2 + Math.sin(rad) * r1}
                x2={size / 2 + Math.cos(rad) * r2}
                y2={size / 2 + Math.sin(rad) * r2}
                stroke={k.color}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.value}>
          {Math.round(pct)}
          <Text style={styles.pct}>%</Text>
        </Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { color: colors.text, fontSize: 44, fontWeight: '800' },
  pct: { fontSize: 24, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 12, marginTop: -2 },
});
