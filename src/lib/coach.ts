/**
 * Turns an Analysis into words: a headline for the mascot and a short coaching
 * report. This runs on the device; src/lib/aiCoach.ts can replace the report
 * with one written by Claude when an API key is configured.
 */
import { playedTempo, type Analysis } from './analysis';
import type { Exercise } from './exercises';

export interface CoachText {
  headline: string;
  summary: string;
  /** The Whiplash question, answered. */
  verdictLine: string;
  report: string;
}

const ms = (v: number) => `${Math.abs(Math.round(v))} ms`;
const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][n] ?? `${n + 1}th`;

/**
 * Rule-based coaching: picks a headline from the score, answers "rushing or
 * dragging?", and builds the report from whichever patterns stand out (overall
 * lean, problem strokes, hand imbalance, tempo drift, consistency, missed notes).
 */
export function coachFor(a: Analysis, ex: Exercise, bpm: number): CoachText {
  if (a.hits < Math.max(4, a.expected * 0.25)) {
    return {
      headline: "We couldn't hear you",
      summary: 'Only a few hits were picked up.',
      verdictLine: 'Were you rushing or were you dragging? Hard to say this time.',
      report:
        'Put the phone close to your pad, play a little harder, and check that the app has microphone access. If the click is coming through the speaker, headphones help a lot. You can also switch to tap mode in Settings.',
    };
  }

  const score = a.pocketScore;
  const headline =
    score >= 85 ? 'Locked in!' : score >= 70 ? 'Nice groove!' : score >= 50 ? 'Getting there' : 'Not quite my tempo';

  const verdictLine =
    a.verdict === 'pocket'
      ? 'Were you rushing or were you dragging? Neither. Right in the pocket.'
      : `Were you rushing or were you dragging? You were ${a.verdict}.`;

  const lean = a.verdict === 'pocket' ? 'mostly on time' : a.verdict === 'rushing' ? 'ahead of the beat' : 'behind the beat';
  let half = '';
  if (a.firstHalfMean !== null && a.secondHalfMean !== null && Math.abs(a.secondHalfMean - a.firstHalfMean) > 6) {
    const later = a.secondHalfMean < a.firstHalfMean ? 'rush' : 'drag';
    half = `, but you tend to ${later} a bit in the second half`;
  }
  const summary = `You're ${lean}${half}.`;

  const tips: string[] = [];

  // Overall tendency.
  if (a.verdict !== 'pocket') {
    tips.push(
      `On average you landed ${ms(a.meanOffset)} ${a.meanOffset < 0 ? 'early' : 'late'}.` +
        (a.meanOffset < 0
          ? ' Relax your hands and let the click pull you along instead of chasing it.'
          : ' Think of the click as the moment the stick hits, not the moment you start moving.'),
    );
  } else {
    tips.push(`Your average offset was only ${ms(a.meanOffset)}, so your internal clock is in good shape.`);
  }

  // Which notes of the pattern stand out.
  const worst = a.stepMean
    .map((m, step) => ({ m, step }))
    .filter((x): x is { m: number; step: number } => x.m !== null && Math.abs(x.m) > a.pocketMs)
    .sort((x, y) => Math.abs(y.m) - Math.abs(x.m))
    .slice(0, 2);
  if (worst.length && ex.stepsPerBeat > 1) {
    const labels = worst.map((w) => `${ordinal(w.step % ex.stepsPerBeat)} stroke of beat ${Math.floor(w.step / ex.stepsPerBeat) + 1}`);
    const dir = worst[0].m < 0 ? 'early' : 'late';
    tips.push(`Watch the ${labels.join(' and the ')}, which ${worst.length > 1 ? 'come' : 'comes'} in ${dir} most often.`);
  }

  // Hand balance.
  const { R, L } = a.handMean;
  if (R !== null && L !== null && Math.abs(R - L) > 8) {
    const slow = L > R ? 'left' : 'right';
    tips.push(`Your ${slow} hand sits ${ms(L - R)} behind the other. Try a few minutes of slow ${slow}-hand-lead strokes.`);
  }

  // Tempo drift.
  const played = playedTempo(a, bpm);
  if (played && Math.abs(played - bpm) >= 1.5) {
    tips.push(`Over the test you drifted to about ${played.toFixed(1)} BPM (${played > bpm ? '+' : ''}${(played - bpm).toFixed(1)}).`);
  }

  // Consistency.
  if (a.spread > a.pocketMs * 1.5) {
    tips.push(`Your hits scatter by about ±${ms(a.spread)}. Drop the tempo by 10 BPM and aim for even, relaxed strokes before speeding back up.`);
  } else if (score >= 85) {
    tips.push(`Next step: try ${Math.min(ex.bpmRange[1], bpm + 10)} BPM, or narrow your pocket width in Settings.`);
  }

  if (a.hits < a.expected * 0.8) {
    tips.push(`${a.expected - a.hits} notes weren't picked up. Play a little louder or move the phone closer to the pad.`);
  }

  return { headline, summary, verdictLine, report: tips.join(' ') };
}
