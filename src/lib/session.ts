import { summarize, type Analysis, type NoteResult } from './analysis';
import { exerciseById, type Exercise } from './exercises';
import type { SessionResult } from '@/state/store';

/** Rebuild the full analysis of a stored session, scored with the given pocket width. */
export function analysisOf(r: SessionResult, pocketMs: number): { exercise: Exercise; analysis: Analysis } | null {
  const exercise = exerciseById(r.exerciseId);
  if (!exercise) return null;
  const stepMs = 60000 / r.bpm / exercise.stepsPerBeat;
  const notesPerBar = exercise.bar.filter(Boolean).length;
  const notes: NoteResult[] = r.offsets.map((offset, i) => {
    const bar = Math.floor(i / notesPerBar);
    const k = i % notesPerBar;
    let seen = -1;
    let step = 0;
    for (let s = 0; s < exercise.bar.length; s++) {
      if (exercise.bar[s] && ++seen === k) {
        step = s;
        break;
      }
    }
    return {
      step,
      bar,
      hand: exercise.bar[step]!.hand,
      time: (bar * exercise.bar.length + step) * stepMs,
      offset,
    };
  });
  return { exercise, analysis: summarize(notes, pocketMs, exercise.bar.length, r.extraHits) };
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  const m = Math.round(sec / 60);
  return `${m} min`;
}
