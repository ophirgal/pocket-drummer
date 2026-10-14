import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTestSession } from '@/audio/useTestSession';
import { KeepAwake } from '@/components/KeepAwake';
import { TapPad } from '@/components/TapPad';
import { Body, Button, Card, Header, Screen } from '@/components/ui';
import { median } from '@/lib/analysis';
import type { Exercise } from '@/lib/exercises';
import { colors, space } from '@/lib/theme';
import { useStore } from '@/state/store';

const BPM = 90;
const BARS = 3;

// Quarter notes: one hit with every click.
const QUARTERS: Exercise = {
  id: 'calibration',
  name: 'Calibration',
  category: 'Rudiments',
  difficulty: 'Beginner',
  bpmRange: [BPM, BPM],
  defaultBpm: BPM,
  stepsPerBeat: 2,
  beatsPerBar: 4,
  bar: [{ hand: 'R' }, null, { hand: 'R' }, null, { hand: 'R' }, null, { hand: 'R' }, null],
  free: true,
  description: '',
};

/**
 * Measures the delay between the click you hear and the hit the app registers.
 * You play along with the click; the median offset becomes the correction.
 */
export default function Calibrate() {
  const { settings, updateSettings } = useStore();
  const mode = settings.inputMode;
  const [message, setMessage] = useState<string | null>(null);

  const session = useTestSession((r) => {
    const raw = r.offsets.filter((o): o is number => o !== null).map((o) => o + r.latencyMs);
    if (raw.length < 6) {
      setMessage('Not enough hits were picked up. Try again and play one note with every click.');
      return;
    }
    const value = Math.round(Math.max(0, median(raw)));
    updateSettings({ latency: { ...settings.latency, [mode]: value } });
    setMessage(`Done: ${value} ms will be subtracted from your hits in ${mode === 'mic' ? 'microphone' : 'tap'} mode.`);
  });

  const running = session.phase !== 'idle';
  const start = () => {
    setMessage(null);
    session.start(QUARTERS, BPM, {
      ...settings,
      latency: { mic: null, tap: null },
      durationSec: (BARS * 4 * 60) / BPM,
    });
  };

  const current = settings.latency[mode];

  return (
    <Screen>
      {running && <KeepAwake />}
      <Header title="Calibrate" onBack={() => router.back()} />
      <Card>
        <Text style={styles.title}>Why calibrate?</Text>
        <Body>
          Phones (and Bluetooth headphones especially) play the click a little late, and the microphone hears your hit a little late. Without a
          correction you’d look like you’re dragging.
        </Body>
        {mode === 'mic' && (
          <Body>
            If the click plays through the phone speaker, Pocket Pro measures this automatically during the count-in. Calibrate when you practise
            with headphones.
          </Body>
        )}
        <Body>
          Press start, listen to the one-bar count-in, then play one note with every click for {BARS} bars. Use the same headphones or speaker you
          practise with.
        </Body>
        <Text style={styles.value}>
          Current {mode === 'mic' ? 'microphone' : 'tap'} correction: {current === null ? 'not set' : `${current} ms`}
        </Text>
      </Card>

      {running ? (
        <View style={{ gap: space.md }}>
          <Text style={styles.status}>
            {session.phase === 'countIn' ? `Listen… ${session.beat + 1}` : session.phase === 'analyzing' ? 'Measuring…' : 'Play with the click'}
          </Text>
          {mode === 'tap' && <TapPad onTap={session.tap} haptics={settings.haptics} />}
          <Button title="Cancel" variant="secondary" onPress={session.cancel} />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button title="Start calibration" onPress={start} />
          {current !== null && (
            <Button
              title="Reset to automatic"
              variant="ghost"
              onPress={() => updateSettings({ latency: { ...settings.latency, [mode]: null } })}
            />
          )}
        </View>
      )}
      {session.error && <Text style={styles.error}>Couldn’t use the microphone. Check permissions, or switch to tap mode in Settings.</Text>}
      {message && <Text style={styles.message}>{message}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  value: { color: colors.primaryBright, fontSize: 14, marginTop: space.xs },
  status: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  message: { color: colors.onTime, fontSize: 14, textAlign: 'center' },
  error: { color: colors.rushed, fontSize: 14, textAlign: 'center' },
});
