import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PadIcon } from '@/components/art';
import { Body, Button, Card, IconButton, Screen, Title } from '@/components/ui';
import { todaysChallenge } from '@/lib/exercises';
import { colors, radius, space } from '@/lib/theme';
import { useStore } from '@/state/store';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * Home tab: greeting, the entry point into the library, the free-test quota,
 * and a shortcut to today's rotating challenge (a 2-minute test).
 */
export default function Home() {
  const { profile, testsLeft } = useStore();
  const challenge = todaysChallenge();
  return (
    <Screen>
      <View style={styles.top}>
        <Text style={styles.brand}>
          Pocket <Text style={{ color: colors.primaryBright }}>Pro</Text>
        </Text>
        <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View>
        <Text style={styles.hello}>
          {greeting()}
          {profile.name ? `, ${profile.name}` : ''} 👋
        </Text>
        <Body>Ready to find your pocket?</Body>
      </View>

      <Card style={{ gap: space.md }}>
        <View style={styles.modeRow}>
          <PadIcon size={76} />
          <View style={{ flex: 1, gap: 4 }}>
            <Title>Drum Pad</Title>
            <Body>Practice rudiments, fills and grooves with a click.</Body>
          </View>
        </View>
        <Button title="Start Practice" onPress={() => router.push('/library')} />
        {!profile.premium && (
          <Text style={styles.quota}>
            {testsLeft > 0 ? `${testsLeft} free test${testsLeft === 1 ? '' : 's'} left today` : 'No free tests left today'}
          </Text>
        )}
      </Card>

      <Card style={[styles.modeRow, { opacity: 0.75 }]}>
        <View style={styles.kitIcon}>
          <Ionicons name="musical-notes-outline" size={28} color={colors.textMuted} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Title>Drum Set</Title>
          <Text style={styles.soon}>Coming soon</Text>
          <Body>Full kit, more immersive exercises.</Body>
        </View>
      </Card>

      <Text style={styles.section}>Today’s Challenge</Text>
      <Pressable onPress={() => router.push({ pathname: '/practice/[id]', params: { id: challenge.id, minutes: '2' } })}>
        <Card style={styles.challenge}>
          <View style={styles.challengeIcon}>
            <Ionicons name="trophy" size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.challengeName}>{challenge.name}</Text>
            <Text style={styles.challengeMeta}>2 min • {challenge.difficulty === 'Beginner' ? 'Medium' : 'Hard'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.text, fontSize: 24, fontWeight: '800' },
  hello: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 2 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  quota: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: -4 },
  kitIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  soon: { color: colors.primaryBright, fontSize: 12, fontWeight: '600' },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: space.sm },
  challenge: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: '#3A2E14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  challengeMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
