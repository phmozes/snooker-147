# Report: clearance replay (rest of PLAN 8.2, RULES B.6), 2026-11-27

## What was built
- **The replay:** when a round clears the table, the last pot plays from the main camera as before. Then the same
  recording plays once more from the pocket camera P1b of the pocket the last ball went into (mirrored and rotated
  for that pocket), in slow motion, with a small "REPLAY" tag at the top. After that comes the clearance message
  ("TOTAL CLEARANCE n" / "MAXIMUM n").
  - Nothing is solved or simulated again; the replay reuses the recording just played.
  - The replay window is 0.7 s of shot time before the ball reaches the pocket and 0.35 s after it (the drop).
    It is not cut short if the balls stop right after the pot, so the drop is always seen.
- **Tap to skip:** a tap during the replay ends it and the message comes up at once. A tap on the message closes it,
  as before. Each tap skips the part on screen; one tap does not skip both.
  - Taps inside the developer panel do not count.
- **No cut on the last ball:** the last step never gets an automatic pocket cut, for a success or a failure alike.
  If only a failure on the last ball could be cut, a cut would give away the miss (RULES B.6). With 0 on both sides
  the two cut rates stay equal at every step.
  - The developer "pocket cam on next shot" switch still works on the last ball.
  - Effect on the 1-in-6 average: one step per round (the last ball) now has no cut.
- **Dev panel button "Clearance: last ball"** (TEST PANEL, NEXT SHOT row; also `__dev.clearLast()`). It jumps to the
  last ball without animation, then plays the last ball on screen as a forced success: shot, replay, message.
  - In the test build and on the dev server only, not in production.
  - Files: src/game/gamePage.ts (clearanceReplay, devClearLast), src/view/pocketCam.ts (clearanceReplayWindow,
    no cut on the last step), src/config/game.config.ts (pocketCut.clearanceReplay).

## Config values (CONFIG.pocketCut.clearanceReplay)
| Value | Setting |
|---|---|
| view | P1b |
| secondsBeforeArrival | 0.7 (shot time) |
| secondsAfterArrival | 0.35 (shot time) |
| slowMotionScale | 0.35 (1.05 s of shot time = 3.0 s on screen) |
| maxSeconds | 3 (never longer on screen) |
| label | REPLAY |

## How to trigger it (phone, test build or dev server http://192.168.1.111:5181)
1. START a round and press SHOOT once (step 1).
2. Menu (☰) > TEST PANEL > **Clearance: last ball**.
3. It jumps to the last ball, plays it, then shows the replay and the message.

The old "Clearance" button still plays every shot on screen up to the clearance, so it ends with the same replay.

## Checks
- **Live game** (dev server, headless browser, phone size 390x844), no page errors:
  - 6 reds: replay on screen 2.98 s, message right after. Pictures: P1b view of the black dropping into the top-left
    corner with the REPLAY tag, then "TOTAL CLEARANCE 73".
  - 10 reds: replay 2.90 s, then the message.
  - Tap test: a tap during the replay removed it at once, and the message was showing 150 ms later.
- **Replay check** (bench/camera-replay.test.ts, 10 round codes, every outcome and ball path): **identical** to
  bench/results/pocketcam/replay-before.txt.
- **npm test:** 305 / 305 passed. New tests: no cut on the last ball at every level; the replay window sits around the
  arrival and is at most 3 s on screen.
  - While writing them, one older test had to change: it checked that step 36 can be cut at every level, but step 36
    is the last step of 15 reds and beyond the end of 6 and 10 reds.

## Soak failures
No soak ran in this task (none needed: visual only). Nothing new to list. The quick-soak failures from earlier are in
docs/reports/2026-11-27-24c22ca.md.

## Build files
`npm run build` (production, dist/). It contains the replay but not the dev button:

| File | Size |
|---|---|
| dist/assets/index-BGS2uRYQ.js | 676.4 kB |
| dist/assets/solverWorker-CiMzzEyv.js | 48.4 kB |
| dist/breaks/reds10.json | 575.3 kB |
| dist/breaks/reds15.json | 696.0 kB |
| dist/breaks/reds6.json | 478.4 kB |
| dist/breaks-v3/reds10.json | 576.0 kB |
| dist/breaks-v3/reds15.json | 696.2 kB |
| dist/breaks-v3/reds6.json | 477.4 kB |
| dist/index.html | 10.6 kB |
| total (9 files) | 4234.7 kB |

`npm run build:test` (dist-test/). It contains the replay and the "Clearance: last ball" button:

| File | Size |
|---|---|
| dist-test/assets/index-B2jYtnbG.js | 689.7 kB |
| dist-test/assets/solverWorker-CiMzzEyv.js | 48.4 kB |
| dist-test/breaks/reds10.json | 575.3 kB |
| dist-test/breaks/reds15.json | 696.0 kB |
| dist-test/breaks/reds6.json | 478.4 kB |
| dist-test/breaks-v3/reds10.json | 576.0 kB |
| dist-test/breaks-v3/reds15.json | 696.2 kB |
| dist-test/breaks-v3/reds6.json | 477.4 kB |
| dist-test/index.html | 10.8 kB |
| total (9 files) | 4248.2 kB |

## Push
Committed and pushed to origin/master (standing approval). Nothing was published; the hosted demo is unchanged.
