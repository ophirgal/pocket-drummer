import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnvelopeBuilder, detectOnsets, maxIn } from './onset';
import { analyze, buildExpectedNotes, classShares, playedTempo, summarize } from './analysis';
import { EXERCISES } from './exercises';
import { coachFor } from './coach';

const SR = 48000;

/** Synthesize a pad hit: a fast decaying noise burst. */
function render(hitsMs: number[], lengthMs: number, level = 0.6, noise = 0.005): Float32Array {
  const out = new Float32Array(Math.round((lengthMs / 1000) * SR));
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < out.length; i++) out[i] = rnd() * noise;
  for (const h of hitsMs) {
    const s0 = Math.round((h / 1000) * SR);
    for (let k = 0; k < SR * 0.08 && s0 + k < out.length; k++) {
      out[s0 + k] += level * Math.exp(-k / (SR * 0.01)) * rnd();
    }
  }
  return out;
}

function envelopeOf(audio: Float32Array) {
  const b = new EnvelopeBuilder(SR, audio.length / SR + 1);
  for (let i = 0; i < audio.length; i += 1024) b.push(audio.subarray(i, i + 1024));
  return b;
}

test('detects hits within a millisecond', () => {
  const hits = [500, 750, 1003, 1240, 1500, 1620];
  const b = envelopeOf(render(hits, 2000));
  const onsets = detectOnsets(b.envelope, b.hopMs, { threshold: 0.1 });
  assert.equal(onsets.length, hits.length);
  onsets.forEach((o, i) => assert.ok(Math.abs(o.index * b.hopMs - hits[i]) <= 1, `hit ${i}: ${o.index * b.hopMs}`));
});

test('ignores quiet bleed below the threshold', () => {
  const loud = render([500, 1000], 1500, 0.6);
  const quiet = render([250, 750, 1250], 1500, 0.05, 0);
  const mix = loud.map((v, i) => v + quiet[i]);
  const b = envelopeOf(mix);
  const noise = maxIn(b.envelope, 0, Math.round(300 / b.hopMs));
  const onsets = detectOnsets(b.envelope, b.hopMs, { threshold: Math.max(0.03, noise * 2) });
  assert.deepEqual(onsets.map((o) => Math.round(o.index * b.hopMs / 10) * 10), [500, 1000]);
});

const single = EXERCISES.find((e) => e.id === 'single-stroke-roll')!;

test('perfect playing scores 100 and is in the pocket', () => {
  const exp = buildExpectedNotes(single, 120, 1000, 4);
  const a = analyze(exp.map((e) => e.time), exp, 20, single.bar.length);
  assert.equal(a.pocketScore, 100);
  assert.equal(a.verdict, 'pocket');
});

test('early hits are rushing, late hits dragging', () => {
  const exp = buildExpectedNotes(single, 120, 1000, 4);
  const early = analyze(exp.map((e) => e.time - 35), exp, 20, single.bar.length);
  assert.equal(early.verdict, 'rushing');
  assert.equal(classShares(early).rushed, 100);
  const late = analyze(exp.map((e) => e.time + 30), exp, 20, single.bar.length);
  assert.equal(late.verdict, 'dragging');
  // Widening the pocket to ±40 ms puts the same hits back on time.
  assert.equal(summarize(late.notes, 40, single.bar.length).pocketScore, 100);
});

test('missed notes and extra hits are counted', () => {
  const exp = buildExpectedNotes(single, 120, 1000, 2);
  const hits = exp.slice(2).map((e) => e.time);
  hits.push(exp[5].time + 5);
  const a = analyze(hits, exp, 20, single.bar.length);
  assert.equal(a.hits, exp.length - 2);
  assert.equal(a.extraHits, 1);
});

test('tempo drift is measured', () => {
  const exp = buildExpectedNotes(single, 100, 0, 8);
  // Speeding up: each note lands 0.5% sooner relative to the start.
  const a = analyze(exp.map((e) => e.time * 0.995), exp, 20, single.bar.length);
  const t = playedTempo(a, 100)!;
  assert.ok(Math.abs(t - 100.5) < 0.1, String(t));
});

test('coach names the tendency', () => {
  const exp = buildExpectedNotes(single, 120, 1000, 4);
  const a = analyze(exp.map((e) => e.time - 35), exp, 20, single.bar.length);
  const c = coachFor(a, single, 120);
  assert.match(c.verdictLine, /rushing/);
  assert.ok(c.report.length > 20);
});
