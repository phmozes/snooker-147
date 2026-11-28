# Report: player's view cameras built into the game (2026-11-28, sixth task)

**What this is.** Your decisions from round 3 are now in the real game: from step 2, each SHOOT shot gets the pocket
cut first (exactly as before). A shot without a pocket cut is shown with TODAY, V1, V2 or V3, 1 in 4 each. V1 and V2
use the follow F2 and the glide back R2. Every number is in `src/config/game.config.ts`, block `playerCam`, with a
master switch `enabled`. The rule is written in `docs/RULES.md` as **B.7**. Stopped here for your review.

## Checks
| Check | Result |
|---|---|
| `npm test` | **PASS**: 349/349 (37 files, 16 new tests in `tests/playerCam.test.ts`) |
| Replay check, v1-v4 codes (outcomes unchanged) | **PASS**: 916/916 identical (10 runs, all ended 13:00:01, before this report) |
| Pace: extra seconds per shot (target about +0.5, fail over +0.7) | **PASS**: +0.45 / +0.48 / +0.46 s (6 / 10 / 15 reds) compared with plain play |
| Pace: no shot over 3.5 s except the last resort | **FAIL** (if read strictly). Details below: mostly pocket-cut shots (today's rule); the new glide pushed 4 of 900 shots over 3.5 s |
| Clips from the test build: V1, V2, V3 on a pot and a miss | **PASS**: 6 clips + 18 stills, right camera on every clip, no page errors |
| Replay by code shows the same cameras | **PASS**: 4 codes, each replayed twice in the test build, same camera on every shot (42 shots) |
| Strip-frame check | **PASS**: 54/54 |
| No writes to `bench/results/phone-cost.jsonl` | **PASS**: 2324 lines before and after, same checksum; `docs/WEIRD-SHOTS.md` same checksum too |
| `npm run build`, `npm run build:test` | **PASS**: both built |

## How the camera is chosen (fairness points 1, 3 and 5)
- `pickPlayerCam(seed, step, rng)` reads one number from its **own stream** `playerCam` (round seed + step). That
  stream is not a game stream (outcome, break, failure type, solver …) and is not one of the pocket-camera streams.
  The code checks this and stops if it ever is.
- The function has **no outcome input at all**. In `onShoot` it is called first, before `nextOutcome(round)`.
  A test reads the game page's code and checks that order.
- Order per shot: (1) the pocket cut, exactly today's rule; (2) if there is no cut, the pick is shown.
  `CAMERA` in the dev menu can force a camera instead.
- Same round code = same cameras, because the pick depends only on seed and step. Tested in Node, and in the test build
  by replaying 4 codes twice each. Example `reds15-v3-1001`: 2:V2 3:V2 4:TODAY 5:V1 6:V1 7:V3 8:V2 9:POCKET 10:V2
  11:V3 12:V1 13:POCKET 14:V2 15:V1, the same on both replays.
- Step 1 and the opponent's break-off always use TODAY.

**Rates over 100,000 simulated shots per level** (`bench/results/2026-11-28/cams/rates-100k.txt`). These are real
rounds from the outcome stream: a failure ends the round. The pocket cut is today's rule. Whether a failure shot can
be cut at all is modelled with the share the calibration assumes, because there is no physics in this test.
| Level | Camera | Count | Rate (target) | Given success | Given failure | Difference |
|---|---|---|---|---|---|---|
| 6 reds | POCKET | 16,484 | 16.48% (16.53) | 14,367 = 16.57% | 2,117 = 15.95% | 0.61% |
| | TODAY | 20,792 | 20.79% (20.87) | 18,042 = 20.80% | 2,750 = 20.72% | 0.08% |
| | V1 | 20,794 | 20.79% (20.87) | 18,047 = 20.81% | 2,747 = 20.70% | 0.11% |
| | V2 | 21,029 | 21.03% (20.87) | 18,161 = 20.94% | 2,868 = 21.61% | 0.67% |
| | V3 | 20,901 | 20.90% (20.87) | 18,111 = 20.88% | 2,790 = 21.02% | 0.14% |
| 10 reds | POCKET | 16,541 | 16.54% (16.62) | 14,751 = 16.61% | 1,790 = 15.97% | 0.65% |
| | TODAY | 20,648 | 20.65% (20.85) | 18,353 = 20.67% | 2,295 = 20.47% | 0.20% |
| | V1 | 20,762 | 20.76% (20.85) | 18,430 = 20.76% | 2,332 = 20.80% | 0.04% |
| | V2 | 21,168 | 21.17% (20.85) | 18,744 = 21.11% | 2,424 = 21.62% | 0.51% |
| | V3 | 20,881 | 20.88% (20.85) | 18,510 = 20.85% | 2,371 = 21.15% | 0.30% |
| 15 reds | POCKET | 16,547 | 16.55% (16.65) | 14,995 = 16.63% | 1,552 = 15.82% | 0.80% |
| | TODAY | 20,764 | 20.76% (20.84) | 18,691 = 20.72% | 2,073 = 21.13% | 0.41% |
| | V1 | 20,693 | 20.69% (20.84) | 18,664 = 20.69% | 2,029 = 20.69% | 0.01% |
| | V2 | 21,072 | 21.07% (20.84) | 18,975 = 21.04% | 2,097 = 21.38% | 0.34% |
| | V3 | 20,924 | 20.92% (20.84) | 18,866 = 20.92% | 2,058 = 20.98% | 0.06% |

Every rate is within ±1% of its target, and every success/failure difference is under 1%. The pocket cut has the
biggest difference (0.6-0.8%). That is today's rule, which I did not change. One reason: a failure on the last ball
never gets a cut, and failures come at later steps more often. The rest is chance: there are only 10,000-13,000
failures per level, so about ±0.35% is normal noise.

## What the follow uses (fairness point 2 and the soft foul, point 3)
- The follow looks at the pocket the shot was **AIMED** at. The solver now stores that as `shot.aim` (ball + pocket)
  for: normal pots, doubles, and every miss, rattle, in-off and wrong-ball attempt. Before this, a pot stored the pocket
  the ball really went into. On a fluke, that would have turned the camera to the "surprise" pocket. The follow now
  never reads `shot.pocket` or `shot.target`.
- Shots with no aim (the **soft foul** and the **gentle tap** of RULES D.2, and a "spray" pot) use a rule from the
  layout and the planned cue direction only. Find the first ball on the cue ball's path. Then take the pocket whose
  direction from that ball is closest to that ball's line from the contact. If no ball is on the path, take the pocket
  closest to the cue ball's own line. The old placeholder (`topLeft`) is no longer used for the camera. This rule is in
  RULES B.7.
- **Every V1 / V2 shot follows**: there is no "skip" path in the code.
- The follow's input is exactly 4 things: `pocket` (aimed), `ball` (the target ball's place before the shot), `cue`
  (cue ball's place), `dir` (planned cue direction). Tests check:
  - the input has only these 4 fields;
  - adding roll data changes nothing: a fake "real" pocket and ball, a length, where the cue ball stopped, pot events;
  - `playerCam.ts` never imports the physics and never mentions frames, events, potted balls, the recording or its length.
- The move runs on a fixed clock from the hit: it starts 0.1 s after the hit and takes 0.8 s, for a pot and a miss alike.
- The only thing that depends on the roll is when the glide back starts: when the balls stop, as before.

## The cameras as built (all numbers in config `playerCam`)
- **V1** (eye level 16 cm, 50 cm behind the cue ball) and **V2** (55 cm high, 1.05 m behind): hold during the stroke.
  Then F2: turn and lift to 30° above the cloth, at most 1.5 m from the aimed pocket's mouth, zoomed so about 80 cm shows
  at the pocket.
- **V3**: the same hold as V1, then from the hit a 1.0 s arc up to the main camera (57°). When the balls stop it is
  already there, so there is no wait.
- **R2**: when the balls stop, a 0.4 s glide back to 57° (V1/V2; also V3 if the balls stop before its rise ends), then
  SHOOT.
- **H fixes**:
  - H1: the camera rises over the cue (9 cm above the cue's line), and outside the cloth stays 10 cm above the rail.
  - H2: a ball between the camera and the cue ball is drawn see-through (opacity 0.22) until the move is a third done.
  - H3: the move is an arc, never steeper than 57°, and never lower than the hold or 12 cm. Tested on every frame of
    300 random shots × 3 cameras.
  - The full cue is drawn in V1/V2/V3.
- **Dev menu** (test build and dev server only): **CAMERA: AUTO / TODAY / V1 / V2 / V3 / POCKET**. It stays on every
  shot until you change it. The red tag shows "DEV · CAMERA: V1". POCKET falls back to TODAY when the shot cannot be
  cut. The real game is always AUTO.

## Pace (300 real shots per level, real solver, `bench/cam-pace.test.ts`; `bench/results/2026-11-28/cams/pace-summary.txt`)
Shot time = the cue's stroke + the playback + the pocket-cut slow motion + the glide. Thinking time is not counted.
| | 6 reds | 10 reds | 15 reds |
|---|---|---|---|
| Extra s/shot, new vs plain (no camera extras) | **+0.45** | **+0.48** | **+0.46** |
| Of that: the pocket cut (as before) / the new glide | +0.27 / +0.18 | +0.30 / +0.19 | +0.27 / +0.19 |
| Shot time: average / median / 90% | 2.34 / 2.15 / 3.60 s | 2.41 / 2.25 / 3.62 s | 2.37 / 2.26 / 3.60 s |
| The same before this task: median / 90% | 1.92 / 3.59 s | 2.03 / 3.58 s | 2.00 / 3.56 s |
| Shots over 3.5 s | 38 | 34 | 35 |
| … of which pocket-cut shots | 32 | 32 | 28 |
| … pushed over 3.5 s only by the new glide | 1 | 1 | 2 |
| … last resort | 1 | 0 | 1 |

**Why "no shot over 3.5 s" fails on a strict reading:**
1. Most long shots are pocket-cut shots. The slow motion adds about 1.3-1.9 s, and you approved that on 2026-11-27.
2. A few shots are long on their own: the recording is over 3.25 s, or close to 3.5 s before any camera. You accepted
   failure shots over 3 s (SLOW-SHOTS.md D).
3. **The new glide pushed 4 of 900 shots (0.4%) from 3.0-3.5 s to 3.6-3.8 s.**

If you want the 3.5 s rule kept for the new cameras, one simple option is: when a shot is already over 3.1 s, use
TODAY's hard cut back instead of the 0.4 s glide. Your choice; I changed nothing there.

## Clips (test build, `bench/results/2026-11-28/cams/`)
Round `reds15-v3-3191475780`, step 7. The camera is forced from the dev menu; the miss is forced as a plain miss.
Filmed at 30 frames a second.
| Clip | Shown camera | Result | SHOOT back after | KB |
|---|---|---|---|---|
| V1-pot.mp4 | V1 | potted | 1.77 s | 70.7 |
| V1-miss.mp4 | V1 | plain miss | 2.87 s | 80.7 |
| V2-pot.mp4 | V2 | potted | 1.77 s | 69.6 |
| V2-miss.mp4 | V2 | plain miss | 2.90 s | 76.8 |
| V3-pot.mp4 | V3 | potted | 1.33 s (no glide) | 66.9 |
| V3-miss.mp4 | V3 | plain miss | 2.47 s | 71.6 |

There are three stills per clip: `-hold.jpg` (0.15 s), `-move.jpg` (0.7 s) and `-end.jpg`, 18 in all. The clips show
the dev tag and the "forced" note, because they come from the test build.

## Points to know
- The **pocket cut** itself still uses its old pocket rule: the stored pocket, which for a pot is where the ball
  really went. I left it unchanged because you said "pocket cut exactly as today". The cut starts 0.5 s before the ball
  arrives, so on a fluke it shows the real pocket only at that moment. If you want, it can use the aimed pocket too.
- The camera moves are shown on screen only. The replay check proves every shot and outcome is unchanged (916/916).
- The strip-frame check now accepts `BASE=<url>`. I ran it against the test build, which never sends anything to the PC.

## Files
New:
- `src/view/playerCam.ts` (12.4 KB): the pick, the aimed pocket, all camera poses
- `tests/playerCam.test.ts` (13.3 KB)
- `bench/cam-pace.test.ts` (3.8 KB)
- `scripts/cams-check.mjs` (7.6 KB)

Changed:
- `src/config/game.config.ts`: block `playerCam`
- `src/core/round.ts`: `playerCamDraw`
- `src/core/solver.ts`, `src/core/solverFailure.ts`: `aim` stored; no search change
- `src/view/table3d.ts`: see-through balls, camera pose without a resize, rail height
- `src/game/gamePage.ts`: the draw, the follow, the glide, dev CAMERA, `__dev.camera/camLog/solved`
- `scripts/strip-frame-check.mjs`: `BASE`
- `docs/RULES.md` (B.7), `docs/NOW.md`

Results are in `bench/results/2026-11-28/cams/` (2.4 MB). The old report moved to `docs/reports/2026-11-28-cbee746.md`.

**dist-test/** (test build, 24 files, 5,192.9 KB; 1 KB = 1000 bytes):
| File | KB |
|---|---|
| assets/index-CkAR38nr.js | 723.6 |
| assets/solverWorker-Bj_gPCSr.js | 50.7 |
| index.html | 11.8 |
| breaks/reds6, reds10, reds15 .json | 489.9, 589.1, 712.7 |
| breaks-v3/reds6, reds10, reds15 .json | 488.8, 589.8, 712.9 |
| breaks-v4/reds6.json | 491.9 |
| sounds: applause-1 … 6 .mp3 | 18.8, 27.3, 36.7, 46.4, 60.8, 72.7 |
| sounds: ball-hard, ball-soft, break, cue, cushion, miss, pocket, tap .mp3 | 4.1, 2.5, 21.4, 5.0, 2.2, 18.8, 13.2, 1.9 |

## Your turn
1. Phone check (test build or `http://192.168.1.111:5181`): menu > CAMERA > V1 / V2 / V3 / POCKET, then AUTO.
2. The 3.5 s point: is 4 shots in 900 going over because of the glide OK, or do you want "no glide after a long shot"?
3. Should the pocket cut also use the aimed pocket? (Today it uses where the ball really went.)
