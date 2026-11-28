# Report: player's view camera, options page (2026-11-28, third task)

**What this is.** An options page with short video clips: `mockups/player-cam/index.html`. **The game is not changed**
and no build was needed. You choose; I decided nothing.

## What you see on the page
- 3 real shots from one recorded round (**reds15-v3-3191475780**, 15 reds, played by the game with "force success"):
  1. **Straight red into a corner**: step 7, red into the top-left corner, cut 0.5°, potted 0.65 s after the hit.
  2. **Thin cut on a colour**: step 33, brown into the bottom-right corner, cut 75°, potted 1.42 s after the hit.
  3. **Long red down the table**: step 27, red 2.8 m from the bottom-right corner, cut 17°, potted 1.02 s after the hit.
- Each shot from 4 cameras, side by side, with a "play all 4 again together" button:
  | Camera | Height | Behind the cue ball | Angle / looks at | Lens | Extra s per shot |
  |---|---|---|---|---|---|
  | Today | fitted | fitted | 57° | 38° | 0 |
  | V1 eye level | 16 cm | 50 cm, on the shot line | 5° down, at a point 1.2 m ahead | 50° | 0 (holds) |
  | V2 over the shoulder | 55 cm | 1.05 m, on the shot line | 16° down, at a point 0.9 m ahead | 52° | 0 (holds) |
  | V3 eye level then rise | as V1 | as V1 | after the hit, rises to today's 57° in 1.0 s | 50° → 38° | 0 as recorded* |

  *V3: the rise runs while the balls roll. On a shot whose balls stop less than 1.0 s after the hit, it would need the
  rest of that 1.0 s more, or a faster rise.
- **Things I saw** (no decision): on the thin cut, V1 and V2 lose both balls to the side, so the pot is not seen.
  In V1/V2 the top of the picture is black (the empty room; there is no room behind the table yet).
- The 3 questions are on the page: which variant (V1/V2/V3/none); when (a) a player button, (b) random cuts (how
  often), (c) both; and the fixed rule for random use (same chance for a pot and a miss, decided before the shot,
  never shows the result, only one special camera per shot so it never clashes with the pocket camera).

## How it was made
- `scripts/player-cam.mjs` (new, a tool, not game code). It opens the game on the dev server (port 5181), which runs
  the same code as the test build. The recording browser gets edited copies of 2 files, only in that browser:
  `table3d.ts` calls a camera hook before each picture, `gamePage.ts` logs every shot and lets the script replay one.
  Time is stepped frame by frame (30 frames a second), so the clips are smooth on any PC.
  Video: H.264 MP4 (plays on iPhone and Android), made with the ffmpeg of the Python package imageio-ffmpeg.
- Command: `SEED=reds15-v3-3191475780 ROUNDS=1 node scripts/player-cam.mjs` (about 3 minutes).
- Check: in Chrome all 12 clips load as 390×844, 3.00 s; the page has no side scroll at 390 px wide.
  Page errors while recording: none (results.json "errors": []).
- Not done: tests (`npm test`) and the test build, because no game file changed.

## Files (mockups/player-cam/, 726 KB in all, 1 KB = 1000 bytes)
| File | Size |
|---|---|
| index.html | 8.4 KB |
| results.json | 3.8 KB |
| straight-now.mp4 / -V1 / -V2 / -V3 .mp4 | 27.1 / 28.8 / 25.6 / 67.5 KB |
| thin-now / -V1 / -V2 / -V3 .mp4 | 28.5 / 28.6 / 25.7 / 67.4 KB |
| long-now / -V1 / -V2 / -V3 .mp4 | 27.1 / 27.7 / 25.5 / 62.6 KB |
| 12 poster pictures (.jpg, the frame at 0.4 s) | 20.5 to 26.6 KB each, 272 KB in all |

Other files: `scripts/player-cam.mjs` (new), `docs/REPORT.md`, old report moved to `docs/reports/2026-11-28-433ab97.md`,
`docs/NOW.md` (one line).

## Your turn
Open `mockups/player-cam/index.html` and answer the 3 questions on the page.
