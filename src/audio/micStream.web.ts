import { useEffect, useRef } from 'react';

export type MicListener = (samples: Float32Array, sampleRate: number) => void;

export interface MicStream {
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Live microphone PCM in the browser, via the Web Audio API (expo-audio's
 * AudioStream has no web implementation). Echo cancellation and auto gain are
 * turned off so drum hits keep their shape.
 */
export function useMicStream(onSamples: MicListener): MicStream {
  const listener = useRef(onSamples);
  useEffect(() => {
    listener.current = onSamples;
  });
  const state = useRef<{ ctx: AudioContext; media: MediaStream; node: ScriptProcessorNode } | null>(null);

  const stop = () => {
    const s = state.current;
    state.current = null;
    if (!s) return;
    s.node.disconnect();
    s.media.getTracks().forEach((t) => t.stop());
    s.ctx.close().catch(() => {});
  };

  const start = async () => {
    stop();
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new AudioContext();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(media);
    const node = ctx.createScriptProcessor(1024, 1, 1);
    node.onaudioprocess = (e) => listener.current(new Float32Array(e.inputBuffer.getChannelData(0)), ctx.sampleRate);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    state.current = { ctx, media, node };
  };

  return { start, stop };
}
