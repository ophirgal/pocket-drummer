/**
 * App-wide state in a single React context: settings, profile, saved sessions,
 * the daily free-test count, and the session currently being viewed. Everything
 * except `current` is persisted to AsyncStorage on each change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { CoachText } from '@/lib/coach';

export type InputMode = 'mic' | 'tap';
export type Sensitivity = 'low' | 'medium' | 'high';

export interface Settings {
  /** Half-width of the pocket around each beat, in ms. */
  pocketMs: number;
  clickVolume: number;
  defaultTempo: number;
  durationSec: number;
  haptics: boolean;
  inputMode: InputMode;
  sensitivity: Sensitivity;
  /** Measured by the calibration screen, per input mode. Null = not calibrated. */
  latency: Record<InputMode, number | null>;
}

export interface Profile {
  name: string;
  onboarded: boolean;
  /** Demo switch: unlocks premium content until real purchases exist. */
  premium: boolean;
}

/** Everything needed to show a result screen. */
export interface SessionResult {
  id: string;
  date: number;
  exerciseId: string;
  bpm: number;
  durationSec: number;
  inputMode: InputMode;
  /** Offset of each expected note (null = missed), in pattern order. */
  offsets: (number | null)[];
  extraHits: number;
  /** Downsampled recording level, 0..1, for the waveform. */
  waveform: number[];
  /** Hit positions on the waveform, 0..1. */
  hitMarks: number[];
  latencyMs: number;
  latencySource: 'speaker' | 'calibrated' | 'none';
  /** Pocket width when the test was taken; the score is recomputed live from offsets. */
  pocketMs: number;
  score: number;
  meanOffset: number;
  coach: CoachText;
  aiReport?: string;
  saved?: boolean;
}

interface Usage {
  day: string;
  tests: number;
}

const DEFAULT_SETTINGS: Settings = {
  pocketMs: 20,
  clickVolume: 0.7,
  defaultTempo: 120,
  durationSec: 60,
  haptics: true,
  inputMode: 'mic',
  sensitivity: 'medium',
  latency: { mic: null, tap: null },
};

const DEFAULT_PROFILE: Profile = { name: '', onboarded: false, premium: false };

export const FREE_TESTS_PER_DAY = 3;

const KEYS = {
  settings: 'pp.settings.v1',
  profile: 'pp.profile.v1',
  sessions: 'pp.sessions.v1',
  usage: 'pp.usage.v1',
};

const today = () => new Date().toISOString().slice(0, 10);

interface Store {
  ready: boolean;
  settings: Settings;
  profile: Profile;
  sessions: SessionResult[];
  /** The result being viewed: freshly recorded, or opened from history. */
  current: SessionResult | null;
  testsToday: number;
  testsLeft: number;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setCurrent: (r: SessionResult | null) => void;
  updateCurrent: (patch: Partial<SessionResult>) => void;
  saveCurrent: () => void;
  recordTestUsed: () => void;
  clearSessions: () => void;
}

const Ctx = createContext<Store | null>(null);

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

/**
 * Loads persisted state on mount (`ready` stays false until then) and exposes it
 * with update functions. Usage resets each day; history keeps the newest 300.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [usage, setUsage] = useState<Usage>({ day: today(), tests: 0 });
  const [current, setCurrent] = useState<SessionResult | null>(null);

  useEffect(() => {
    (async () => {
      const [s, p, u] = await Promise.all([
        read(KEYS.settings, DEFAULT_SETTINGS),
        read(KEYS.profile, DEFAULT_PROFILE),
        read<Usage>(KEYS.usage, { day: today(), tests: 0 }),
      ]);
      let list: SessionResult[] = [];
      try {
        list = JSON.parse((await AsyncStorage.getItem(KEYS.sessions)) ?? '[]');
      } catch {}
      setSettings({ ...s, latency: { ...DEFAULT_SETTINGS.latency, ...s.latency } });
      setProfile(p);
      setSessions(list);
      setUsage(u.day === today() ? u : { day: today(), tests: 0 });
      setReady(true);
    })();
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      write(KEYS.settings, next);
      return next;
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      write(KEYS.profile, next);
      return next;
    });
  }, []);

  const updateCurrent = useCallback((patch: Partial<SessionResult>) => {
    setCurrent((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const saveCurrent = useCallback(() => {
    setCurrent((cur) => {
      if (!cur) return cur;
      const saved = { ...cur, saved: true };
      setSessions((prev) => {
        const next = [saved, ...prev.filter((s) => s.id !== saved.id)].slice(0, 300);
        write(KEYS.sessions, next);
        return next;
      });
      return saved;
    });
  }, []);

  const recordTestUsed = useCallback(() => {
    setUsage((prev) => {
      const next = prev.day === today() ? { ...prev, tests: prev.tests + 1 } : { day: today(), tests: 1 };
      write(KEYS.usage, next);
      return next;
    });
  }, []);

  const clearSessions = useCallback(() => {
    setSessions([]);
    write(KEYS.sessions, []);
  }, []);

  const testsToday = usage.day === today() ? usage.tests : 0;

  const value = useMemo<Store>(
    () => ({
      ready,
      settings,
      profile,
      sessions,
      current,
      testsToday,
      testsLeft: profile.premium ? Infinity : Math.max(0, FREE_TESTS_PER_DAY - testsToday),
      updateSettings,
      updateProfile,
      setCurrent,
      updateCurrent,
      saveCurrent,
      recordTestUsed,
      clearSessions,
    }),
    [ready, settings, profile, sessions, current, testsToday, updateSettings, updateProfile, updateCurrent, saveCurrent, recordTestUsed, clearSessions],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the store from any component under StoreProvider. */
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

