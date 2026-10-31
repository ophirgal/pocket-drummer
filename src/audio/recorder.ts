/**
 * Live microphone PCM on iOS and Android, through react-native-audio-api's
 * AudioRecorder. Audio arrives in small mono chunks, each stamped with where it
 * starts in the recording, so a dropped buffer can't shift later hits.
 */
import { AudioRecorder } from 'react-native-audio-api';

/** `startMs` is where the chunk begins on the recording's own clock. */
export type ChunkListener = (samples: Float32Array, sampleRate: number, startMs: number) => void;

export interface MicCapture {
  /** Starts recording; rejects if the mic can't be opened. */
  start: (onChunk: ChunkListener) => Promise<void>;
  stop: () => Promise<void>;
}

const SAMPLE_RATE = 48000;
// 10 ms chunks: more frequent arrivals give the clock sync more readings.
const CHUNK_FRAMES = 480;

export function createMicCapture(): MicCapture {
  const recorder = new AudioRecorder();
  return {
    async start(onChunk) {
      const ready = recorder.onAudioReady({ sampleRate: SAMPLE_RATE, bufferLength: CHUNK_FRAMES, channelCount: 1 }, (e) => {
        onChunk(e.buffer.getChannelData(0).subarray(0, e.numFrames), e.buffer.sampleRate, e.when * 1000);
      });
      if (ready.status === 'error') throw new Error(ready.message);
      const started = await recorder.start();
      if (started.status === 'error') throw new Error(started.message);
    },
    async stop() {
      recorder.clearOnAudioReady();
      if (recorder.isRecording()) await recorder.stop();
    },
  };
}
