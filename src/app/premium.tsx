import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Header, Screen } from '@/components/ui';
import { EXERCISES } from '@/lib/exercises';
import { colors, space } from '@/lib/theme';
import { FREE_TESTS_PER_DAY, useStore } from '@/state/store';

const PERKS = [
  { icon: 'library', text: `The full library: ${EXERCISES.length} rudiments, fills and grooves, with more on the way` },
  { icon: 'infinite', text: 'Unlimited timing tests' },
  { icon: 'create', text: 'Create your own grooves and fills (coming soon)' },
  { icon: 'sparkles', text: 'An AI coaching report after every test' },
] as const;

export default function Premium() {
  const { profile, updateProfile, testsLeft } = useStore();
  return (
    <Screen>
      <Header title="" onBack={() => router.back()} />
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Ionicons name="diamond" size={44} color={colors.gold} />
        <Text style={styles.title}>Pocket Pro Premium</Text>
        <Body style={{ textAlign: 'center' }}>
          {profile.premium
            ? 'Premium demo mode is on. Everything is unlocked.'
            : testsLeft <= 0
              ? `You've used today's ${FREE_TESTS_PER_DAY} free tests. Come back tomorrow, or unlock unlimited tests.`
              : 'Take your time-keeping further.'}
        </Body>
      </View>
      <Card>
        {PERKS.map((p) => (
          <View key={p.text} style={styles.perk}>
            <Ionicons name={p.icon} size={20} color={colors.primaryBright} />
            <Text style={styles.perkText}>{p.text}</Text>
          </View>
        ))}
      </Card>
      <Button
        title={profile.premium ? 'Turn off demo mode' : 'Try Premium (demo)'}
        onPress={() => {
          updateProfile({ premium: !profile.premium });
          router.back();
        }}
      />
      <Text style={styles.note}>Purchases aren’t set up in this prototype. The demo switch unlocks everything on this device.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  perkText: { color: colors.text, fontSize: 15, flex: 1 },
  note: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
