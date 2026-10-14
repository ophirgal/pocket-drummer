import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { now } from '@/audio/clock';
import { colors, radius } from '@/lib/theme';

/**
 * Tap-mode drum pad. The time is taken the instant the finger lands (responder
 * grant), which is when a stick would hit the head.
 */
export function TapPad({ onTap, haptics }: { onTap: (t: number) => void; haptics: boolean }) {
  const [down, setDown] = useState(false);
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel="Drum pad"
      onStartShouldSetResponder={() => true}
      onResponderGrant={() => {
        onTap(now());
        setDown(true);
        if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onResponderRelease={() => setDown(false)}
      onResponderTerminate={() => setDown(false)}
      style={[styles.pad, down && styles.down]}>
      <Text style={styles.label}>TAP</Text>
      <Text style={styles.sub}>Tap each note of the pattern</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  down: { backgroundColor: colors.primaryDeep, transform: [{ scale: 0.98 }] },
  label: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  sub: { color: colors.textMuted, fontSize: 13 },
});
