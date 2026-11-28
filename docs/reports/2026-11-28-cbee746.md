# Report: player's view camera, round 3: V1 and V2 follow the ball to the pocket (2026-11-28, fifth task)

**What this is.** A third options page: `mockups/player-cam3/index.html`, with 30 video clips. **The game is not
changed**, so no build was needed. Your answers from round 2 are used in every V clip: R2 (0.4 s glide back), the
hard-case fixes H1-H3, and V3 as fixed. PC (pocket cut first, then the 4-camera draw) is used for the time sums.

## The problem and the two follow options
In V1 and V2 the camera stayed low and looked forward, so on cut shots the pot happened off-screen. Now, after the hit,
V1 and V2 turn to the pocket the shot is played at:
- **F1 "turn"**: 0.1 s after the cue hits the cue ball, the camera turns in 0.8 s (smooth start and stop) to look at
  the planned pocket. It may slide up to 80 cm towards a spot on the line from the pocket through the target ball:
  behind that ball and at most 1.6 m from the pocket. If that spot would be in front of the ball, it is 25 cm to the
  side, so the ball never rolls under the lens. It keeps its height (V1 16 cm, V2 55 cm, or more where a fix lifted it).
  It zooms in so the view is about 80 cm wide at the pocket.
- **F2 "turn and lift"**: the same turn and slide, but it also rises to **30° above the cloth** (seen from the pocket)
  and comes to at most 1.5 m from the pocket.
- **Safe path** (the H2/H3 rules): the move is an arc around the moving look-at point. The steepest angle in all 30
  clips is 57.0°, the main camera's angle. The camera never slides further outside the cloth than where it held. Outside
  the cloth it stays at least 10 cm above the rail, and it never goes lower than its hold height. The ball behind the
  cue ball (H2) stays see-through until the turn is about one third done.
- Then **R2**: when the balls stop, a 0.4 s glide back to 57°, and SHOOT waits for it.

What the clips show:
- **F2** shows the drop clearly on every shot: you look down into the pocket from about 1.5 m. On the miss, you see
  the brown stop outside the middle pocket.
- **F1** shows the ball reaching the pocket too, but from low down. On a far pocket the ball is small: on the long red
  the camera is still 3.1 m from the pocket with V1, because the slide is only 80 cm. V2 F1 is better than V1 F1
  because it is higher (8-21° above the cloth instead of 3-13°).
- **My recommendation: F2 for both V1 and V2.**

## Fairness: exactly what the follow uses
The follow reads only the **planned shot**, as stored in the round history (`h.shot`):
1. `shot.target`: the ball the shot is played at
2. `shot.pocket`: the pocket
3. where that ball stands **before** the shot
4. that pocket's mouth point (`table.pockets[...].mouthMid`, fixed table geometry)
5. the cue ball's place and the planned cue direction (the hold, as in round 2)

It never reads the recorded roll of the balls, where they stop, or whether anything dropped. Its timing is fixed from
the hit (start 0.1 s, move 0.8 s), so a pot and a miss get the same kind of camera move. Only the balls show the result,
when they get to the pocket. The one thing that still depends on the roll is the moment of the glide back: when the
balls stop. That is the same as today.

Two points to know (from the solver code; nothing is changed):
- For a **pot**, the stored `pocket` is the pocket the ball really went into (`solver.ts`: the pocket of the pot
  event, otherwise the aimed one). For a **miss or rattle** (`solverFailure.ts`), it is the pocket the shot was aimed
  at. Either way it is the pocket of the shot that is played, and it is known before the shot is shown.
- **Open point for the build:** one failure fallback, the "soft foul" (wrong ball first, `solverFailure.ts` line
  ~183), stores the first pocket of the list as a placeholder. It is not a real aim. In the game, such a shot should
  get no follow (it keeps the hold, as round 2 did) or a different rule. A soft foul is visible as a foul at the first
  contact anyway, so this does not hint at a pot or a miss before the ball reaches a pocket. The miss shown here is a
  plain miss: it aims at a real pocket.

## Shots on the page (round reds15-v3-3191475780; 6 clips each: TODAY, V3, V1 F1, V1 F2, V2 F1, V2 F2)
| Shot | Step | Played at | Result |
|---|---|---|---|
| Thin cut on the brown | 33 | bottom right corner | potted |
| The same brown, forced miss (FAIL_STEP=33, plainMiss) | 33 | right middle | missed |
| H1 cue ball mid-table, yellow | 31 | bottom right corner | potted |
| H2 ball behind the cue ball | 15 | top left corner | potted |
| Long red | 27 | bottom right corner | potted |

The miss run is a second play of the same round with step 33 forced to a plain miss. The solver picks that miss's
own shot, so it is aimed at another pocket than the pot was.

## Extra seconds per shot
Measured as when SHOOT came back in each V clip, minus when it came back in TODAY for the same shot (30 frames a
second, so ±0.03 s):
| | Brown cut | H1 | H2 | Long red |
|---|---|---|---|---|
| V1 F1, V1 F2, V2 F1 | +0.43 | +0.43 | +0.40 | +0.43 |
| V2 F2 | +0.40 | +0.43 | +0.40 | +0.43 |

- **F1 and F2 add 0 s themselves.** The follow happens while the balls roll; the extra is only the R2 glide (0.4 s),
  the same as without the follow.
- V3 also showed +0.4 s in the mockup (it waits for the glide). In the game it would not wait: V3 is already at 57°
  when the balls stop.
- **PC + R2 average:** 1/6 of shots get a pocket cut × 1.9 s = 0.32 s. V1 and V2 are 2 × (5/6)/4 of shots × 0.4 s =
  0.17 s. V3 and TODAY add 0 s. That is **about +0.49 s per shot** (step 2 onwards), the same with F1 or F2.

## How it was made
- `scripts/player-cam3.mjs` (new, made from `player-cam2.mjs`) films the real round on the dev server (port 5181).
  It edits `table3d.ts` and `gamePage.ts` only inside the recording browser, as before. New in it:
  - the follow;
  - the planned target and pocket passed to the camera;
  - `FAIL_STEP` / `FAIL_KIND` to force the miss;
  - the filmed shot is keyed on the number of shots played. A miss leaves `round.step` as it was, so the old key
    missed it.
- `scripts/player-cam3-page.mjs` (new) builds the page and results.json.
- 12 runs, 4 at a time, 7 min 50 s. Page errors: none. Chrome processes left: 0.
- **phone-cost.jsonl:** 2324 lines before and after (unchanged). The recording does not send shot-cost lines (the
  edit from round 2). It also now blocks every request to `/__dev/cost` and `/__dev/weird`: 1 blocked per run (the
  PC-link check). Nothing was written to `docs/WEIRD-SHOTS.md`.
- Page check (headless Chrome, 390 px and 1200 px wide): 30 of 30 videos load at 390×844, none missing, no side scroll.
- Not run: `npm test` and `npm run build:test`, because no game file changed.

## Files (mockups/player-cam3/, 62 files, 2,778 KB in all, 1 KB = 1000 bytes)
| File | KB |
|---|---|
| index.html / results.json | 21.8 / 25.7 |
| cut-now, -V3, -V1F1, -V1F2, -V2F1, -V2F2 .mp4 | 35.1, 73.1, 85.3, 88.1, 80.4, 82.5 |
| miss-now, -V3, -V1F1, -V1F2, -V2F1, -V2F2 .mp4 | 30.4, 68.9, 73.2, 80.1, 68.8, 71.8 |
| h1-now, -V3, -V1F1, -V1F2, -V2F1, -V2F2 .mp4 | 30.0, 75.3, 77.1, 85.3, 74.0, 81.1 |
| h2-now, -V3, -V1F1, -V1F2, -V2F1, -V2F2 .mp4 | 31.2, 70.5, 68.9, 69.4, 72.4, 72.4 |
| long-now, -V3, -V1F1, -V1F2, -V2F1, -V2F2 .mp4 | 30.3, 76.6, 73.8, 87.5, 70.2, 84.5 |
| 30 posters (.jpg, the frame at 0.4 s) | 19.8 to 26.0 each, 662.3 in all |

Other files:
- `scripts/player-cam3.mjs` (22.1 KB) and `scripts/player-cam3-page.mjs` (11.2 KB), both new
- `docs/REPORT.md`; the old report moved to `docs/reports/2026-11-28-81538e8.md`
- `docs/NOW.md` (one line)

## Your turn (questions on the page)
1. Follow for V1 and V2: F1 (turn, stays low) or F2 (turn and lift to 30°)? My recommendation is F2.
2. Speed of the turn: 0.8 s as shown, faster, or slower?
3. Then: build it in the game (the draw PC + 4 cameras, R2, fixes, follow)?
