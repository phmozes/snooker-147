# P.2: THINKING for a fast player (SHOOT pressed 0.4 s after it appears), 60 rounds x 3 levels, PC
bench/presolve-timeline.test.ts: each solve timed once (two workers), the same times played through both schedules.
Nothing else ran on the PC. The model leaves out the phone's CPU share for drawing the animation.

| Level | Shots | P.1 THINKING (median / max wait) | P.2 THINKING |
|---|---|---|---|
| reds6 | 378 | 17 = 4.5 % (769 / 3321 ms) | 0 |
| reds10 | 435 | 19 = 4.4 % (355 / 1825 ms) | 0 |
| reds15 | 496 | 33 = 6.7 % (474 / 3743 ms) | 0 |

P.1 model 4-7 % vs the phone's 3 of 83 (3.6 %) with the same press time: close. Under 1 %, so no profiling (task rule).
