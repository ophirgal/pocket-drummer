import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Card, LinkRow, Screen, ToggleRow } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';
import { FREE_TESTS_PER_DAY, useStore } from '@/state/store';

/**
 * Profile tab: edit your name, see your plan and today's usage, toggle the
 * premium demo switch, and jump to settings, calibration or history.
 */
export default function Profile() {
  const { profile, updateProfile, testsToday, sessions } = useStore();
  const [name, setName] = useState(profile.name);
  const initial = (profile.name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>
      <Card style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => updateProfile({ name: name.trim() })}
            onBlur={() => updateProfile({ name: name.trim() })}
            placeholder="Your name"
            placeholderTextColor={colors.textDim}
            style={styles.name}
          />
          <Text style={styles.plan}>{profile.premium ? 'Premium (demo)' : 'Free plan'}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Plan</Text>
        <Body>
          {profile.premium
            ? 'Everything is unlocked: the full library and unlimited tests.'
            : `Free: ${FREE_TESTS_PER_DAY} tests a day and a starter set of rudiments, fills and grooves. Used today: ${Math.min(testsToday, FREE_TESTS_PER_DAY)} of ${FREE_TESTS_PER_DAY}.`}
        </Body>
        <LinkRow label="About Premium" icon="diamond-outline" onPress={() => router.push('/premium')} />
        <ToggleRow label="Premium demo mode" value={profile.premium} onChange={(v) => updateProfile({ premium: v })} />
        <Text style={styles.note}>Payments aren’t set up in this prototype. The demo switch unlocks Premium so you can try everything.</Text>
      </Card>

      <Card style={{ gap: 0 }}>
        <LinkRow label="Settings" icon="settings-outline" onPress={() => router.push('/settings')} />
        <LinkRow label="Calibrate latency" icon="pulse-outline" onPress={() => router.push('/calibrate')} />
        <LinkRow label="Saved sessions" icon="time-outline" value={String(sessions.length)} onPress={() => router.push('/progress')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 24, fontWeight: '800' },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', padding: 0, borderRadius: radius.sm },
  plan: { color: colors.primaryBright, fontSize: 13 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  note: { color: colors.textDim, fontSize: 12 },
});
