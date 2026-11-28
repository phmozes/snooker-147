# Report: the miss sound (owner's pick B) in the game (2026-11-27)

## In short
The crowd "oh" (miss-B) now plays once after every failed shot, at the moment the failure is clear on screen, never
earlier. Volume 0.7 (`CONFIG.sound.uiSounds.missVolume`). Dev panel: a MISS button. Sound only: outcomes and ball
paths are unchanged (replay check identical).

## When it plays
The rule is in `src/game/tableSounds.ts` `missMoment()`. It runs on the playback clock (shot time), so the
pocket-camera slow motion delays it the same way as every other sound.

| Failure (the label really played) | When the miss sound starts | Live check (dev server, scripts/miss-sound-check.mjs) |
|---|---|---|
| plain miss | when all balls have stopped (end of the recording) | 30+ shots, with and without the pocket cam: at the playback end (measured 7-32 ms before the end is detected; the end is found by polling every drawn frame, so up to 2 frames late) |
| wrong ball first / foul | same: all balls stopped | 4 real ones (1 in the pocket cam) + many fallbacks (see below): same result |
| snookered (step-1 escape fails) | same: all balls stopped | unit test only (step 1 cannot be forced to this) |
| jaw rattle | when the target ball comes to rest for good outside the pocket (never before its last rattle) | 10 shots over 3 runs, 5 of them with a pocket-cam cut (slow motion): every time after the target's last rattle sound (217-1766 ms after it) and before the playback end (7-1234 ms). One rattle was so soft it made no jaw sound; that miss also came before the end. |
| in-off | when the cue ball is seen dropping: the same moment as the cue ball's pocket sound (last task's visible-drop timing) | 9 real in-offs (1 with a pocket-cam cut): from 26 ms before to 3 ms after the drawn cue ball's centre went below the cloth (one frame = 16.7 ms; one slow headless frame gave the 26). In the last run (4 in-offs) also checked against the cue ball's pocket sound: 0.0-0.1 ms after it, i.e. in the same frame. |

- **Fallbacks:** if the solver cannot find the failure it was asked for, it plays a plain miss or a foul. The round's
  history still shows the asked failure; the real one is in the round's end. The miss sound uses the real label
  (I found this during the live check: a forced in-off that became a plain miss). Many forced in-offs and
  wrong-ball-first shots fell back this way. Each still got exactly one miss sound, at the plain-miss moment.
- **Never:** on the opponent's break-off (checked live before every test round), on a success, on a cash out, on a
  RE-RACK, in a free replay by round code (live: a failed round got 1 miss sound; the free replay of the same round
  code got 0), in a dev jump (no playback). **Mute** stops it (live: muted, no miss sound).
- If the moment falls after the recording's end (an in-off at the very end), the playback runs on until it is heard.

## What changed
- `public/sounds/miss.mp3` = `mockups/miss/miss-B.mp3` (18,808 bytes, 1.5 s). `docs/ASSETS.md`: new section with the
  source (https://freesound.org/people/mrrap4food/sounds/619007/), the author (mrrap4food) and the licence (CC0 1.0).
- `src/config/game.config.ts`: `sound.uiSounds.missVolume: 0.7`.
- `src/game/tableSounds.ts`: the `miss` sound, `playMiss()`, `missMoment()`.
- `src/game/gamePage.ts`: the shot playback plays the miss at `missMoment` (step 1 and every later SHOOT shot);
  `missFor()` decides whether there is one (failure only, not free, real label); the dev panel's APPLAUSE / MISS
  section has a MISS button.
- New: `tests/missSound.test.ts` (4 tests), `scripts/miss-sound-check.mjs` (live check).

## Tests and checks
- **Replay check** (bench/camera-replay.test.ts, every outcome and every ball path frame by frame), run on the old
  code and on the new code: **identical** (bench/results/miss-sound/replay-before.txt = replay-after.txt, also equal
  to the last task's replay-after.txt).
- `npm test` (tests/ only): **33 files, 321 tests passed** (108 s). Output: bench/results/miss-sound/npm-test.txt.
- Live check: the final runs ended with `MISS SOUND CHECK OK`. The earlier runs had failures, and they were the
  script's fault, not the game's: it judged shots by the asked label instead of the real one, it had no case for a
  rattle too soft to make a sound, and it allowed only one frame of delay for finding the playback end. No page errors.
- No soak ran, so there is no *-failures.txt line to list.

## Builds
`npm run build` (dist/, production) and `npm run build:test` (dist-test/, dev menu, no PC posting): both OK.
The dev logs are not in the production build (0 matches). Full lists: bench/results/miss-sound/build-files.txt.

| dist/ (production) | bytes | dist-test/ | bytes |
|---|---|---|---|
| assets/index-xW3gUeMq.js | 698,066 | assets/index-DYa7vNDm.js | 712,142 |
| assets/solverWorker-BwuWRXjn.js | 49,844 | assets/solverWorker-BwuWRXjn.js | 49,844 |
| index.html | 10,860 | index.html | 11,057 |
| breaks/reds6.json | 489,861 | breaks/reds6.json | 489,861 |
| breaks/reds10.json | 589,119 | breaks/reds10.json | 589,119 |
| breaks/reds15.json | 712,742 | breaks/reds15.json | 712,742 |
| breaks-v3/reds6.json | 488,825 | breaks-v3/reds6.json | 488,825 |
| breaks-v3/reds10.json | 589,812 | breaks-v3/reds10.json | 589,812 |
| breaks-v3/reds15.json | 712,882 | breaks-v3/reds15.json | 712,882 |
| sounds/applause-1..6.mp3 | 18,808 / 27,271 / 36,675 / 46,393 / 60,813 / 72,724 | same | same |
| sounds/ball-hard, ball-soft, break, cue, cushion | 4,075 / 2,507 / 21,359 / 5,015 / 2,194 | same | same |
| sounds/miss.mp3 (new) | 18,808 | sounds/miss.mp3 | 18,808 |
| sounds/pocket, tap | 13,165 / 1,924 | same | same |
| **total, 23 files** | **4,673,742** | **total, 23 files** | **4,688,015** |

## Owner's turn
- On the phone: miss a shot (or dev menu > APPLAUSE / MISS > MISS) and check the volume (0.7) and the moment.
- The hosted demo is still not republished (publishing = your word).
