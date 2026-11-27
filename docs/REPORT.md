# Report: the pocket-drop sound came before the ball was seen dropping (2026-11-27)

## In short
The drop sound played at the physics "pot" moment. On screen the ball is still drawn for up to one more frame and then
falls into the hole for about 0.09 s of shot time before it is seen going down. So the sound was about 0.1 s of shot
time early: hardly noticed at normal speed, but in slow motion (x0.35) that is about 0.3 s on screen, which is what the
owner heard on the phone. Now the sound (and the milestone applause) start when the drawn ball's centre reaches the
cloth, within one screen frame, at normal speed, in the pocket-camera cut and in the clearance replay. Sound only:
outcomes and ball paths are unchanged.

## How it was measured
"Seen dropping" = the first drawn frame where the falling ball's centre is below the cloth (half of the ball in the
hole). New dev-only logs: `window.__dropLog` (src/view/table3d.ts, that frame and the frame the fall starts) next to
the existing `window.__soundLog` (now with the ball's name). The script `scripts/drop-sound-check.mjs` plays the real
game on the dev server (forced successes; pocket camera forced to P1b; the dev "Clearance: last ball"; one round of
forced successes for the applause) and prints, per pot, sound time minus drop time. Minus = the sound is early.
Shot time = on-screen time x the playback speed (1, or 0.35 in the cut and the replay).

| case | before: sound vs drop | after: sound vs drop |
|---|---|---|
| normal speed (4 + 2 pots before, 5 + 1 after) | **-89 to -117 ms** on screen = shot time; one -304 ms (the last ball: see cause 3) | **-15 to +2 ms** |
| pocket-camera cut P1b, x0.35 (6 pots before, 6 after) | **-270 to -317 ms** on screen = -95 to -111 ms shot time | **+1 to +2 ms** on screen (0-1 ms shot time) |
| clearance replay, x0.35 (2 before, 4 after) | **-286 ms** on screen = -100 ms shot time (the other pairing was not usable) | **-16 to +2 ms** on screen |
| milestone applause (after only) | (same moment as the drop sound, so the same -0.1 s shot time) | applause-2 (break 50, in a cut) **+2 ms**, applause-3 (needs snookers) **+3 ms** |

One screen frame is 16.7 ms. At normal speed the sound is now up to one frame early, because the view starts the fall
on the first drawn frame after the ball is gone, which can be up to one frame later than the recording says.
Raw output: the "before" and "after" runs were printed in the session; the numbers above are copied from them.

## What caused it
1. The physics drops a ball the moment its centre is over the hole, and the sound played then (`e.t` of the pot event).
2. The drawn ball is still shown until the next recorded frame (0-17 ms later), then the view lets it fall:
   z = 1.4 x radius - g t²/2, so its centre reaches the cloth about 0.087 s later (ball drawn 1.4 x larger). Together:
   0.087-0.104 s of shot time, 0.25-0.30 s on screen at x0.35.
3. A pot at the very end of the recording (often the last ball): the playback ended right after the pot, and the
   ball's fall then continued at a different speed (the clearance replay's slow motion), so the gap grew to 0.3 s.
   With the new timing this case would have lost its sound, so the playback now runs on until it is heard.

## What changed
- `src/view/playback.ts`: new `dropSeenAt(rec, ball, drawnRadius, dropSeconds)` = time of the first recorded frame
  without the ball + the drawn fall to the cloth (at most dropSeconds). New `DROP_GRAVITY` (9.81), now also used by the
  drawn fall in table3d.ts, so the two can never drift apart.
- `src/game/tableSounds.ts`: `potHeardAt()` and `lastSoundAt()`; `playEventsBetween()` plays a pot at `potHeardAt`
  (new parameter: the drawn ball radius). The volume rule is unchanged.
- `src/game/gamePage.ts`: the shot playback and the clearance replay pass the drawn radius; the milestone applause
  (levels 2-4) uses `potHeardAt` of its pot, so it starts with the drop sound; the playback runs until the last pot is
  heard (at most about 0.1 s more, only when a ball drops at the very end of the shot).
- `src/view/table3d.ts`: dev-only `__dropLog` (not in the production build: checked, 0 matches in dist/assets).
- New: `tests/dropSound.test.ts` (3 tests), `scripts/drop-sound-check.mjs` (live check).
- Not changed: the physics, the rules, the solver, the recordings, the pocket-camera cut rule.

## Tests and checks
- **Replay check** (bench/camera-replay.test.ts, every outcome and every ball path frame by frame), run on the old code
  and on the new code: **identical** (bench/results/drop-sound/replay-before.txt = replay-after.txt, 103 lines).
- `npm test` (tests/ only): **32 files, 317 tests passed** (97 s). Output: bench/results/drop-sound/npm-test.txt.
- Live check (scripts/drop-sound-check.mjs): numbers in the table above; no page errors.
- No soak ran, so there is no *-failures.txt line to list.

## Builds
`npm run build` (dist/, production) and `npm run build:test` (dist-test/, dev menu, no PC posting): both OK.
Full lists also in bench/results/drop-sound/build-files.txt.

| dist/ (production) | bytes | dist-test/ | bytes |
|---|---|---|---|
| assets/index-BAT8puSf.js | 697,241 | assets/index-CzUoLdr5.js | 711,258 |
| assets/solverWorker-B34iVOky.js | 49,830 | assets/solverWorker-B34iVOky.js | 49,830 |
| index.html | 10,860 | index.html | 11,057 |
| breaks/reds6.json | 489,861 | breaks/reds6.json | 489,861 |
| breaks/reds10.json | 589,119 | breaks/reds10.json | 589,119 |
| breaks/reds15.json | 712,742 | breaks/reds15.json | 712,742 |
| breaks-v3/reds6.json | 488,825 | breaks-v3/reds6.json | 488,825 |
| breaks-v3/reds10.json | 589,812 | breaks-v3/reds10.json | 589,812 |
| breaks-v3/reds15.json | 712,882 | breaks-v3/reds15.json | 712,882 |
| sounds/ (13 mp3: applause-1..6, ball-hard, ball-soft, break, cue, cushion, pocket, tap) | 312,923 | sounds/ (same 13) | 312,923 |
| **total, 22 files** | **4,654,095** | **total, 22 files** | **4,668,309** |

## Owner's turn
- On the phone (menu > POCKET CAM ON NEXT SHOT, and menu > Clearance: last ball): does the drop sound now come with
  the ball going down? If you would rather hear it a little later (when the ball is fully in the hole), that is one
  number to change.
- The hosted demo is still not republished (publishing = your word).
