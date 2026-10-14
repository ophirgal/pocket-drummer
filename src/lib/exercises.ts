/**
 * The practice library. Each exercise is one bar of 4/4 on a step grid
 * (stepsPerBeat = 2 for 8ths, 3 for triplets, 4 for 16ths). Steps without a
 * note are rests. The bar repeats for the length of the test.
 */

export type Hand = 'R' | 'L';
export type Category = 'Rudiments' | 'Fills' | 'Grooves';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Note {
  hand: Hand;
  accent?: boolean;
  /** A flam: a quiet grace note just before the main stroke. Only the main stroke is scored. */
  flam?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  bpmRange: [number, number];
  defaultBpm: number;
  stepsPerBeat: 2 | 3 | 4;
  beatsPerBar: 4;
  /** One entry per step in the bar; null is a rest. */
  bar: (Note | null)[];
  free: boolean;
  description: string;
}

const n = (hand: Hand, extra: Partial<Note> = {}): Note => ({ hand, ...extra });
const seq = (sticking: string, accents: number[] = [], flams: number[] = []): (Note | null)[] =>
  sticking
    .split('')
    .map((c, i) =>
      c === '-' ? null : n(c as Hand, { accent: accents.includes(i) || undefined, flam: flams.includes(i) || undefined }),
    );

export const EXERCISES: Exercise[] = [
  {
    id: 'single-stroke-roll',
    name: 'Single Stroke Roll',
    category: 'Rudiments',
    difficulty: 'Beginner',
    bpmRange: [60, 180],
    defaultBpm: 100,
    stepsPerBeat: 2,
    beatsPerBar: 4,
    bar: seq('RLRLRLRL'),
    free: true,
    description: 'Alternating strokes, even and steady. The foundation of everything.',
  },
  {
    id: 'paradiddle',
    name: 'Paradiddle',
    category: 'Rudiments',
    difficulty: 'Beginner',
    bpmRange: [60, 160],
    defaultBpm: 80,
    stepsPerBeat: 4,
    beatsPerBar: 4,
    bar: seq('RLRRLRLLRLRRLRLL', [0, 4, 8, 12]),
    free: true,
    description: 'RLRR LRLL. Keep the doubles as even as the singles.',
  },
  {
    id: 'rock-backbeat',
    name: 'Rock Backbeat (pad)',
    category: 'Grooves',
    difficulty: 'Beginner',
    bpmRange: [70, 150],
    defaultBpm: 100,
    stepsPerBeat: 2,
    beatsPerBar: 4,
    bar: seq('RRRRRRRR', [2, 6]),
    free: true,
    description: 'Straight eighths with accents on 2 and 4, like a hi-hat with a backbeat.',
  },
  {
    id: 'sixteenth-fill',
    name: 'Sixteenth Note Fill',
    category: 'Fills',
    difficulty: 'Beginner',
    bpmRange: [60, 140],
    defaultBpm: 80,
    stepsPerBeat: 4,
    beatsPerBar: 4,
    bar: seq('RLRLRLRLRLRLRLRL', [0, 4, 8, 12]),
    free: true,
    description: 'A bar of sixteenths with accented downbeats. Do not rush into beat one.',
  },
  {
    id: 'double-stroke-roll',
    name: 'Double Stroke Roll',
    category: 'Rudiments',
    difficulty: 'Intermediate',
    bpmRange: [60, 160],
    defaultBpm: 75,
    stepsPerBeat: 4,
    beatsPerBar: 4,
    bar: seq('RRLLRRLLRRLLRRLL'),
    free: false,
    description: 'RRLL. The second stroke of each double tends to drag. Keep it on the grid.',
  },
  {
    id: 'flam-accent',
    name: 'Flam Accent',
    category: 'Rudiments',
    difficulty: 'Intermediate',
    bpmRange: [60, 160],
    defaultBpm: 80,
    stepsPerBeat: 3,
    beatsPerBar: 4,
    bar: seq('RLRLRLRLRLRL', [0, 3, 6, 9], [0, 3, 6, 9]),
    free: false,
    description: 'Triplets with a flam on each beat. Only the main stroke is scored.',
  },
  {
    id: 'paradiddle-diddle',
    name: 'Paradiddle-diddle',
    category: 'Rudiments',
    difficulty: 'Intermediate',
    bpmRange: [60, 150],
    defaultBpm: 80,
    stepsPerBeat: 3,
    beatsPerBar: 4,
    bar: seq('RLRRLLRLRRLL', [0, 6]),
    free: false,
    description: 'RLRRLL in triplets. Smooth doubles, no lurching.',
  },
  {
    id: 'moeller-triplets',
    name: 'Moeller Triplets',
    category: 'Rudiments',
    difficulty: 'Advanced',
    bpmRange: [60, 140],
    defaultBpm: 70,
    stepsPerBeat: 3,
    beatsPerBar: 4,
    bar: seq('RRRLLLRRRLLL', [0, 3, 6, 9]),
    free: false,
    description: 'Accent, tap, tap on each hand. Let the whip motion do the work.',
  },
  {
    id: 'triplet-fill',
    name: 'Triplet Fill',
    category: 'Fills',
    difficulty: 'Intermediate',
    bpmRange: [60, 140],
    defaultBpm: 80,
    stepsPerBeat: 3,
    beatsPerBar: 4,
    bar: seq('RLLRLLRLLRLL', [0, 3, 6, 9]),
    free: false,
    description: 'Triplets around the kit, played here on the pad. Land beat one on time.',
  },
  {
    id: 'bossa-nova',
    name: 'Bossa Nova Groove',
    category: 'Grooves',
    difficulty: 'Intermediate',
    bpmRange: [80, 140],
    defaultBpm: 100,
    stepsPerBeat: 4,
    beatsPerBar: 4,
    bar: seq('R--R--R---R-R---'),
    free: false,
    description: 'The bossa rim-click pattern on the pad. The off-beat notes are where people drift.',
  },
];

export const exerciseById = (id: string): Exercise | undefined => EXERCISES.find((e) => e.id === id);

export function subdivisionLabel(stepsPerBeat: number): string {
  return stepsPerBeat === 2 ? '8th notes' : stepsPerBeat === 3 ? 'Triplets' : '16th notes';
}

/** Today's challenge rotates through the free exercises by date. */
export function todaysChallenge(date = new Date()): Exercise {
  const free = EXERCISES.filter((e) => e.free && e.category === 'Rudiments');
  const day = Math.floor(date.getTime() / 86400000);
  return free[day % free.length];
}
