/**
 * Web version of devices.ts. Browsers don't expose the audio session or the
 * output device, so the browser's default mic is used and the output is unknown
 * (the count-in echo or a calibration still corrects the latency).
 */
import type { AudioRoute } from '@/state/store';

export type MicKind = 'builtin' | 'headset' | 'bluetooth' | 'usb' | 'other';

export interface Mic {
  id: string;
  name: string;
  kind: MicKind;
}

export const canChooseMic = false;

const BROWSER: AudioRoute = { key: 'web', label: 'Browser audio', headphones: false };

export function configureSession(): void {}

/** The browser asks for permission when recording starts. */
export async function requestMicPermission(): Promise<boolean> {
  return true;
}

export async function listMics(): Promise<Mic[]> {
  return [];
}

export async function applyMicPreference(_pref: string): Promise<Mic | null> {
  return null;
}

export async function currentRoute(): Promise<AudioRoute> {
  return BROWSER;
}

export function useAudioDevices(): { mics: Mic[]; route: AudioRoute | null } {
  return { mics: [], route: BROWSER };
}
