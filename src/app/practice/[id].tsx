import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTestSession } from '@/audio/useTestSession';
import { BpmDial } from '@/components/BpmDial';
import { KeepAwake } from '@/components/KeepAwake';
import { LiveNotation } from '@/components/LiveNotation';
import { TapPad } from '@/components/TapPad';
import { Body, Button, Card, Chip, Header, IconButton, Screen } from '@/components/ui';
import { exerciseById, subdivisionLabel } from '@/lib/exercises';
import { formatDuration } from '@/lib/session';
import { colors, space } from '@/lib/theme';
import { useStore } from '@/state/store';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * The recording screen for one exercise (route param `id`; optional `minutes`
 * sets the test length). Pick a tempo and duration, press play, and
 * useTestSession runs the count-in, click and listening. When the test ends the
 * result is stored as `current` and the app moves on to the Result screen.
 *
 * The notation stays on screen throughout. While the test runs, a playhead
 * sweeps through each bar and every hit appears on the notation as it lands
 * (LiveNotation); in tap mode the tap pad shows underneath. Starting a test is
 * blocked when the free daily quota is used up.
 */
export default function Practice() {
  const { id, minutes } = useLocalSearchParams<{ id: string; minutes?: string }>();
  const exercise = exerciseById(id);
  const { settings, updateSettings, testsLeft, recordTestUsed, setCurrent, profile } = useStore();
  const { width } = useWindowDimensions();
  const [bpm, setBpm] = useState(() =>
    exercise ? Math.min(exercise.bpmRange[1], Math.max(exercise.bpmRange[0], settings.defaultTempo)) : 100,
  );
  const [durationSec, setDurationSec] = useState(minutes ? Number(minutes) * 60 : settings.durationSec);

  const session = useTestSession((result) => {
    recordTestUsed();
    setCurrent(result);
    router.replace('/result');
  });

  if (!exercise) {
    return (
      <Screen>
        <Header title="Not found" onBack={() => router.back()} />
        <Body>That exercise doesn’t exist.</Body>
      </Screen>
    );
  }
  if (!exercise.free && !profile.premium) return <Redirect href="/premium" />;

  const running = session.phase !== 'idle';
  const recording = session.phase === 'recording';
  const contentW = Math.min(width, 520) - space.md * 2;

  const start = () => {
    if (testsLeft <= 0) {
      router.push('/premium');
      return;
    }
    session.start(exercise, bpm, { ...settings, durationSec });
  };

  const restart = () => {
    session.cancel();
    setTimeout(start, 150);
  };

  const nudge = (d: number) => setBpm((b) => Math.min(exercise.bpmRange[1], Math.max(exercise.bpmRange[0], b + d)));

  let status = 'Press play. You get one bar of count-in: listen, then start playing on beat one.';
  if (session.phase === 'preparing') status = settings.inputMode === 'mic' ? 'Starting the microphone…' : 'Get ready…';
  if (session.phase === 'countIn') status = `Listen… ${session.beat + 1}`;
  if (recording) status = 'Recording...';
  if (session.phase === 'analyzing') status = 'Analyzing your timing…';

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      {running && <KeepAwake />}
      <View>
        <Header
          title={exercise.name}
          onBack={() => {
            session.cancel();
            router.back();
          }}
          right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}
        />
        <Text style={styles.meta}>
          {bpm} BPM • {subdivisionLabel(exercise.stepsPerBeat)} • {formatDuration(durationSec)}
        </Text>
      </View>

      <View style={styles.dialRow}>
        <IconButton icon="remove-circle-outline" label="Slower" size={30} onPress={() => nudge(-5)} color={running ? colors.textDim : colors.text} />
        <BpmDial
          bpm={bpm}
          min={exercise.bpmRange[0]}
          max={exercise.bpmRange[1]}
          pulse={running && session.beat >= 0 && session.phase !== 'analyzing'}
          running={running}
          onPress={running ? undefined : start}
        />
        <IconButton icon="add-circle-outline" label="Faster" size={30} onPress={() => nudge(5)} color={running ? colors.textDim : colors.text} />
      </View>

      <Card style={{ alignItems: 'center' }}>
        <LiveNotation
          exercise={exercise}
          width={contentW - space.md * 2}
          pocketMs={settings.pocketMs}
          active={running}
          getLive={session.getLive}
        />
      </Card>
      {running && settings.inputMode === 'tap' && <TapPad onTap={session.tap} haptics={settings.haptics} />}

      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={[styles.status, recording && { color: colors.text }]}>{status}</Text>
        {(recording || session.phase === 'analyzing') && (
          <Text style={styles.timer}>
            {fmt(Math.min(session.elapsed, durationSec))} / {fmt(durationSec)}
          </Text>
        )}
      </View>

      {session.error && (
        <Card style={{ borderColor: colors.rushed }}>
          <Text style={styles.errorTitle}>
            {session.error === 'mic-denied'
              ? 'Microphone access is off'
              : session.error === 'no-audio'
                ? "We couldn't get sound from the microphone"
                : 'That was too short to score'}
          </Text>
          <Body>
            {session.error === 'too-short'
              ? 'Play at least one full bar after the count-in.'
              : 'Allow microphone access in your phone settings, or use tap mode and tap the pattern on screen instead.'}
          </Body>
          {session.error !== 'too-short' && (
            <Button
              title="Use tap mode"
              variant="secondary"
              onPress={() => {
                updateSettings({ inputMode: 'tap' });
                session.clearError();
              }}
            />
          )}
        </Card>
      )}

      <View style={styles.controls}>
        <Control icon="refresh" label="Restart" onPress={restart} disabled={!running} />
        <Pressable
          onPress={running ? session.finish : start}
          disabled={session.phase === 'preparing' || session.phase === 'analyzing'}
          style={styles.main}
          accessibilityLabel={running ? 'Finish' : 'Start'}>
          <Ionicons name={running ? 'stop' : 'play'} size={32} color={colors.primaryText} />
        </Pressable>
        <Control icon="close" label="Cancel" onPress={session.cancel} disabled={!running} />
      </View>

      {!running && (
        <View style={{ gap: space.sm }}>
          <View style={styles.chips}>
            {[10, 30, 60, 120].map((s) => (
              <Chip key={s} label={formatDuration(s)} active={durationSec === s} onPress={() => setDurationSec(s)} />
            ))}
          </View>
          <Text style={styles.hint}>
            {settings.inputMode === 'mic'
              ? "Mic mode: wear headphones so the click stays out of the recording, and put the phone near the pad: its own mic does the listening."
              : 'Tap mode: tap the pattern on the screen. Switch to the microphone in Settings.'}
          </Text>
        </View>
      )}
    </Screen>
  );
}

/** A round secondary control (Restart / Cancel) beside the main play button. */
function Control({ icon, label, onPress, disabled }: { icon: 'refresh' | 'close'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.control, disabled && { opacity: 0.4 }]}>
      <View style={styles.controlCircle}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: -4 },
  dialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  status: { color: colors.textMuted, fontSize: 15, textAlign: 'center', paddingHorizontal: space.md },
  timer: { color: colors.textMuted, fontSize: 15, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  main: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryBright,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  control: { alignItems: 'center', gap: 6 },
  controlCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: { color: colors.textMuted, fontSize: 12 },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  hint: { color: colors.textDim, fontSize: 12, textAlign: 'center', paddingHorizontal: space.md },
  errorTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
