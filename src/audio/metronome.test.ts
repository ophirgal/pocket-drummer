import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Engine } from './engine';
import { Metronome } from './metronome';

/** An engine whose clock is performance.now(), with no sound. */
const fakeEngine = { nowMs: () => performance.now(), play: () => {}, stopAll: () => {} } as unknown as Engine;

test('changing the tempo mid-run carries on from the last tick without a jump', async () => {
  const m = new Metronome(fakeEngine);
  const times: number[] = [];
  const done = new Promise<void>((resolve) =>
    m.start({ startMs: performance.now() + 20, intervalMs: 100, totalTicks: 10, onSchedule: (_, t) => times.push(t), onDone: resolve }),
  );
  await new Promise((r) => setTimeout(r, 330));
  const queued = times.length;
  m.setIntervalMs(50);
  await done;

  assert.equal(times.length, 10);
  const gaps = times.slice(1).map((t, i) => Math.round(t - times[i]));
  // Ticks queued before the change keep the old spacing; every one after it uses the new.
  assert.deepEqual(gaps, [...new Array(queued - 1).fill(100), ...new Array(10 - queued).fill(50)]);
});

test('stopping cancels the remaining ticks and the done callback', async () => {
  const m = new Metronome(fakeEngine);
  let ticks = 0;
  let finished = false;
  m.start({ startMs: performance.now(), intervalMs: 40, totalTicks: 20, onSchedule: () => ticks++, onDone: () => (finished = true) });
  await new Promise((r) => setTimeout(r, 100));
  m.stop();
  const atStop = ticks;
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(ticks, atStop);
  assert.equal(finished, false);
});
