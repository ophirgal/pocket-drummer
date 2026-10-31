import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { canChooseMic, useAudioDevices, type Mic } from '@/audio/devices';
import { Body, Button, Card, Header, LinkRow, Screen, SliderRow, Tabs, ToggleRow } from '@/components/ui';
import { colors, space } from '@/lib/theme';
import { DEFAULT_SETTINGS, MIC_BUILTIN, useStore, type InputMode, type Sensitivity } from '@/state/store';

/**
 * App settings: pocket width, click volume, default tempo, input mode (mic or
 * tap), mic sensitivity, which microphone records, haptics, a link to latency
 * calibration for the current audio output, resetting everything to the
 * defaults, and clearing the saved history. Every change is persisted immediately through the store.
 */
export default function Settings() {
  const { settings, updateSettings, resetSettings, clearSessions } = useStore();
  const { mics, route } = useAudioDevices();
  const latency = route ? settings.latency[settings.inputMode][route.key] : undefined;
  const autoLatency = settings.inputMode === 'mic' && route !== null && !route.headphones;

  const confirmReset = () => {
    const msg = 'Put every setting back to its default? Your latency calibrations are kept.';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) resetSettings();
      return;
    }
    Alert.alert('Reset to defaults?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetSettings },
    ]);
  };

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
          step={5}
          format={(v) => `± ${v} ms`}
          ticks={['10 ms', '20 ms', '30 ms', '40 ms', '50 ms']}
          onChange={(v) => updateSettings({ pocketMs: Math.round(v / 5) * 5 })}
        />
        <Body>This defines how close to the beat your hits need to be to be considered “in the pocket”. The default is ±{DEFAULT_SETTINGS.pocketMs} ms.</Body>
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
            <Text style={styles.label}>Microphone</Text>
            <MicPicker
              mics={mics}
              value={settings.micInput}
              savedName={settings.micInputName}
              onChange={(m) => updateSettings({ micInput: m.id, micInputName: m.name })}
            />
          </>
        )}
        {route && <Text style={styles.route}>Sound is playing through: {route.label}</Text>}
        <LinkRow
          label="Calibrate latency"
          value={latency !== undefined ? `${latency} ms` : autoLatency ? 'Auto' : 'Not set'}
          onPress={() => router.push('/calibrate')}
        />
      </Card>

      <Card style={{ gap: 0 }}>
        <Text style={[styles.cardTitle, { marginBottom: space.xs }]}>App Settings</Text>
        <ToggleRow label="Haptic Feedback" value={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />
      </Card>

      <Button title="Reset to Defaults" variant="secondary" onPress={confirmReset} />
      <Button title="Clear practice history" variant="secondary" onPress={confirmClear} />
    </Screen>
  );
}

const PHONE_MIC: Mic = { id: MIC_BUILTIN, name: "Phone's microphone", kind: 'builtin' };

/**
 * Which microphone records the test. The phone's own mic is the default and the
 * recommended choice: with headphones on, it hears the pad but not the click.
 * On Android the system decides, and on the web the browser does, so this
 * explains what will be used instead.
 */
function MicPicker({
  mics,
  value,
  savedName,
  onChange,
}: {
  mics: Mic[];
  value: string;
  savedName?: string;
  onChange: (m: Mic) => void;
}) {
  if (Platform.OS === 'web') {
    return <Body>The browser&apos;s default microphone is used. You can pick a different one in your browser&apos;s site settings.</Body>;
  }
  if (!canChooseMic) {
    const headset = mics.some((m) => m.kind === 'headset');
    return (
      <>
        <Body>
          Android chooses the microphone: the phone&apos;s own mic, also with Bluetooth headphones. Headphones without a mic work the
          same way.
        </Body>
        {headset && (
          <Text style={styles.warn}>
            A wired headset with a mic is plugged in, so Android will record from it instead of the phone. Use headphones without a mic,
            or Bluetooth headphones, for the best results.
          </Text>
        )}
      </>
    );
  }
  const others = mics.filter((m) => m.kind !== 'builtin');
  const missing = value !== MIC_BUILTIN && !others.some((m) => m.id === value);
  const options: { mic: Mic; note?: string; disabled?: boolean }[] = [
    { mic: PHONE_MIC, note: missing ? 'In use: your chosen mic isn\'t connected' : 'Recommended' },
    ...others.map((mic) => ({ mic, note: mic.kind === 'headset' ? 'Headset mic: hears your voice more than the pad' : undefined })),
    ...(missing ? [{ mic: { id: value, name: savedName ?? 'Chosen mic', kind: 'other' as const }, note: 'Not connected', disabled: true }] : []),
  ];
  return (
    <View>
      {options.map(({ mic, note, disabled }) => {
        const selected = mic.id === value;
        return (
          <Pressable
            key={mic.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(mic)}
            style={[styles.option, disabled && { opacity: 0.5 }]}>
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primaryBright : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>{mic.name}</Text>
              {note && <Text style={styles.optionNote}>{note}</Text>}
            </View>
          </Pressable>
        );
      })}
      <Text style={styles.optionNote}>Bluetooth headphones always leave the phone&apos;s mic recording, so their sound stays at full quality.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 13, marginTop: space.xs },
  route: { color: colors.textMuted, fontSize: 13 },
  warn: { color: colors.gold, fontSize: 13, lineHeight: 18 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8 },
  optionLabel: { color: colors.text, fontSize: 15 },
  optionNote: { color: colors.textDim, fontSize: 12, marginTop: 1 },
});
