import { useKeepAwake } from 'expo-keep-awake';

/** Render while a test runs so the screen doesn't lock. */
export function KeepAwake() {
  useKeepAwake();
  return null;
}
