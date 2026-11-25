# P.1 step 4: solver wait per SHOOT on the PC (60 rounds x 3 levels, bench/presolve-cost.test.ts)
One worker (before) = success + failure in a row. Two workers (after) = the slower of the two (timed one after the
other, so it assumes two free cores). Same code the workers run (solveJob.ts). Two-worker shots = one-worker shots: 0 mismatches in 1309 steps.
Per-step medians and maxima: cost-<level>.json (rows). Some timing noise: tests ran on the PC for part of the run.

| Level | Steps | Median before -> after (ms) | Max before -> after (ms) |
|---|---|---|---|
| reds6 | 378 | 847 -> 768 | 7845 -> 7393 |
| reds10 | 435 | 887 -> 833 | 4448 -> 4480 |
| reds15 | 496 | 945 -> 884 | 7104 -> 6246 |

Gain is small (about 7-10 %): the failure solve is cheap; the success solve (and the colour pick on colour steps) is
most of the wait, and on a colour step both workers do the colour pick.
