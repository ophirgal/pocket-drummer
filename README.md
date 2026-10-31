# Pocket Pro

A drum practice app that helps drummers hone their sense of time, groove and pocket. You play a rudiment on a practice pad along with the app's click. The app listens through the microphone, detects each hit, and tells you whether you were rushing or dragging. It also scores how much of your playing was "in the pocket" and tracks your progress over time.

This is an MVP built with React Native + Expo (SDK 58), with audio handled by [React Native Audio API](https://docs.swmansion.com/react-native-audio-api/). It's based on the *App Description* doc and the screen mockups in the project's Drive folder.

## What's in the MVP

- **Drum Pad mode.** Practise a rudiment, fill or groove along with a click. The test starts with a one-bar count-in, then records for 30 s, 1 min or 2 min. During the test you see a live waveform and a timer. Drum Set mode is shown as "coming soon".
- **Sample-accurate click.** Every click is scheduled ahead of time on the audio engine's own clock, so it never wobbles with the JavaScript thread.
- **Made for headphones, recorded by the phone.** With headphones on, the click stays out of the recording. The phone's own microphone listens to the pad by default, not a headset mic. You can choose another mic in Settings (iOS).
- **Beat detection.** Microphone audio streams in live and is reduced to a 0.5 ms envelope. After the test, the app finds hit onsets in that envelope and matches each hit to the nearest note of the pattern.
- **Result screen.**
  - The headline is a % "In the Pocket" score: the share of notes played within the pocket.
  - Below it is the verdict, Whiplash-style: *"Were you rushing or were you dragging?"*
  - It shows the split between Rushing, Dragging and On time.
  - An **AI Coach** report says what to work on: which strokes come in early or late, imbalance between hands, rushing or dragging in the second half, tempo drift, and consistency.
- **Detailed view.**
  - The pattern is drawn in drum notation with R/L sticking. Each note is coloured by how it landed (on time, rushed or dragged) and labelled with its average offset.
  - **Your playing on the grid:** the recording's waveform is drawn over the bar, beat and subdivision lines, under the notes you were meant to play. Each note links to where you actually played it, coloured by how it landed. Zoom in on single strokes or out to the whole test.
  - A per-hit timeline shows each note's offset against the pocket band.
- **Pocket width setting** (±10–50 ms, default ±20 ms). You can change it in Settings or live on the detailed view; the score is recalculated as you drag.
- **Progress.** Shows your average score with the change versus the previous 7 days, total tests, best score, time practised, and recent sessions. Tap a session to open its detailed view.
- **Library.** Has 10 rudiments, fills and grooves (Single Stroke, Paradiddle, Double Stroke, Flam Accent, Moeller, Bossa Nova and more). You can search, filter, and preview the pattern before you play it.
- **Freemium.**
  - Free gets 4 exercises and 3 tests a day.
  - Premium unlocks the full library and unlimited tests.
  - Payments aren't wired up yet, so **Profile → Premium demo mode** unlocks everything for testing. "My Grooves" (creating your own) is marked coming soon.

## Run it locally

You need Node.js 20+. The audio engine is a native module that **Expo Go doesn't include**, so the app runs as a [development build](https://docs.expo.dev/develop/development-builds/introduction/).

```bash
git clone https://github.com/ophirgal/pocket-drummer.git
cd pocket-drummer
npm install

# Build and install the dev client on a device or simulator (needs Xcode / Android Studio)
npx expo run:ios      # or: npx expo run:android
# ...or build it in the cloud and install it from the link
npx eas-cli@latest build --profile development --platform ios   # or android

npx expo start        # then open the dev build
```

You only need to rebuild when native dependencies change; JavaScript changes reload as usual. Simulators can't hear a real pad, so switch to tap mode there. The web version (`npx expo start --web`) works too, using the browser's microphone.

### Getting good results

1. **Wear headphones** (wired or Bluetooth) so the click stays out of the recording. Allow microphone access when asked, and put the phone near your pad.
2. The **phone's own microphone** records by default, even with a headset plugged in. On iOS you can pick another mic under **Settings → Hit Detection → Microphone**. Android doesn't let the app choose: Bluetooth headphones keep the phone's mic, but a wired headset's mic takes over while it's plugged in, so prefer headphones without a mic there.
3. Run **Settings → Calibrate latency** once for each pair of headphones. Bluetooth adds 100–250 ms of delay that the app can't hear, and the correction is saved per headphone.
4. **Don't play during the count-in bar.** The app uses it to measure the room noise.
5. Without headphones, the click through the speaker is picked up during the count-in, and the audio delay is measured from it automatically.
6. If soft strokes are missed, raise **Mic sensitivity**. If noise counts as hits, lower it.
7. No pad handy? Set **Input → Tap screen** and tap the pattern on the screen instead.

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
| `src/audio/useTestSession.ts` | Runs a test: count-in, click and recording, then hands everything to the scorer |
| `src/audio/engine.ts` | The shared `AudioContext` with the click and pad sounds; plays a sound at an exact time on the audio clock |
| `src/audio/metronome.ts` | Look-ahead scheduler: a 25 ms JS timer queues each click ~150 ms ahead at its exact audio-clock time |
| `src/audio/recorder.ts` / `.web.ts` | Live mic PCM: `AudioRecorder` on iOS/Android (10 ms chunks stamped by sample position), the Web Audio API in the browser |
| `src/audio/devices.ts` | Audio session, microphone choice (phone mic by default) and output detection (speaker, wired, Bluetooth) |
| `src/lib/clockSync.ts` | Maps mic-stream time and touch time onto the audio clock |
| `src/lib/scoring.ts` | Scores a finished test: hit detection, latency correction, matching, and the stored recording |
| `src/lib/onset.ts` | High-pass filter, 0.5 ms peak envelope, and threshold-crossing onset detection with refractory period and attack back-off |
| `src/lib/analysis.ts` | Matches hits to notes, classifies each one against the pocket, and computes per-hand, per-stroke, half-by-half and tempo-drift stats |
| `src/lib/coach.ts` | Writes the on-device coaching report. `src/lib/aiCoach.ts` is the optional Claude version |
| `src/lib/exercises.ts` | The library: each exercise is one bar on a step grid with sticking, accents and flams |
| `src/components/GridWaveform.tsx` | The recording drawn over the beat grid with the intended notes and detected hits |
| `src/app/` | Screens (Expo Router) |

Everything is measured on the audio clock, the one the clicks are scheduled on. The microphone and the touch screen run on other clocks, so `ClockSync` lines them up through `performance.now()`. It uses the earliest-arriving mic buffer and the latest audio-clock reading, both refined over the whole test. What's left is the fixed delay of the output (headphones) and the input. That comes from calibration for the current output, or, through a speaker, from the click's own echo in the count-in.

## Known MVP limits

- On Android the microphone can't be chosen yet: React Native Audio API's `setInputDevice` is a no-op there, so a wired headset's mic is used while one is plugged in.
- Through a speaker (no headphones), a stroke landing a few ms after a click blends with the click's echo and can be read up to ~8 ms early.
- Headphone latency can't be measured automatically, because the mic can't hear the click. Each pair needs a one-time calibration.
- Hit detection is tuned for a practice pad in a quiet room. A full drum kit needs per-drum detection, which is the planned Drum Set mode.
- Accounts, cloud sync, payments and "My Grooves" aren't built yet.
