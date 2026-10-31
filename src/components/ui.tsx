/**
 * Shared UI building blocks, styled with the theme in src/lib/theme.ts. Screens
 * are composed from these rather than styling raw React Native views.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Full-screen background with the soft purple glow from the mockups. */
export function Backdrop({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={[colors.bgTop, colors.bg]} style={StyleSheet.absoluteFill} end={{ x: 0.5, y: 0.6 }} />
      {children}
    </View>
  );
}

/**
 * The wrapper for every screen: backdrop, safe-area padding and standard gaps.
 * Scrolls by default; pass `scroll={false}` for fixed layouts.
 */
export function Screen({
  children,
  scroll = true,
  padTop = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  padTop?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const style = [{ paddingTop: padTop ? insets.top + space.md : space.md, paddingBottom: insets.bottom + space.xl }, styles.screen, contentStyle];
  return (
    <Backdrop>
      {scroll ? (
        <ScrollView contentContainerStyle={style} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[style, { flex: 1 }]}>{children}</View>
      )}
    </Backdrop>
  );
}

/** Screen title bar with an optional back button and right-hand slot. */
export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? <IconButton icon="chevron-back" onPress={onBack} label="Back" /> : <View style={{ width: 36 }} />}
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ minWidth: 36, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

/** The standard button: `primary` (gradient), `secondary` (outlined) or `ghost` (text only). */
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={18} color={variant === 'primary' ? colors.primaryText : colors.text} /> : null}
      <Text style={[styles.buttonText, variant !== 'primary' && { color: variant === 'ghost' ? colors.primaryBright : colors.text }]}>
        {title}
      </Text>
    </>
  );
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}>
      {variant === 'primary' ? (
        <LinearGradient colors={[colors.primaryBright, colors.primary]} style={styles.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.button, variant === 'secondary' && styles.secondary]}>{content}</View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 22,
  color = colors.text,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={styles.iconButton}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const BADGE_COLORS: Record<string, string> = {
  Beginner: colors.onTime,
  Intermediate: colors.gold,
  Advanced: colors.rushed,
};

export function Badge({ label }: { label: string }) {
  const c = BADGE_COLORS[label] ?? colors.primaryBright;
  return (
    <View style={[styles.badge, { borderColor: c + '66', backgroundColor: c + '1A' }]}>
      <Text style={[styles.badgeText, { color: c }]}>{label}</Text>
    </View>
  );
}

/** A segmented control for switching between a few options of type T. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.tabs}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.tab, active && styles.tabActive]}>
            <Text style={[styles.tabText, active && { color: colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#fff"
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

export function LinkRow({ label, value, onPress, icon }: { label: string; value?: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      {icon ? <Ionicons name={icon} size={18} color={colors.primaryBright} style={{ marginRight: space.sm }} /> : null}
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** A labelled slider with tick labels underneath, like the pocket width control. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  ticks,
  onChange,
  onComplete,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  ticks?: string[];
  onChange: (v: number) => void;
  onComplete?: (v: number) => void;
}) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.rowBetween}>
        {label ? <Text style={styles.rowLabel}>{label}</Text> : <View />}
        <Text style={styles.rowValue}>{format(value)}</Text>
      </View>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        onSlidingComplete={onComplete}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primaryBright}
      />
      {ticks ? (
        <View style={styles.rowBetween}>
          {ticks.map((t) => (
            <Text key={t} style={styles.tick}>
              {t}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { paddingHorizontal: space.md, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  button: {
    flexDirection: 'row',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: colors.cardRaised, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.cardRaised, borderWidth: 1, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { color: colors.text, fontSize: 15 },
  rowValue: { color: colors.textMuted, fontSize: 14, marginRight: 4, fontVariant: ['tabular-nums'] },
  tick: { color: colors.textDim, fontSize: 11 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
