# Solver (task 4.1: success shots)

Code: `src/core/solver.ts`. Report: `npx vitest run bench/solver.test.ts` (100 random layouts per row, this PC).

## How it searches
Every target ball x every pocket, easiest first (small cut, short distance). A pair is skipped when the cut is over
75 degrees or a ball blocks the straight path (cue ball to ghost ball, or target to pocket). Then 9 aim points across the
mouth, 8 powers (0.8-6 m/s), 5 spins. Every shot is simulated and judged by the rules code; the quickest success
found within 150 ms is returned. Colour due = black (the game picks black until the colour choice, RULES B.3).

## Result, 2026-11-24 (friction 0.05)
| Level, due | Solved | Shot median / longest | Within 1.5 s | Compute median / longest |
|---|---|---|---|---|
| 6 reds, red | 87-89 / 100 | 1.23 / 4.05 s | 62% | 150 / 151 ms |
| 6 reds, black | 82 / 100 | 2.85 / 4.13 s | 18% | 150 / 151 ms |
| 15 reds, red | 82-85 / 100 | 1.00 / 4.63 s | 81-83% | 150 / 151 ms |
| 15 reds, black | 61 / 100 | 2.68 / 4.06 s | 13% | 150 / 151 ms |

Compute time is always about 150 ms because the solver keeps looking for a QUICKER shot until the budget ends.

## Layouts with no success shot (kinds)
| Level, due | No open pocket | Budget used up | All tried, none pots |
|---|---|---|---|
| 6 reds, red | 6 | 7 | 0 |
| 6 reds, black | 17 | 1 | 0 |
| 15 reds, red | 1 | 17 | 0 |
| 15 reds, black | 37 | 2 | 0 |

- **No open pocket:** every straight path is blocked by a ball, or the cut is too thin. Mostly the black with
  reds around it (random reds often lie near the black spot). Needs: other balls' paths with a margin, cushion-first
  shots, plants (task 4.5 wide search).
- **Budget used up:** an open pocket exists, but 150 ms covers only about 200-250 simulated shots. Needs a faster
  first guess (try the most likely power first) and the flex chain (task 4.5).

## Open points for later tasks
- Black shots are long (median about 2.7 s): the cue ball travels far after potting the black. Choosing the colour
  with the quickest shot, and screw/stun preference, may help (tasks 4.2-4.5).
- The time budget makes the result depend on the device speed (a slower phone tries fewer shots). For replays and
  round codes the solver must give the same shot on every device: fix in 4.5 by counting shots instead of milliseconds.

## Pace investigation (owner, after 4.1): budget or physics?
Run: `npx vitest run bench/pace/` (about 1 minute). 50 random layouts per row (100 did not fit in the session's time
limit). "Long search" = 2 seconds per layout, about 13x the normal 150 ms. For black it already covers every
aim/power/spin combination (360 shots), so for black it is the same as no limit. Friction 0.05.

| Level, due | 150 ms: median / within 1.5 s | Long search: median / within 1.5 s |
|---|---|---|
| 6 reds, red | 1.41 s / 55% | 1.33 s / 65% |
| 15 reds, red | 1.16 s / 74% | 1.05 s / 86% |
| 6 reds, black | 2.70 s / 10% | 2.71 s / 10% |
| 15 reds, black | 2.88 s / 11% | 2.87 s / 11% |

Black shots, split (long search, median): the black drops after **1.37-1.39 s**, then the cue ball keeps moving for
**1.34-1.44 s**. Median power is 4.5 m/s (reds: 3.4 m/s).

Black shots by distance from the cue ball to the black (long search, both levels together):
| Cue ball to black | Median shot | Within 1.5 s | Cue ball moving after the pot |
|---|---|---|---|
| under 0.6 m (8 layouts) | about 2 s | 38% | 0.4-0.7 s |
| 0.6-1.2 m (20 layouts) | 1.75-2.0 s | 25% | 0.3-0.5 s |
| over 1.2 m (51 layouts) | 3.3-3.4 s | 0% | 1.8-2.0 s |

**Answer: physics and layout, not the search.** For reds, a longer search helps a little (about +10 points within
1.5 s). For black it changes nothing: every combination is already tried. Black shots are long because in a random
layout the cue ball is usually far from the black (1.2 m or more in 6 of 10 layouts). A long pot needs a hard hit,
and then the cue ball runs on for about 2 s.

Options:
1. **Position play (recommended first).** When solving the red shot, prefer shots that leave the cue ball near the
   black (or the next colour). This is the planned "lookahead" (config `solver.lookahead`). It attacks the biggest
   cause, the far cue ball, without any rule change.
2. **Stop the cue ball after the pot.** Try more screw and stun on colour shots, and prefer shots where the cue ball
   stops soon (helps the 0.3-2 s after the pot). Cheap, no rule change.
3. **Let the game pick the quickest colour** instead of always black before the colour-choice stage. This changes
   RULES B.3, so it is the owner's decision. Not measured yet.
4. **Playback 1.2x** (already in "Later").
5. **Accept longer colour shots**, up to `shot.maxDurationFlex` (2.2 s), and keep 1-1.5 s for reds.
Recommendation: 1 + 2 in the solver tasks (4.3-4.5), then measure again before deciding on 3, 4 or 5.
