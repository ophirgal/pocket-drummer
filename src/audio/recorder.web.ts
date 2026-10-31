/**
 * Live microphone PCM in the browser, via the Web Audio API
 * (react-native-audio-api has no recorder on the web). Echo cancellation, noise
 * suppression and auto gain are turned off so drum hits keep their shape.
 */
import type { ChunkListener, MicCapture } from './recorder';

export type { ChunkListener, MicCapture } from './recorder';

export function createMicCapture(): MicCapture {
  let state: { ctx: AudioContext; media: MediaStream; node: ScriptProcessorNode } | null = null;

  const stop = async () => {
    const s = state;
    state = null;
    if (!s) return;
    s.node.disconnect();
    s.media.getTracks().forEach((t) => t.stop());
    await s.ctx.close().catch(() => {});
  };

  const start = async (onChunk: ChunkListener) => {
    await stop();
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new AudioContext();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(media);
    const node = ctx.createScriptProcessor(1024, 1, 1);
    let frames = 0;
    node.onaudioprocess = (e) => {
      const samples = new Float32Array(e.inputBuffer.getChannelData(0));
      onChunk(samples, ctx.sampleRate, (frames / ctx.sampleRate) * 1000);
      frames += samples.length;
    };
    // The processor only runs while connected to the output; mute it.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    state = { ctx, media, node };
  };

  return { start, stop };
}
