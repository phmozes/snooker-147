# Report: player's view camera, round 2 (2026-11-28, fourth task)

**What this is.** A second options page: `mockups/player-cam2/index.html`, with 32 video clips. **The game is not
changed** and no build was needed. Your draw is the starting point: each shot gets one camera at random, 1 in 4 each:
TODAY (57°), V1, V2 or V3.

## 1. Real top bar and ladder in every clip
Every clip is now filmed **while the real round is played**, one round (reds15-v3-3191475780, 15 reds, every step
forced to success). Each wanted step is filmed at the moment it is really shot. So the top bar, the ladder and the step
count are the real ones for that shot, not step 0. A clip starts at SHOOT and ends 0.5 s after SHOOT comes back.

## 2. V3 rise fixed
- The old rise blended the camera's position and its look-at point in straight lines. On shot 3 this passes almost
  straight down at the cloth: **85.9°** steepest angle (measured).
- The new rise moves the look-at point in a straight line. The camera's angle above the cloth, its direction round
  the table and its distance are blended separately. The angle only grows from about 5° to 57°.
  **Steepest angle 57.0° in all 12 fixed V clips.**
- Shown on the 3 old shots (straight red step 7, thin cut on the brown step 33, long red step 27): TODAY, old V3,
  fixed V3.

## 3. Back to 57° before SHOOT
| | V1 / V2 shots | V3 shots |
|---|---|---|
| R1 instant cut when the balls stop | **0 s** extra | 0 s |
| R2 0.4 s glide, SHOOT waits for it | **+0.4 s** (measured +0.43 s for both V1 and V2; the extra 0.03 s is the 30-frame step) | 0 s in the game: V3 is already at 57° when the balls stop (its rise ends 1.0 s after the hit). The mockup still waited 0.43 s; the game would skip that wait. |

Only a V3 shot whose balls stop less than 1.0 s after the hit would need the cut or the glide.

## 4. Hard cases (all from the same round)
| Case | Step | What was wrong before | Fix inside the variant |
|---|---|---|---|
| H1 cue ball mid-table, cue over the cloth | 31 (yellow) | nothing seen; cue and camera fine | none needed |
| H2 a ball right behind the cue ball | 15 (red5 10 cm behind) | V1/V3: the cue (raised 23° over the red) runs through the lens and the red hides the cue ball | camera raised over the cue (16 → 34 cm in V1/V3, 55 → 58 cm in V2), the red drawn see-through while the camera holds |
| H3 cue ball 5 cm from a cushion | 30 (blue) | V1/V3: camera outside the table, the raised cue (17°) through the lens, rail in front | camera raised over the cue (16 → 28 cm); V2 was already fine (55 cm) |

The rules in the fixed variants:
- The camera is always at least 9 cm above the cue's centre line at its own spot.
- Outside the cloth, the camera stays at least 10 cm above the rail top.
- Balls between the camera and the cue ball are drawn see-through (22%) until the camera goes back.
- The cue is shown at full length.

They use only the layout and the planned cue direction, never the outcome. **No V camera ever falls back to TODAY.**

## 5. Pocket camera with the new draw (proposal, not built)
Rates are per 100 shots from step 2. A pocket cut adds about 1.9 s per cut. This comes from NOW.md: +0.32 s per shot
at 1 in 6 shots cut.
| Option | Pocket cuts | TODAY (no cut) | V1 / V2 / V3 | Extra s per shot, R1 / R2 |
|---|---|---|---|---|
| PA: pocket only on TODAY shots, today's chances | 4.2 | 20.8 | 25 / 25 / 25 | 0.08 / 0.28 |
| PB: only on TODAY, chances x1.34 (the most the miss chances allow) | 5.6 | 19.4 | 25 / 25 / 25 | 0.11 / 0.31 |
| PC: pocket cut first, as today (1 in 6), then the 4-camera draw | 16.7 | 20.8 | 20.8 each | 0.32 / 0.49 |

P(camera | success) = P(camera | failure) holds in all three:
- **PA and PB:** the camera draw ignores the outcome, and the pocket cut inside TODAY keeps its equal-rate calibration.
- **PC:** the pocket cut is equal for a pot and a miss, so what is left, (5/6)/4 per camera, is equal too.

Keeping 1 in 6 pocket cuts only on TODAY shots is impossible: the miss chances (0.51-0.75 now) would have to go
above 100%. In PC a V camera is used only on shots without a pocket cut, so it is not "drawn first". The rates are
still equal.

## How it was made
- `scripts/player-cam2.mjs` (new tool; it does not change the game) films the real round on the dev server (port
  5181). The dev server runs the same code as the test build. Only inside the recording browser, it edits `table3d.ts`
  (a camera hook and the cue angle) and `gamePage.ts` (it films the chosen steps, holds the R2 glide, and turns off the
  "forced" message and the shot-cost lines to the PC). Time runs frame by frame at 30 fps.
  `scripts/player-cam2-page.mjs` (new) builds the page and results.json from the runs.
- 7 runs, 4 then 3 at a time, about 10 minutes. Page errors: none. Chrome processes left: 0.
- Check: all 33 video tags on the page load (390×844); there is no side scroll at 390 px.
- Not run: `npm test` and the test build, because no game file changed.

## Cleaned up: phone-cost.jsonl
My recording runs (the previous task and the first runs of this one) had sent 321 "shot cost" lines from the headless
browser into `bench/results/phone-cost.jsonl`. They were written 08:38-09:10 UTC today, with only my round codes. I
removed exactly those lines; the file went from 2645 to 2324 lines. Older headless lines from other sessions and all
phone lines are untouched. A backup of the file before the cleanup is in my scratchpad. The file is still not
committed, as before. The recording script no longer sends these lines.

## Files (mockups/player-cam2/, 66 files, 2,332 KB in all, 1 KB = 1000 bytes)
| File | KB |
|---|---|
| index.html / results.json | 20.7 / 12.2 |
| s1-now, s1-V3old, s1-V3new, s1-V1-R1, s1-V1-R2 .mp4 | 28.8, 64.0, 62.8, 36.5, 53.9 |
| s2-now, s2-V3old, s2-V3new, s2-V2-R1, s2-V2-R2 .mp4 | 35.0, 75.7, 71.8, 38.1, 53.5 |
| s3-now, s3-V3old, s3-V3new, s3-V3-R2 .mp4 | 30.1, 65.9, 74.8, 76.5 |
| h1-now, h1-V1, h1-V2, h1-V3 .mp4 | 30.2, 38.5, 35.7, 74.7 |
| h2-now, h2-V1raw, h2-V1, h2-V2raw, h2-V2, h2-V3raw, h2-V3 .mp4 | 31.1, 44.1, 34.1, 38.4, 39.1, 73.7, 68.2 |
| h3-now, h3-V1raw, h3-V1, h3-V2raw, h3-V2, h3-V3raw, h3-V3 .mp4 | 28.0, 44.1, 34.5, 34.0, 33.0, 69.3, 61.7 |
| 32 posters (.jpg, the frame at 0.4 s) | 19.4 to 26.5 each, 718.5 in all |

Other files:
- `scripts/player-cam2.mjs` and `scripts/player-cam2-page.mjs` (new)
- `docs/REPORT.md`; the old report moved to `docs/reports/2026-11-28-163225f.md`
- `docs/NOW.md` (one line)

## Your turn (questions on the page)
1. Return: R1 (cut, 0 s) or R2 (glide, +0.4 s on V1/V2 shots)?
2. Are the hard-case fixes OK as shown?
3. Pocket camera: PA, PB or PC?
