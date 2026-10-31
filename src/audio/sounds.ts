import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

type Sound = 'accent' | 'click' | 'pad';

const SOURCES: Record<Sound, number> = {
  accent: require('../../assets/sounds/click-accent.wav'),
  click: require('../../assets/sounds/click.wav'),
  pad: require('../../assets/sounds/pad.wav'),
};

// A small round-robin pool per sound so a click never waits for the previous one
// to rewind. After each play, the player two slots ahead is rewound ready for later.
const POOL = 4;
let pools: Record<Sound, AudioPlayer[]> | null = null;
const cursor: Record<Sound, number> = { accent: 0, click: 0, pad: 0 };
let recordingMode = false;

/** Loads the click and pad sounds (once) and sets playback mode. Call before playing. */
export async function initSounds(): Promise<void> {
  if (!pools) {
    pools = {
      accent: Array.from({ length: POOL }, () => createAudioPlayer(SOURCES.accent)),
      click: Array.from({ length: POOL }, () => createAudioPlayer(SOURCES.click)),
      pad: Array.from({ length: POOL }, () => createAudioPlayer(SOURCES.pad)),
    };
  }
  await setPlaybackMode();
}

/** Plain playback: sound plays in silent mode and mixes with other apps. */
export async function setPlaybackMode(): Promise<void> {
  recordingMode = false;
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', allowsRecording: false });
}

/** Lets the mic and the click run together (on iOS this must be set before recording). */
export async function setRecordingMode(): Promise<void> {
  if (recordingMode) return;
  recordingMode = true;
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    allowsRecording: true,
    shouldRouteThroughEarpiece: false,
  });
}

/** Plays a sound immediately from the next player in its pool. No-op before initSounds. */
export function play(sound: Sound, volume = 1): void {
  if (!pools) return;
  const pool = pools[sound];
  const i = cursor[sound];
  const p = pool[i];
  p.volume = volume;
  p.play();
  cursor[sound] = (i + 1) % POOL;
  const upcoming = pool[(i + 2) % POOL];
  upcoming.pause();
  upcoming.seekTo(0).catch(() => {});
}
