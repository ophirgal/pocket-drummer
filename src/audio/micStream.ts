import { useAudioStream, type AudioStreamBuffer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';
import { toMonoFloat } from '@/lib/onset';

export type MicListener = (samples: Float32Array, sampleRate: number) => void;

export interface MicStream {
  start: () => Promise<void>;
  stop: () => void;
}

/** Live microphone PCM on iOS and Android, through expo-audio's AudioStream. */
export function useMicStream(onSamples: MicListener): MicStream {
  const listener = useRef(onSamples);
  useEffect(() => {
    listener.current = onSamples;
  });
  const onBuffer = useCallback((buf: AudioStreamBuffer) => {
    listener.current(toMonoFloat(buf.data, buf.channels, 'float32'), buf.sampleRate);
  }, []);
  const { stream } = useAudioStream({ sampleRate: 48000, channels: 1, encoding: 'float32', onBuffer });
  return {
    start: () => stream.start(),
    stop: () => {
      try {
        if (stream.isStreaming) stream.stop();
      } catch {}
    },
  };
}
