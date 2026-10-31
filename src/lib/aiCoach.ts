/**
 * Optional: have Claude write the coaching report.
 *
 * Only used when EXPO_PUBLIC_ANTHROPIC_API_KEY is set (see README). An EXPO_PUBLIC_
 * variable is bundled into the app, so this is for local prototyping only; a real
 * release should call Claude from a backend instead. Without a key, the app uses
 * the on-device report from coach.ts.
 */
import Anthropic from '@anthropic-ai/sdk';
import { classShares, playedTempo, type Analysis } from './analysis';
import type { Exercise } from './exercises';

const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

export const aiCoachAvailable = !!apiKey;

/**
 * Sends a summary of the test's statistics to Claude and returns its coaching
 * text, or null when there's no key, the request fails, or it's refused.
 */
export async function fetchAiReport(a: Analysis, ex: Exercise, bpm: number): Promise<string | null> {
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const shares = classShares(a);
  const stats = {
    exercise: ex.name,
    subdivision: ex.stepsPerBeat,
    bpm,
    pocketWidthMs: a.pocketMs,
    inThePocketScore: a.pocketScore,
    notesExpected: a.expected,
    notesDetected: a.hits,
    percentRushed: shares.rushed,
    percentDragged: shares.dragged,
    percentOnTime: shares.onTime,
    meanOffsetMs: Math.round(a.meanOffset),
    spreadMs: Math.round(a.spread),
    firstHalfMeanMs: a.firstHalfMean === null ? null : Math.round(a.firstHalfMean),
    secondHalfMeanMs: a.secondHalfMean === null ? null : Math.round(a.secondHalfMean),
    rightHandMeanMs: a.handMean.R === null ? null : Math.round(a.handMean.R),
    leftHandMeanMs: a.handMean.L === null ? null : Math.round(a.handMean.L),
    meanOffsetPerNoteOfPattern: a.stepMean.map((m) => (m === null ? null : Math.round(m))),
    sticking: ex.bar.map((n) => n?.hand ?? '-').join(''),
    playedTempo: playedTempo(a, bpm)?.toFixed(1) ?? null,
  };
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system:
        'You are a warm, expert drum teacher inside a practice app. Negative offsets mean early (rushing), positive mean late (dragging). Write 2 to 4 short sentences of plain text, no markdown: what the timing shows and the one or two most useful things to practise next. Be specific about which strokes or hands, and encouraging.',
      messages: [{ role: 'user', content: `Timing results from my practice test:\n${JSON.stringify(stats)}` }],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
