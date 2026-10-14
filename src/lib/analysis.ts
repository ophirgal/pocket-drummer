/**
 * Timing analysis: match detected hits to the notes of the exercise and work out
 * whether the drummer was rushing, dragging or in the pocket. All times are in
 * milliseconds on one clock.
 */
import type { Exercise, Hand } from './exercises';
import type { HitClass } from './theme';

export interface ExpectedNote {
  time: number;
  /** Index into the exercise bar (which note of the pattern this is). */
  step: number;
  bar: number;
  hand: Hand;
  flam: boolean;
}

export interface NoteResult {
  step: number;
  bar: number;
  hand: Hand;
  time: number;
  /** Signed offset: negative = early (rushing), positive = late (dragging). Null = missed. */
  offset: number | null;
}

export interface Analysis {
  notes: NoteResult[];
  pocketMs: number;
  expected: number;
  hits: number;
  extraHits: number;
  onTime: number;
  rushed: number;
  dragged: number;
  /** % of all expected notes played inside the pocket: the headline score. */
  pocketScore: number;
  meanOffset: number;
  spread: number;
  firstHalfMean: number | null;
  secondHalfMean: number | null;
  handMean: Record<Hand, number | null>;
  /** Mean offset per step of the pattern. */
  stepMean: (number | null)[];
  /** Slope of hit time against note time from a straight-line fit: above 1 means you slowed down. */
  tempoRatio: number | null;
  verdict: 'rushing' | 'dragging' | 'pocket';
}

export function buildExpectedNotes(ex: Exercise, bpm: number, startTime: number, bars: number): ExpectedNote[] {
  const stepMs = 60000 / bpm / ex.stepsPerBeat;
  const out: ExpectedNote[] = [];
  for (let b = 0; b < bars; b++) {
    ex.bar.forEach((note, step) => {
      if (!note) return;
      out.push({
        time: startTime + (b * ex.bar.length + step) * stepMs,
        step,
        bar: b,
        hand: note.hand,
        flam: !!note.flam,
      });
    });
  }
  return out;
}

export function classify(offset: number, pocketMs: number): HitClass {
  if (offset < -pocketMs) return 'rushed';
  if (offset > pocketMs) return 'dragged';
  return 'onTime';
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const meanOrNull = (xs: number[]) => (xs.length ? mean(xs) : null);

/**
 * Pair each hit with a note. Each hit may only belong to the note it is closest to
 * and only if it's within half the gap to the neighbouring notes; each note keeps
 * its closest hit. For flams, the later (main) stroke of a close pair is used.
 */
export function matchHits(hitTimes: number[], expected: ExpectedNote[]): { offsets: (number | null)[]; extra: number } {
  const offsets: (number | null)[] = expected.map(() => null);
  if (!expected.length) return { offsets, extra: hitTimes.length };
  const hits = [...hitTimes].sort((a, b) => a - b);
  let extra = 0;
  let j = 0;
  for (const h of hits) {
    while (j < expected.length - 1 && Math.abs(expected[j + 1].time - h) <= Math.abs(expected[j].time - h)) j++;
    const e = expected[j];
    const prevGap = j > 0 ? e.time - expected[j - 1].time : Infinity;
    const nextGap = j < expected.length - 1 ? expected[j + 1].time - e.time : Infinity;
    const window = Math.min(prevGap, nextGap, 400) / 2;
    const off = h - e.time;
    if (Math.abs(off) > window) {
      extra++;
      continue;
    }
    const cur = offsets[j];
    if (cur === null) offsets[j] = off;
    else if (e.flam && off > cur && off - cur < 60) offsets[j] = off; // grace note then main stroke
    else if (!e.flam && Math.abs(off) < Math.abs(cur)) {
      offsets[j] = off;
      extra++;
    } else extra++;
  }
  return { offsets, extra };
}

export function analyze(hitTimes: number[], expected: ExpectedNote[], pocketMs: number, barLength: number): Analysis {
  const { offsets, extra } = matchHits(hitTimes, expected);
  const notes: NoteResult[] = expected.map((e, i) => ({
    step: e.step,
    bar: e.bar,
    hand: e.hand,
    time: e.time,
    offset: offsets[i],
  }));
  return summarize(notes, pocketMs, barLength, extra);
}

/** Recompute every statistic from note offsets, e.g. after the pocket width changes. */
export function summarize(notes: NoteResult[], pocketMs: number, barLength: number, extraHits = 0): Analysis {
  const played = notes.filter((n): n is NoteResult & { offset: number } => n.offset !== null);
  const offs = played.map((n) => n.offset);
  let onTime = 0;
  let rushed = 0;
  let dragged = 0;
  for (const o of offs) {
    const c = classify(o, pocketMs);
    if (c === 'onTime') onTime++;
    else if (c === 'rushed') rushed++;
    else dragged++;
  }
  const m = mean(offs);
  const spread = offs.length > 1 ? Math.sqrt(mean(offs.map((o) => (o - m) ** 2))) : 0;

  const midTime = notes.length ? (notes[0].time + notes[notes.length - 1].time) / 2 : 0;
  const stepMean: (number | null)[] = Array.from({ length: barLength }, (_, s) =>
    meanOrNull(played.filter((n) => n.step === s).map((n) => n.offset)),
  );

  // Fit hit time against expected time; a slope above 1 means the player slowed down.
  let tempoRatio: number | null = null;
  if (played.length >= 8 && notes.length >= 2) {
    const xs = played.map((n) => n.time);
    const ys = played.map((n) => n.time + n.offset);
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    if (den > 0) tempoRatio = num / den;
  }

  const verdict: Analysis['verdict'] =
    Math.abs(m) <= pocketMs / 2 && onTime >= Math.max(rushed, dragged) ? 'pocket' : m < 0 ? 'rushing' : 'dragging';

  return {
    notes,
    pocketMs,
    expected: notes.length,
    hits: played.length,
    extraHits,
    onTime,
    rushed,
    dragged,
    pocketScore: notes.length ? Math.round((onTime / notes.length) * 100) : 0,
    meanOffset: m,
    spread,
    firstHalfMean: meanOrNull(played.filter((n) => n.time <= midTime).map((n) => n.offset)),
    secondHalfMean: meanOrNull(played.filter((n) => n.time > midTime).map((n) => n.offset)),
    handMean: {
      R: meanOrNull(played.filter((n) => n.hand === 'R').map((n) => n.offset)),
      L: meanOrNull(played.filter((n) => n.hand === 'L').map((n) => n.offset)),
    },
    stepMean,
    tempoRatio,
    verdict,
  };
}

/** Tempo actually played, given the target BPM. */
export function playedTempo(a: Analysis, bpm: number): number | null {
  return a.tempoRatio ? bpm / a.tempoRatio : null;
}

/** Share of played notes in each class, as whole percentages. */
export function classShares(a: Analysis): Record<HitClass, number> {
  const total = a.hits || 1;
  return {
    onTime: Math.round((a.onTime / total) * 100),
    rushed: Math.round((a.rushed / total) * 100),
    dragged: Math.round((a.dragged / total) * 100),
  };
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}
