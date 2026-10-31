/**
 * The app's single audio engine, built on react-native-audio-api: one
 * AudioContext with the click and pad sounds decoded into memory.
 *
 * Sounds are scheduled at an exact time on the context's clock (`play(sound,
 * when)`), so the click is sample-accurate: no JS timer decides when it sounds.
 * That clock is also what every hit is measured against.
 */
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { AudioContext, type AudioBuffer, type AudioBufferSourceNode } from 'react-native-audio-api';
import { configureSession } from './devices';

export type Sound = 'accent' | 'click' | 'pad';

const SOURCES: Record<Sound, number> = {
  accent: require('../../assets/sounds/click-accent.wav'),
  click: require('../../assets/sounds/click.wav'),
  pad: require('../../assets/sounds/pad.wav'),
};

export interface Engine {
  ctx: AudioContext;
  /** Current time on the audio clock, in ms. */
  nowMs: () => number;
  /** Play a sound at `whenSec` on the audio clock (now if omitted or in the past). */
  play: (sound: Sound, whenSec?: number, volume?: number) => void;
  /** Silence every sound that's playing or scheduled. */
  stopAll: () => void;
}

let enginePromise: Promise<Engine> | null = null;

/** The shared engine, created on first use. */
export function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = createEngine().catch((e) => {
      enginePromise = null;
      throw e;
    });
  }
  return enginePromise.then(async (engine) => {
    if (engine.ctx.state === 'suspended') await engine.ctx.resume();
    return engine;
  });
}

async function decode(ctx: AudioContext, module: number): Promise<AudioBuffer> {
  // Native decodes bundled assets by module id; the web decoder needs the bytes.
  if (Platform.OS !== 'web') return ctx.decodeAudioData(module);
  const res = await fetch(Asset.fromModule(module).uri);
  return ctx.decodeAudioData(await res.arrayBuffer());
}

async function createEngine(): Promise<Engine> {
  configureSession();
  const ctx = new AudioContext();
  const entries = await Promise.all(
    (Object.keys(SOURCES) as Sound[]).map(async (s) => [s, await decode(ctx, SOURCES[s])] as const),
  );
  const buffers = Object.fromEntries(entries) as Record<Sound, AudioBuffer>;
  const active = new Set<AudioBufferSourceNode>();

  const play = (sound: Sound, whenSec = 0, volume = 1) => {
    const src = ctx.createBufferSource();
    src.buffer = buffers[sound];
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.onEnded = () => active.delete(src);
    active.add(src);
    src.start(Math.max(whenSec, ctx.currentTime));
  };

  const stopAll = () => {
    for (const src of active) {
      try {
        src.stop();
      } catch {}
    }
    active.clear();
  };

  return { ctx, nowMs: () => ctx.currentTime * 1000, play, stopAll };
}
