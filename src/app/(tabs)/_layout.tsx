import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import type { IconName } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useStore } from '@/state/store';

function TabIcon({ name, active, color, focused }: { name: IconName; active: IconName; color: ColorValue; focused: boolean }) {
  return <Ionicons name={focused ? active : name} size={22} color={typeof color === 'string' ? color : undefined} />;
}

function icon(name: IconName, active: IconName) {
  return function Icon(p: { color: ColorValue; focused: boolean }) {
    return <TabIcon name={name} active={active} {...p} />;
  };
}

/**
 * The bottom tab bar (Home, Library, Progress, Profile). Users who haven't
 * finished onboarding are redirected to the welcome screen first.
 */
export default function TabsLayout() {
  const { profile } = useStore();
  if (!profile.onboarded) return <Redirect href="/welcome" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, paddingTop: 4 },
        tabBarActiveTintColor: colors.primaryBright,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: icon('book-outline', 'book') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('bar-chart-outline', 'bar-chart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
