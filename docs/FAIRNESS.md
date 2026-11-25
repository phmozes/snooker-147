# Fairness proof (task F.1, 2026-11-25, solver 4.9)
Question: does a bad position predict a miss, so a player could CASH OUT from the position? Rule A.5: no, only seed and step.
## 1. Deterministic (main proof; tests/fairness.test.ts, in the normal suite)
- 200 seeds x 3 levels: a plain fake and a bad-position fake (cue ball always left on a cushion, a different colour every step)
  give the same outcomes, failure types and end step, and exactly the outcomes from the seed alone (u(k) < p(k)).
- Real solver 4.9: all 3,000 rounds of the run below match the outcomes from the seed alone: 0 mismatches.
- Files checked: every src/**/*.ts. Only src/core/round.ts reads the 'outcome' stream. solver.ts, solverFailure.ts,
  physicsProvider.ts, presolve.ts, solverWorker.ts import only types from round.ts. gamePage.ts calls nextOutcome() before
  SHOOT only for the failure TYPE; the worker always solves both outcomes, success first. The outcome is read at SHOOT.
- Owner round reds15-102978669: steps 1-9 u < p; step 10 u 0.9912 >= p 0.9011 (miss). 4.8f (phone), 4.9 and the fake all miss at step 10.
- By design: step 1's break is picked by its outcome (B.2), but step 1 plays itself, before any CASH OUT. Left out below.
## 2. Statistical (bench/fairness.test.ts, 1,000 real rounds per level, summary: node bench/fairness-sum.mjs)
Always SHOOT, steps >= 2. Position measured before the shot from the balls only. Bad (fixed before the data):
cue ball <= 25 cm from a cushion, or no open pot, or best open pot cut > 40 deg, or cue ball > 1.5 m from the nearest target.
Expected failures = sum of 1 - p(step). chi2 p: failures vs p(step) for good and bad together; "by bucket": steps 2-5/6-10/11-20/21+.
| Level | Good: shots, failures seen vs expected | Bad: shots, failures seen vs expected | chi2 p | p by bucket | each measure alone (p) |
|---|---|---|---|---|---|
| 6 reds | 4,964: 675 vs 662.0 (13.6% vs 13.3%) | 1,664: 209 vs 221.6 (12.6% vs 13.3%) | 0.57 | 0.17 | near 0.24, no pot 0.77, cut 0.91, far 0.64 |
| 10 reds | 6,533: 726 vs 731.4 (11.1% vs 11.2%) | 1,518: 173 vs 170.4 (11.4% vs 11.2%) | 0.96 | 0.90 | near 0.75, no pot 0.96, cut 0.78, far 0.63 |
| 15 reds | 7,516: 727 vs 731.4 (9.7% vs 9.7%) | 1,592: 180 vs 154.1 (11.3% vs 9.7%) | 0.09 | 0.15 | near 0.47, no pot 0.44, cut 0.19, far 0.48 |

Reading: every p-value is above 0.05, so no difference beyond chance. 15 reds bad positions show a few more misses (180 vs 154),
but p 0.09 is not significant, and part 1 proves the outcome is fixed by the seed before the shot, whatever the position.
Note: seed and ladder live in the browser, so a player with developer tools could compute outcomes. Launch blocker in NOW.md.
