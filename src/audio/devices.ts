/**
 * Audio session, microphone choice and output detection on iOS and Android.
 *
 * The app is meant to be used with headphones, so the click doesn't end up in
 * the recording, while recording from the phone's own mic: a headset mic sits
 * by your face (or in your ear), not by the pad, and Bluetooth mics switch the
 * headphones into low-quality, high-latency call mode.
 *
 * - iOS: the session is play-and-record in "measurement" mode (no voice
 *   processing or auto gain on the mic). Bluetooth is allowed only as A2DP
 *   (high-quality output); HFP (the headset mic) is left off, so Bluetooth
 *   headphones never take over the mic. Wired headsets do offer their mic, so
 *   the preferred input is set to the built-in mic before every test unless the
 *   user picked another one in Settings.
 * - Android: react-native-audio-api doesn't support choosing the input yet (its
 *   setInputDevice is a no-op), so Android decides: Bluetooth headphones keep
 *   using the phone's mic, but a wired headset's mic takes over while plugged in.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { AudioManager, type AudioDeviceInfo } from 'react-native-audio-api';
import { MIC_BUILTIN, type AudioRoute } from '@/state/store';

export type MicKind = 'builtin' | 'headset' | 'bluetooth' | 'usb' | 'other';

export interface Mic {
  id: string;
  name: string;
  kind: MicKind;
}

/** Whether the app can pick the microphone itself (otherwise the system does). */
export const canChooseMic = Platform.OS === 'ios';

// iOS reports AVAudioSession port types; Android reports its own labels.
const MIC_KINDS: Record<string, MicKind> = {
  MicrophoneBuiltIn: 'builtin',
  MicrophoneWired: 'headset',
  BluetoothHFP: 'bluetooth',
  USBAudio: 'usb',
  'Built-in Mic': 'builtin',
  'Wired Headset': 'headset',
  'Bluetooth SCO': 'bluetooth',
};

const SPEAKER: AudioRoute = { key: 'speaker', label: 'Phone speaker', headphones: false };

/** Set the iOS audio session up for playing the click while recording. Call before creating the AudioContext. */
export function configureSession(): void {
  if (Platform.OS !== 'ios') return;
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode: 'measurement',
    iosOptions: ['allowBluetoothA2DP', 'defaultToSpeaker'],
  });
}

export async function requestMicPermission(): Promise<boolean> {
  return (await AudioManager.requestRecordingPermissions()) === 'Granted';
}

async function devicesInfo() {
  // Inputs are only listed for the active play-and-record session.
  if (Platform.OS === 'ios') {
    configureSession();
    await AudioManager.setAudioSessionActivity(true).catch(() => {});
  }
  return AudioManager.getDevicesInfo();
}

function toMic(d: AudioDeviceInfo): Mic | null {
  const kind = MIC_KINDS[d.category];
  if (!kind) return null;
  return { id: d.id, name: kind === 'builtin' ? "Phone's microphone" : d.name, kind };
}

/** Microphones that are connected now. Android may list several built-in mics; they're shown as one. */
export async function listMics(): Promise<Mic[]> {
  const info = await devicesInfo();
  const mics: Mic[] = [];
  for (const d of info.availableInputs) {
    const m = toMic(d);
    if (m && !(m.kind === 'builtin' && mics.some((x) => x.kind === 'builtin'))) mics.push(m);
  }
  return mics;
}

/**
 * Route recording to the preferred mic (iOS) and return the mic that will be
 * used. On Android this is the system's choice: the wired headset's mic if one
 * is plugged in, otherwise the phone's.
 */
export async function applyMicPreference(pref: string): Promise<Mic | null> {
  const mics = await listMics();
  const builtin = mics.find((m) => m.kind === 'builtin') ?? null;
  if (!canChooseMic) return mics.find((m) => m.kind === 'headset') ?? builtin;
  const target = (pref !== MIC_BUILTIN && mics.find((m) => m.id === pref)) || builtin;
  if (target) await AudioManager.setInputDevice(target.id).catch(() => {});
  return target;
}

/** Where sound is playing now: the phone speaker, wired headphones, or a Bluetooth device. */
export async function currentRoute(): Promise<AudioRoute> {
  const info = await devicesInfo();
  if (Platform.OS === 'ios') {
    const out = info.currentOutputs[0];
    if (!out) return SPEAKER;
    switch (out.category) {
      case 'Speaker':
      case 'Receiver':
        return SPEAKER;
      case 'Headphones':
        return { key: 'wired', label: 'Wired headphones', headphones: true };
      case 'BluetoothA2DPOutput':
      case 'BluetoothLE':
      case 'BluetoothHFP':
        return { key: `bt:${out.name}`, label: out.name, headphones: true };
      default:
        return { key: `${out.category}:${out.name}`, label: out.name, headphones: out.category === 'USBAudio' };
    }
  }
  // Android lists connected outputs only; media goes to Bluetooth, then wired, then the speaker.
  const outs = info.availableOutputs;
  const bt = outs.find((d) => d.category === 'Bluetooth A2DP');
  if (bt) return { key: `bt:${bt.name}`, label: bt.name, headphones: true };
  if (outs.some((d) => d.category === 'Wired Headset' || d.category === 'Wired Headphones')) {
    return { key: 'wired', label: 'Wired headphones', headphones: true };
  }
  return SPEAKER;
}

/** Connected mics and the current output, kept up to date as devices come and go. */
export function useAudioDevices(): { mics: Mic[]; route: AudioRoute | null } {
  const [mics, setMics] = useState<Mic[]>([]);
  const [route, setRoute] = useState<AudioRoute | null>(null);
  const refresh = useCallback(() => {
    listMics().then(setMics).catch(() => {});
    currentRoute().then(setRoute).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    const sub = AudioManager.addSystemEventListener('routeChange', refresh);
    return () => sub?.remove();
  }, [refresh]);
  return { mics, route };
}
