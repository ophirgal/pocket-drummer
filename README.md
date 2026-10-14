# Pocket Pro

A drum practice app that helps drummers hone their sense of time, groove and pocket. You play a rudiment on a practice pad along with the app's click. The app listens through the microphone, detects each hit, and tells you whether you were rushing or dragging. It also scores how much of your playing was "in the pocket" and tracks your progress over time.

This is an MVP built with React Native + Expo (SDK 57). It's based on the *App Description* doc and the screen mockups in the project's Drive folder.

## What's in the MVP

- **Drum Pad mode.** Practise a rudiment, fill or groove along with a click. The test starts with a one-bar count-in, then records for 30 s, 1 min or 2 min. During the test you see a live waveform and a timer. Drum Set mode is shown as "coming soon".
- **Beat detection.** Microphone audio streams in live and is reduced to a 0.5 ms envelope. After the test, the app finds hit onsets in that envelope and matches each hit to the nearest note of the pattern.
- **Result screen.**
  - The headline is a % "In the Pocket" score: the share of notes played within the pocket.
  - Below it is the verdict, Whiplash-style: *"Were you rushing or were you dragging?"*
  - It shows the split between Rushing, Dragging and On time.
  - An **AI Coach** report says what to work on: which strokes come in early or late, imbalance between hands, rushing or dragging in the second half, tempo drift, and consistency.
- **Detailed view.**
  - The pattern is drawn in drum notation with R/L sticking. Each note is coloured by how it landed (on time, rushed or dragged) and labelled with its average offset.
  - A per-hit timeline shows the pocket band, and the waveform is marked with every detected hit.
- **Pocket width setting** (±10–50 ms, default ±20 ms). You can change it in Settings or live on the detailed view; the score is recalculated as you drag.
- **Progress.** Shows your average score with the change versus the previous 7 days, total tests, best score, time practised, and recent sessions. Tap a session to open its detailed view.
- **Library.** Has 10 rudiments, fills and grooves (Single Stroke, Paradiddle, Double Stroke, Flam Accent, Moeller, Bossa Nova and more). You can search, filter, and preview the pattern before you play it.
- **Freemium.**
  - Free gets 4 exercises and 3 tests a day.
  - Premium unlocks the full library and unlimited tests.
  - Payments aren't wired up yet, so **Profile → Premium demo mode** unlocks everything for testing. "My Grooves" (creating your own) is marked coming soon.

## Run it locally

You need Node.js 20+ and the **Expo Go** app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)).

```bash
git clone https://github.com/ophirgal/pocket-drummer.git
cd pocket-drummer
npm install
npx expo start
```

Scan the QR code with your phone's camera (iOS) or with Expo Go (Android). Your phone and computer need to be on the same Wi‑Fi; if they can't see each other, use `npx expo start --tunnel`. You can also press `i` or `a` to open a simulator. Simulators can't hear a real pad, so switch to tap mode there.

### Getting good results

1. Allow microphone access when asked, and put the phone near your pad.
2. **Don't play during the count-in bar.** The app uses it to measure the room noise and the click.
3. If the click plays through the phone speaker, the app hears it during the count-in. It uses that to measure and correct the audio delay automatically.
4. With headphones, especially Bluetooth, run **Settings → Calibrate latency** once.
5. If soft strokes are missed, raise **Mic sensitivity**. If noise counts as hits, lower it.
6. No pad handy? Set **Input → Tap screen** and tap the pattern on the screen instead.

### Optional: AI Coach with Claude

By default the coach report is generated on the device from your timing data. To have Claude write it instead, create a `.env` file:

```bash
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
```

Then restart `npx expo start`. Anything prefixed `EXPO_PUBLIC_` is bundled into the app, so only do this for local testing. A production build should call Claude from a backend.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm test` | Unit tests for beat detection, scoring and coaching (synthetic audio) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Expo config) |

## How it works

| File | Role |
| --- | --- |
| `src/audio/useTestSession.ts` | Runs a test: mic stream + click + count-in, then detection, latency correction and scoring |
| `src/audio/micStream.ts` / `.web.ts` | Live mic PCM: `expo-audio`'s `AudioStream` on iOS/Android, the Web Audio API in the browser |
| `src/audio/clock.ts` | Drift-free click scheduler: each tick is timed from the start (`start + n × interval`), so timer jitter never builds up |
| `src/lib/onset.ts` | High-pass filter, 0.5 ms peak envelope, and threshold-crossing onset detection with refractory period and attack back-off |
| `src/lib/analysis.ts` | Matches hits to notes, classifies each one against the pocket, and computes per-hand, per-stroke, half-by-half and tempo-drift stats |
| `src/lib/coach.ts` | Writes the on-device coaching report. `src/lib/aiCoach.ts` is the optional Claude version |
| `src/lib/exercises.ts` | The library: each exercise is one bar on a step grid with sticking, accents and flams |
| `src/app/` | Screens (Expo Router) |

The clock and the microphone run on different clocks, so they have to be lined up. Each mic buffer's sample count is mapped to `performance.now()` using the earliest-arriving buffer. The count-in bar then measures the round-trip delay from the click's own echo, or the calibrated value is used instead.

## Known MVP limits

- The click is triggered from JavaScript timers. It's steady and doesn't drift, but single clicks can jitter by a few ms. Sample-accurate audio would need a native audio engine and a development build.
- Hit detection is tuned for a practice pad in a quiet room. A full drum kit needs per-drum detection, which is the planned Drum Set mode.
- Accounts, cloud sync, payments and "My Grooves" aren't built yet.
