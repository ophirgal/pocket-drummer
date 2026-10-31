import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClockSync } from './clockSync';
import { EXERCISES } from './exercises';
import { EnvelopeBuilder, LiveOnsets, detectOnsets, mergeCloseOnsets } from './onset';
import { decodeRecording, encodeRecording, levelBetween } from './recording';
import { COUNT_IN_BEATS, scoreTest, strokeGapMs, type TakenTest } from './scoring';

const SR = 48000;
const single = EXERCISES.find((e) => e.id === 'single-stroke-roll')!;

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** Synthesize hits as decaying noise bursts at the given times (ms), with a noise floor. */
function render(hits: { at: number; level: number }[], lengthMs: number, noise = 0.004): Float32Array {
  const out = new Float32Array(Math.round((lengthMs / 1000) * SR));
  const rnd = rng(7);
  for (let i = 0; i < out.length; i++) out[i] = (rnd() * 2 - 1) * noise;
  for (const h of hits) {
    const s0 = Math.round((h.at / 1000) * SR);
    for (let k = 0; k < SR * 0.08 && s0 + k < out.length; k++) out[s0 + k] += h.level * Math.exp(-k / (SR * 0.01)) * (rnd() * 2 - 1);
  }
  return out;
}

/** Feed audio to an EnvelopeBuilder in 10 ms chunks, like the recorder does. */
function envelopeOf(audio: Float32Array) {
  const b = new EnvelopeBuilder(SR, audio.length / SR + 1);
  for (let i = 0; i < audio.length; i += 480) b.push(audio.subarray(i, i + 480), i);
  return b;
}

test('a dropped recorder buffer leaves a gap instead of shifting later hits', () => {
  const audio = render([{ at: 300, level: 0.6 }, { at: 900, level: 0.6 }], 1200);
  const b = new EnvelopeBuilder(SR, 2);
  for (let i = 0; i < audio.length; i += 480) {
    if (i === 480 * 40) continue; // lose the chunk at 400 ms
    b.push(audio.subarray(i, i + 480), i);
  }
  const onsets = detectOnsets(b.envelope, b.hopMs, { threshold: 0.1 });
  assert.deepEqual(
    onsets.map((o) => Math.round(o.index * b.hopMs)),
    [300, 900],
  );
});

test('live detection while audio streams in finds the same hits as the final pass', () => {
  const audio = render([200, 450, 700, 760, 1100, 1350].map((at) => ({ at, level: 0.5 })), 1600);
  const b = new EnvelopeBuilder(SR, 2);
  const live = new LiveOnsets(b.hopMs);
  const found: { index: number; peak: number }[] = [];
  for (let i = 0; i < audio.length; i += 480) {
    b.push(audio.subarray(i, i + 480), i);
    found.push(...live.scan(b.envelope, 0.1));
  }
  // Same hits, and the same peaks (each reported once its peak window has arrived).
  assert.deepEqual(found, detectOnsets(b.envelope, b.hopMs, { threshold: 0.1 }));
  assert.equal(found.length, 6);
});

test('clock sync recovers the stream-to-context mapping from jittery readings', () => {
  const ctxMinusPerf = 5000.3;
  const perfMinusStream = 777;
  const quantum = (128 / 48000) * 1000;
  const sync = new ClockSync();
  const rnd = rng(3);
  for (let k = 0; k < 600; k++) {
    // The context clock only advances once per render quantum.
    const perf = 1000 + k * 10 + rnd() * 10;
    sync.observeContext(Math.floor((perf + ctxMinusPerf) / quantum) * quantum, perf);
    // Each 10 ms chunk reaches JS a variable time after it was captured.
    const streamEnd = (k + 1) * 10;
    sync.observeStream(streamEnd, streamEnd + perfMinusStream + rnd() ** 3 * 12);
  }
  const err = sync.streamToContext(1234) - (1234 + perfMinusStream + ctxMinusPerf);
  assert.ok(Math.abs(err) < 0.5, `error ${err.toFixed(2)} ms`);
});

test('recordings survive encoding', () => {
  const r = decodeRecording(encodeRecording(-100, 900, (a) => (a >= 200 && a < 210 ? 0.8 : 0.1)));
  assert.equal(r.levels.length, 200);
  assert.ok(Math.abs(levelBetween(r, 200, 210) - 1) < 0.01);
  assert.ok(Math.abs(levelBetween(r, 500, 600) - 0.125) < 0.01);
});

/**
 * A test on the audio-clock timeline: the recording starts at context time
 * `streamStart`, the first count-in click is at `t0`, and the player's strokes
 * land at `offsets` from each note.
 */
function takeTest(opts: {
  offsets: number[];
  inputLatency: number;
  bleedLag?: number;
  calibrated: number | null;
  /** A weaker second bump after every stroke, like a stick rebounding on the pad. */
  rebound?: { afterMs: number; level: number };
}): TakenTest {
  const bpm = 120;
  const beatMs = 500;
  const streamStart = 1000;
  const t0 = 1500;
  const bars = 2;
  const scoredStart = t0 + COUNT_IN_BEATS * beatMs;
  const stepMs = beatMs / single.stepsPerBeat;
  const sounds: { at: number; level: number }[] = [];
  opts.offsets.forEach((off, i) => {
    const at = scoredStart + i * stepMs + off + opts.inputLatency - streamStart;
    sounds.push({ at, level: 0.6 });
    if (opts.rebound) sounds.push({ at: at + opts.rebound.afterMs, level: opts.rebound.level });
  });
  if (opts.bleedLag !== undefined) {
    // Through a speaker, the mic also hears every click.
    for (let k = 0; k < COUNT_IN_BEATS + bars * 4; k++) sounds.push({ at: t0 + k * beatMs + opts.bleedLag - streamStart, level: 0.12 });
  }
  const env = envelopeOf(render(sounds, 7500));
  return {
    exercise: single,
    bpm,
    inputMode: 'mic',
    sensitivity: 'medium',
    pocketMs: 20,
    calibratedLatency: opts.calibrated,
    t0,
    bars,
    stoppedAt: scoredStart + bars * 2000 + 250,
    mic: { envelope: env.envelope, hopMs: env.hopMs, startMs: streamStart },
  };
}

const PLAYED = [-30, 12, 0, 25, -8, 3, -15, 40, 5, -22, 0, 9, -3, 18, -12, 6];

test('headphones: calibrated latency is removed and every offset is recovered', () => {
  const r = scoreTest(takeTest({ offsets: PLAYED, inputLatency: 45, calibrated: 45 }))!;
  assert.equal(r.latencySource, 'calibrated');
  assert.equal(r.offsets.length, PLAYED.length);
  r.offsets.forEach((o, i) => assert.ok(o !== null && Math.abs(o - PLAYED[i]) <= 1.5, `note ${i}: ${o} vs ${PLAYED[i]}`));
  assert.equal(r.extraHits, 0);
  // Hits and the recording are latency-corrected, relative to the first scored beat.
  assert.ok(Math.abs(r.hits![0] - PLAYED[0]) <= 1.5);
  const rec = decodeRecording(r.recording!);
  assert.ok(levelBetween(rec, PLAYED[0] - 5, PLAYED[0] + 15) > 0.5);
  assert.ok(levelBetween(rec, 100, 200) < 0.1);
});

test('speaker: the click echo in the count-in measures latency automatically', () => {
  const r = scoreTest(takeTest({ offsets: PLAYED, inputLatency: 60, bleedLag: 60, calibrated: null }))!;
  assert.equal(r.latencySource, 'speaker');
  assert.ok(Math.abs(r.latencyMs - 60) <= 1.5, String(r.latencyMs));
  r.offsets.forEach((o, i) => {
    // A stroke a few ms after a click merges with the click's echo, and its onset is read
    // at the echo: up to ~8 ms early. That's why headphones are recommended.
    const tolerance = i % single.stepsPerBeat === 0 ? 8 : 2;
    assert.ok(o !== null && Math.abs(o - PLAYED[i]) <= tolerance, `note ${i}: ${o} vs ${PLAYED[i]}`);
  });
});

test('a stroke and its rebound count as one hit', () => {
  const r = scoreTest(takeTest({ offsets: PLAYED, inputLatency: 0, calibrated: 0, rebound: { afterMs: 60, level: 0.18 } }))!;
  assert.equal(r.extraHits, 0);
  r.offsets.forEach((o, i) => assert.ok(o !== null && Math.abs(o - PLAYED[i]) <= 1.5, `note ${i}: ${o} vs ${PLAYED[i]}`));
});

test('close onsets merge into the louder one, wherever it comes', () => {
  const hop = 0.5;
  const at = (ms: number, peak: number) => ({ index: ms / hop, peak });
  const merged = mergeCloseOnsets([at(100, 0.2), at(140, 0.8), at(400, 0.9), at(450, 0.3), at(700, 0.5)], hop, 75);
  assert.deepEqual(merged, [at(140, 0.8), at(400, 0.9), at(700, 0.5)]);
});

test('the stroke window follows the exercise', () => {
  const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;
  assert.equal(strokeGapMs(ex('single-stroke-roll'), 120), 150); // 8ths: 250 ms apart
  assert.equal(strokeGapMs(ex('paradiddle'), 120), 75); // 16ths: 125 ms apart
  assert.equal(strokeGapMs(ex('bossa-nova'), 100), 0.6 * 2 * 150); // closest notes are two 16ths apart
  assert.equal(strokeGapMs(ex('paradiddle'), 240), 45); // never below the refractory period
});

test('stopping during the count-in is too short to score', () => {
  const t = takeTest({ offsets: PLAYED, inputLatency: 0, calibrated: null });
  assert.equal(scoreTest({ ...t, stoppedAt: t.t0 + 1000 }), null);
});
