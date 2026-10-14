import { router } from 'expo-router';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Header, LinkRow, Screen, SliderRow, Tabs, ToggleRow } from '@/components/ui';
import { colors, space } from '@/lib/theme';
import { useStore, type InputMode, type Sensitivity } from '@/state/store';

export default function Settings() {
  const { settings, updateSettings, clearSessions } = useStore();
  const latency = settings.latency[settings.inputMode];

  const confirmClear = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete all saved sessions on this device?')) clearSessions();
      return;
    }
    Alert.alert('Clear history?', 'This deletes all saved sessions on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearSessions },
    ]);
  };

  return (
    <Screen>
      <Header title="Settings" onBack={() => router.back()} />

      <Card>
        <Text style={styles.cardTitle}>Pocket Width</Text>
        <SliderRow
          value={settings.pocketMs}
          min={10}
          max={50}
          step={1}
          format={(v) => `± ${v} ms`}
          ticks={['10 ms', '20 ms', '30 ms', '40 ms', '50 ms']}
          onChange={(v) => updateSettings({ pocketMs: Math.round(v) })}
        />
        <Body>This defines how close to the beat your hits need to be to be considered “in the pocket”. The default is ±20 ms.</Body>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Audio Settings</Text>
        <SliderRow
          label="Metronome Volume"
          value={settings.clickVolume * 100}
          min={0}
          max={100}
          step={5}
          format={(v) => `${Math.round(v)}%`}
          onChange={(v) => updateSettings({ clickVolume: Math.round(v) / 100 })}
        />
        <View style={{ height: space.sm }} />
        <SliderRow
          label="Default Tempo"
          value={settings.defaultTempo}
          min={40}
          max={200}
          step={5}
          format={(v) => `${Math.round(v)} BPM`}
          onChange={(v) => updateSettings({ defaultTempo: Math.round(v) })}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Hit Detection</Text>
        <Text style={styles.label}>Input</Text>
        <Tabs<InputMode>
          options={[
            { label: 'Microphone', value: 'mic' },
            { label: 'Tap screen', value: 'tap' },
          ]}
          value={settings.inputMode}
          onChange={(v) => updateSettings({ inputMode: v })}
        />
        {settings.inputMode === 'mic' && (
          <>
            <Text style={styles.label}>Mic sensitivity</Text>
            <Tabs<Sensitivity>
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
              ]}
              value={settings.sensitivity}
              onChange={(v) => updateSettings({ sensitivity: v })}
            />
            <Body>Lower it if room noise counts as hits; raise it if soft strokes are missed.</Body>
          </>
        )}
        <LinkRow
          label="Calibrate latency"
          value={latency === null ? (settings.inputMode === 'mic' ? 'Auto' : 'Not set') : `${latency} ms`}
          onPress={() => router.push('/calibrate')}
        />
      </Card>

      <Card style={{ gap: 0 }}>
        <Text style={[styles.cardTitle, { marginBottom: space.xs }]}>App Settings</Text>
        <ToggleRow label="Haptic Feedback" value={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />
      </Card>

      <Button title="Clear practice history" variant="secondary" onPress={confirmClear} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 13, marginTop: space.xs },
});
