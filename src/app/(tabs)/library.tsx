import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TickClock } from '@/audio/clock';
import { initSounds, play } from '@/audio/sounds';
import { Badge, Body, Button, Card, Chip, Screen, Tabs } from '@/components/ui';
import { EXERCISES, type Category, type Exercise } from '@/lib/exercises';
import { colors, radius, space } from '@/lib/theme';
import { useStore } from '@/state/store';

type Filter = 'All' | Category;

/**
 * Library tab: search and filter the exercises, preview each one's pattern by
 * ear, and open it for practice. Locked (premium) exercises open the Premium
 * screen instead.
 */
export default function Library() {
  const { profile } = useStore();
  const [tab, setTab] = useState<'library' | 'mine'>('library');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [previewing, setPreviewing] = useState<string | null>(null);
  const clock = useRef(new TickClock());

  useEffect(() => () => clock.current.stop(), []);

  const list = EXERCISES.filter(
    (e) => (filter === 'All' || e.category === filter) && e.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const locked = (e: Exercise) => !e.free && !profile.premium;

  /** Play two bars of the pattern on the pad sound over a quiet click. */
  const preview = async (e: Exercise) => {
    if (previewing === e.id) {
      clock.current.stop();
      setPreviewing(null);
      return;
    }
    await initSounds();
    setPreviewing(e.id);
    const stepMs = 60000 / e.defaultBpm / e.stepsPerBeat;
    const steps = e.bar.length * 2;
    clock.current.begin({
      intervalMs: stepMs,
      totalTicks: steps,
      onTick: ({ index }) => {
        const s = index % e.bar.length;
        if (s % e.stepsPerBeat === 0) play(s === 0 ? 'accent' : 'click', 0.35);
        const note = e.bar[s];
        if (note) play('pad', note.accent ? 1 : 0.6);
      },
      onDone: () => setPreviewing(null),
    });
  };

  const open = (e: Exercise) => {
    if (locked(e)) router.push('/premium');
    else router.push({ pathname: '/practice/[id]', params: { id: e.id } });
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={styles.title}>Library</Text>
        <Pressable onPress={() => router.push('/premium')} style={styles.premium}>
          <Ionicons name="diamond" size={14} color={colors.gold} />
          <Text style={styles.premiumText}>{profile.premium ? 'Premium' : 'Go Premium'}</Text>
        </Pressable>
      </View>

      <Tabs
        options={[
          { label: 'Beats & Fills', value: 'library' },
          { label: 'My Grooves', value: 'mine' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'mine' ? (
        <Card style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.md }}>
          <Ionicons name="create-outline" size={36} color={colors.primaryBright} />
          <Text style={styles.emptyTitle}>Your own grooves</Text>
          <Body style={{ textAlign: 'center' }}>
            Write your own grooves and fills, then test your timing on them. This is a Premium feature and it’s coming soon.
          </Body>
          {!profile.premium && <Button title="See Premium" onPress={() => router.push('/premium')} style={{ alignSelf: 'stretch' }} />}
        </Card>
      ) : (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search beats, fills, or styles…"
              placeholderTextColor={colors.textDim}
              style={styles.searchInput}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {(['All', 'Rudiments', 'Fills', 'Grooves'] as Filter[]).map((f) => (
              <Chip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>

          <Card style={{ paddingVertical: space.xs, gap: 0 }}>
            {list.map((e, i) => (
              <Pressable key={e.id} onPress={() => open(e)} style={[styles.item, i > 0 && styles.divider]}>
                <Pressable onPress={() => preview(e)} style={styles.playBtn} accessibilityLabel={`Preview ${e.name}`}>
                  <Ionicons name={previewing === e.id ? 'stop' : 'play'} size={16} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{e.name}</Text>
                  <Text style={styles.itemMeta}>
                    {e.bpmRange[0]}–{e.bpmRange[1]} BPM
                  </Text>
                </View>
                {locked(e) ? <Ionicons name="lock-closed" size={16} color={colors.gold} style={{ marginRight: 6 }} /> : null}
                <Badge label={e.difficulty} />
              </Pressable>
            ))}
            {list.length === 0 && <Body style={{ padding: space.md, textAlign: 'center' }}>Nothing matches that search.</Body>}
          </Card>

          {!profile.premium && (
            <Pressable onPress={() => router.push('/premium')}>
              <Card style={styles.banner}>
                <Ionicons name="diamond" size={22} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>Go Premium</Text>
                  <Text style={styles.bannerText}>Unlock the full library, create your own grooves, and get unlimited tests.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Card>
            </Pressable>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  premium: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  premiumText: { color: colors.gold, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 11, fontSize: 15 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  itemMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#2A1F5E', borderColor: colors.primary },
  bannerTitle: { color: colors.gold, fontWeight: '700', fontSize: 15 },
  bannerText: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
