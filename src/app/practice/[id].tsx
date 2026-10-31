import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { usePatternPreview } from '@/audio/usePatternPreview';
import { useTestSession } from '@/audio/useTestSession';
import { BpmDial } from '@/components/BpmDial';
import { KeepAwake } from '@/components/KeepAwake';
import { LiveNotation } from '@/components/LiveNotation';
import { TapPad } from '@/components/TapPad';
import { Body, Button, Card, Chip, Header, IconButton, Screen, type IconName } from '@/components/ui';
import { exerciseById, subdivisionLabel } from '@/lib/exercises';
import { formatDuration } from '@/lib/session';
import { colors, space } from '@/lib/theme';
import { useStore } from '@/state/store';

const MAIN_SIZE = 140;
const CONTROL_SIZE = 48;

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
  const preview = usePatternPreview();

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
    preview.stop();
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

  /** Use this length now, and remember it as the default for next time. */
  const pickDuration = (s: number) => {
    setDurationSec(s);
    updateSettings({ durationSec: s });
  };

  const nudge = (d: number) => setBpm((b) => Math.min(exercise.bpmRange[1], Math.max(exercise.bpmRange[0], b + d)));

  let status = 'Press Start. You get one bar of count-in: listen, then start playing on beat one. Tap Preview to hear the pattern first.';
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

      <View style={styles.mainRow}>
        <Pressable
          onPress={running ? session.finish : start}
          disabled={session.phase === 'preparing' || session.phase === 'analyzing'}
          style={styles.main}
          accessibilityRole="button"
          accessibilityLabel={running ? 'Finish' : 'Start'}>
          <Text style={styles.mainText}>{running ? 'Stop' : 'Start'}</Text>
        </Pressable>
      </View>
      <View style={styles.controls}>
        <Control icon="refresh" label="Restart" onPress={restart} disabled={!running} />
        <Control
          icon={preview.previewing === exercise.id ? 'stop' : 'play'}
          label="Preview"
          onPress={() => preview.toggle(exercise, bpm)}
          disabled={running}
        />
        <Control icon="close" label="Cancel" onPress={session.cancel} disabled={!running} />
      </View>

      {!running && (
        <View style={{ gap: space.sm }}>
          <View style={styles.chips}>
            {[10, 30, 60, 120].map((s) => (
              <Chip key={s} label={formatDuration(s)} active={durationSec === s} onPress={() => pickDuration(s)} />
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

/** A round secondary control with a caption, in the row under the Start button (Restart / Preview / Cancel). */
function Control({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
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
  mainRow: { alignItems: 'center', marginVertical: space.md },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  main: {
    width: MAIN_SIZE,
    height: MAIN_SIZE,
    borderRadius: MAIN_SIZE / 2,
    backgroundColor: colors.primaryBright,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  mainText: { color: colors.primaryText, fontSize: 30, fontWeight: '800' },
  control: { alignItems: 'center', gap: 6 },
  controlCircle: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
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
