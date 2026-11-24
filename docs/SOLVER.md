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
