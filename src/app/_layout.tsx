import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors } from '@/lib/theme';
import { StoreProvider, useStore } from '@/state/store';

function Navigator() {
  const { ready } = useStore();
  // Hold the first frame until saved settings load, so the welcome screen doesn't flash.
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="practice/[id]" />
      <Stack.Screen name="result" options={{ gestureEnabled: false }} />
      <Stack.Screen name="detail" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="calibrate" />
      <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Navigator />
    </StoreProvider>
  );
}
