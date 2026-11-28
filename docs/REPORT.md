# Report: player's view cameras, round 2 after your phone check (2026-11-28, seventh task)

**What this is.** You filmed 25 shots on the phone and found too many special cameras and some unpleasant moves. Changed:
fewer special cameras (TODAY 75%, V2 15%, V1 10%), V3 out of the draw, a new end view for middle pockets, and no glide
after a long shot. The pocket cut is unchanged. Every number is in `src/config/game.config.ts`, block `playerCam`.
RULES B.7 is updated. Stopped here for your review.

## Checks
| Check | Result |
|---|---|
| `npm test` | **PASS**: 352/352 (37 files; 3 new tests in `tests/playerCam.test.ts`) |
| Rates over 100,000 shots per level: within ±1% of the new targets | **PASS** (table below) |
| Success vs failure difference under 1% per camera | **PASS**: largest 0.80% (the pocket cut, today's rule); new cameras at most 0.74% |
| V3 never drawn | **PASS**: 0 of 300,000 shots |
| Replay check v1-v4 (outcomes unchanged) | **PASS**: 916/916 identical (10 runs, all ended 14:24:38, before this report) |
| Pace: no shot pushed over 3.5 s by the glide | **PASS**: 0 of 900 shots (the longest shot with a glide is 3.22 s) |
| Clips from the test build: V1 and V2, each to a corner and a middle pocket | **PASS**: 4 clips, right camera and right aimed pocket on each, no page errors |
| Strip-frame check | **PASS**: 54/54 |
| No writes to `bench/results/phone-cost.jsonl` | **PASS**: 2379 lines before and after, same checksum; `docs/WEIRD-SHOTS.md` same checksum |
| `npm run build`, `npm run build:test` | **PASS**: both built |

## What changed
1. **Fewer special cameras.** The pocket cut comes first, as before (about 1 shot in 6). On the other shots:
   TODAY 75%, V2 15%, V1 10% (`playerCam.shares`). The pick still comes from its own seeded stream and never reads the
   outcome.
2. **V3 is out.** Its weight is 0, so it is never drawn. The code stays: give it a weight in the config to bring it
   back. The dev menu can still force it (CAMERA: V3).
3. **Middle pockets.** When the AIMED pocket is a middle pocket, the follow now ends 50° above the cloth and 1.8 m from
   the pocket mouth. The camera stays over the cloth and looks a little onto the cloth (15 cm in front of the mouth),
   so you see the pocket and the cloth around it instead of a big empty hole (`follow.middle`). Corner pockets are
   unchanged. Every V1/V2 shot still follows, and it still uses only the aimed pocket, so fairness is unchanged.
4. **Long shots.** When the balls stop and the shot is already longer than 3.1 s (counted from the start of the cue's
   stroke), the camera cuts straight back to 57°, with no glide (`longShotSeconds`). So the glide can never take a shot
   past 3.5 s (3.1 + 0.4).
5. Dev only: the camera log now also records the aimed pocket, so the clip script can find middle-pocket shots.

## Rates over 100,000 shots per level (`bench/results/2026-11-28/cams2/rates-100k.txt`)
| Level | Camera | Rate (target) | Given success | Given failure | Difference |
|---|---|---|---|---|---|
| 6 reds | POCKET | 16.48% (16.53) | 16.57% | 15.95% | 0.61% |
| | TODAY | 62.61% (62.60) | 62.55% | 63.03% | 0.48% |
| | V2 | 12.57% (12.52) | 12.55% | 12.70% | 0.14% |
| | V1 | 8.33% (8.35) | 8.33% | 8.33% | 0.00% |
| 10 reds | POCKET | 16.54% (16.62) | 16.61% | 15.97% | 0.65% |
| | TODAY | 62.58% (62.54) | 62.54% | 62.89% | 0.35% |
| | V2 | 12.58% (12.51) | 12.55% | 12.84% | 0.29% |
| | V1 | 8.30% (8.34) | 8.30% | 8.30% | 0.01% |
| 15 reds | POCKET | 16.55% (16.65) | 16.63% | 15.82% | 0.80% |
| | TODAY | 62.53% (62.51) | 62.46% | 63.20% | 0.74% |
| | V2 | 12.62% (12.50) | 12.60% | 12.79% | 0.19% |
| | V1 | 8.30% (8.34) | 8.32% | 8.19% | 0.13% |

V3: 0 at every level. The targets are 75/15/10% of the shots without a pocket cut, which makes them 62.5/12.5/8.3%
of all shots.

## Pace (300 real shots per level, real solver; `bench/results/2026-11-28/cams2/pace-summary.txt`)
Shot time = the cue's stroke + the playback + the pocket-cut slow motion + the glide. Thinking time is not counted.
"Extra" = this shot's time minus the same shot with no camera extras.
| | 6 reds | 10 reds | 15 reds |
|---|---|---|---|
| Extra s/shot: average | **+0.34** (was +0.45) | **+0.36** (was +0.48) | **+0.35** (was +0.46) |
| … of that: pocket cut / glide | +0.27 / +0.06 | +0.30 / +0.07 | +0.27 / +0.08 |
| Extra s/shot: median / 90% | 0.00 / 1.86 | 0.00 / 1.86 | 0.00 / 1.86 |
| Shot time: average / median / 90% | 2.22 / 2.06 / 3.60 s | 2.29 / 2.10 / 3.63 s | 2.26 / 2.08 / 3.60 s |
| Shots over 3.5 s | 37 | 33 | 33 |
| … of which pocket cut / V1-V2 (long recording, no glide) / TODAY | 32 / 2 / 3 | 32 / 0 / 1 | 28 / 1 / 4 |
| **Pushed over 3.5 s by the glide** | **0** | **0** | **0** |
| V1/V2 shots where the glide was skipped (over 3.1 s) | 3 | 0 | 1 |

The median extra is 0 because most shots now use TODAY. The 90% figure is the pocket cut's slow motion (as before).
The shots still over 3.5 s are long on their own or are pocket cuts. You accepted both earlier.

## Clips (test build; `bench/results/2026-11-28/cams2/`)
Round `reds15-v3-3191475780`. Every step is forced to a pot. A scouting run read the aimed pocket of each step and
picked step 2 (aimed at topLeft, a corner) and step 19 (aimed at middleLeft). Filmed at 30 frames a second.
| Clip | Camera | Aimed pocket | SHOOT back after | KB |
|---|---|---|---|---|
| V1-corner.mp4 | V1 | topLeft | 2.13 s | 78.8 |
| V1-middle.mp4 | V1 | middleLeft | 2.67 s | 89.6 |
| V2-corner.mp4 | V2 | topLeft | 2.13 s | 74.1 |
| V2-middle.mp4 | V2 | middleLeft | 2.67 s | 84.5 |

There are four stills per clip: `-hold` (0.15 s), `-move` (0.7 s), `-followEnd` (1.0 s, where the turn ends) and
`-end`. Compare `V1-middle-followEnd.jpg` with the corner ones: the middle pocket now sits in the upper half with cloth
all around it. The clips show the dev tag, because they come from the test build. No `/__dev/` requests were made.

## Files
Changed: `src/config/game.config.ts` (shares, `follow.middle`, `longShotSeconds`), `src/view/playerCam.ts`
(middleEnd, glideSkipped), `src/game/gamePage.ts` (no glide on a long shot; aimed pocket in the dev camera log),
`tests/playerCam.test.ts` (16.6 KB), `bench/cam-pace.test.ts` (uses the long-shot rule), `docs/RULES.md` (B.7),
`docs/NOW.md`.
New: `scripts/cams2-check.mjs` (7.7 KB), `bench/cam-pace-sum.mjs` (2.4 KB).
Results: `bench/results/2026-11-28/cams2/` (2.3 MB). The old report moved to `docs/reports/2026-11-28-92aed9a.md`.

**dist-test/ files** (bytes):
| File | Size |
|---|---|
| assets/index-0_foLj6_.js | 724,236 |
| assets/solverWorker-C2_eS8qz.js | 50,749 |
| breaks/reds6.json, reds10.json, reds15.json | 489,861 / 589,119 / 712,742 |
| breaks-v3/reds6.json, reds10.json, reds15.json | 488,825 / 589,812 / 712,882 |
| breaks-v4/reds6.json | 491,890 |
| index.html | 11,843 |
| sounds/applause-1 … 6.mp3 | 18,808 / 27,271 / 36,675 / 46,393 / 60,813 / 72,724 |
| sounds/ball-hard, ball-soft, break, cue, cushion, miss, pocket, tap .mp3 | 4,075 / 2,507 / 21,359 / 5,015 / 2,194 / 18,808 / 13,165 / 1,924 |

## Your turn
1. Phone check on the dev server (menu > CAMERA, or AUTO and just play): is the dose right now? Do you like the
   middle-pocket view (`V1-middle.mp4`, `V2-middle.mp4`)?
2. If the middle view should be higher, lower, nearer or wider: give me the change in words (for example "a bit
   closer") and I'll change one number in the config.
