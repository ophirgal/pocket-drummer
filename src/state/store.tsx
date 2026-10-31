/**
 * App-wide state in a single React context: settings, profile, saved sessions,
 * the daily free-test count, and the session currently being viewed. Everything
 * except `current` is persisted to AsyncStorage on each change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { CoachText } from '@/lib/coach';
import type { StoredRecording } from '@/lib/recording';

export type InputMode = 'mic' | 'tap';
export type Sensitivity = 'low' | 'medium' | 'high';

/** Record from the phone's own microphone, even when headphones with a mic are plugged in. */
export const MIC_BUILTIN = 'builtin';

export interface Settings {
  /** Half-width of the pocket around each beat, in ms. */
  pocketMs: number;
  clickVolume: number;
  defaultTempo: number;
  durationSec: number;
  haptics: boolean;
  inputMode: InputMode;
  sensitivity: Sensitivity;
  /**
   * MIC_BUILTIN, or the id of a specific input device (used while it's
   * connected; otherwise the built-in mic is used).
   */
  micInput: string;
  /** Display name of the chosen device, for when it isn't connected. */
  micInputName?: string;
  /**
   * Measured by the calibration screen, per input mode and per audio output
   * (speaker, wired headphones, each Bluetooth headset), since each output has
   * its own delay. Keyed by AudioRoute.key; missing = not calibrated.
   */
  latency: Record<InputMode, Record<string, number>>;
}

/** Where the click is playing, which decides the latency correction. */
export interface AudioRoute {
  key: string;
  label: string;
  headphones: boolean;
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
  /** Every detected hit, latency-corrected, in ms from the first scored beat. */
  hits?: number[];
  /** The recording's level over time, for drawing it over the beat grid (mic mode only). */
  recording?: StoredRecording;
  latencyMs: number;
  latencySource: 'speaker' | 'calibrated' | 'none';
  /** The audio output the click played through. */
  route?: AudioRoute;
  /** The microphone that recorded the test. */
  micName?: string;
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

export const DEFAULT_SETTINGS: Settings = {
  pocketMs: 30,
  clickVolume: 0.7,
  defaultTempo: 100,
  durationSec: 10,
  haptics: false,
  inputMode: 'mic',
  sensitivity: 'medium',
  micInput: MIC_BUILTIN,
  latency: { mic: {}, tap: {} },
};

/** Saved sessions beyond this many keep their scores but drop the recording, to keep storage small. */
const SESSIONS_WITH_RECORDING = 30;

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
  /** Back to DEFAULT_SETTINGS, including latency (no calibrations, so it's automatic again). */
  resetSettings: () => void;
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
 * Older versions stored one number per input mode, measured with a different
 * audio engine and without knowing the output. Those values don't apply any
 * more, so they're dropped and the user recalibrates.
 */
function migrateLatency(stored: unknown): Settings['latency'] {
  const l = stored as Partial<Record<InputMode, unknown>> | undefined;
  const ok = (v: unknown): v is Record<string, number> => typeof v === 'object' && v !== null;
  return { mic: ok(l?.mic) ? l.mic : {}, tap: ok(l?.tap) ? l.tap : {} };
}

/**
 * Loads persisted state on mount (`ready` stays false until then) and exposes it
 * with update functions. Usage resets each day; history keeps the newest 300
 * sessions, and the newest 30 of those keep their recordings.
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
      setSettings({ ...s, latency: migrateLatency(s.latency) });
      setProfile(p);
      setSessions(list);
      setUsage(u.day === today() ? u : { day: today(), tests: 0 });
      setReady(true);
    })();
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    write(KEYS.settings, DEFAULT_SETTINGS);
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
        const next = [saved, ...prev.filter((s) => s.id !== saved.id)]
          .slice(0, 300)
          .map((s, i) => (i >= SESSIONS_WITH_RECORDING && s.recording ? { ...s, recording: undefined } : s));
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
      resetSettings,
      updateProfile,
      setCurrent,
      updateCurrent,
      saveCurrent,
      recordTestUsed,
      clearSessions,
    }),
    [ready, settings, profile, sessions, current, testsToday, updateSettings, resetSettings, updateProfile, updateCurrent, saveCurrent, recordTestUsed, clearSessions],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the store from any component under StoreProvider. */
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

