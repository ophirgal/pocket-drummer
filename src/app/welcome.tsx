import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Logo, PadArt } from '@/components/art';
import { Button, Screen } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';
import { useStore } from '@/state/store';

/**
 * First-run onboarding. Asks for a name, then marks the profile as onboarded so
 * the tabs stop redirecting here. Log In is a placeholder for future accounts.
 */
export default function Welcome() {
  const { updateProfile, profile } = useStore();
  const [askName, setAskName] = useState(false);
  const [name, setName] = useState(profile.name);

  const finish = () => {
    updateProfile({ name: name.trim(), onboarded: true });
    router.replace('/');
  };

  const logIn = () => {
    const msg = 'Accounts are coming soon. For now your progress is saved on this device.';
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Log in', msg);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll={false} contentStyle={styles.container}>
        <View style={styles.hero}>
          <Logo size={64} />
          <Text style={styles.title}>Pocket Pro</Text>
          <Text style={styles.tagline}>Better time. Deeper groove.</Text>
          <Text style={styles.sub}>Practice with a click.{'\n'}See your timing. Improve your pocket.</Text>
        </View>
        <PadArt width={260} />
        <View style={styles.actions}>
          {askName ? (
            <>
              <Text style={styles.label}>What should we call you?</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={finish}
              />
              <Button title="Let's go" onPress={finish} />
            </>
          ) : (
            <>
              <Button title="Get Started" onPress={() => setAskName(true)} />
              <Button title="Log In" variant="ghost" onPress={logIn} />
            </>
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between', alignItems: 'center' },
  hero: { alignItems: 'center', gap: space.sm, marginTop: space.xl },
  title: { color: colors.text, fontSize: 38, fontWeight: '800', marginTop: space.sm },
  tagline: { color: colors.primaryBright, fontSize: 17 },
  sub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: space.lg, lineHeight: 20 },
  actions: { alignSelf: 'stretch', gap: space.sm },
  label: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
});
