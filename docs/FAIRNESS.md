# Fairness proof (task F.1, 2026-11-25, solver 4.9)
Question: does a bad position predict a miss, so a player could CASH OUT from the position? Rule A.5: no, only seed and step.
## 1. Deterministic (tests/fairness.test.ts, in the normal suite)
- 200 seeds x 3 levels: a plain fake and a bad-position fake (cue ball always left on a cushion, a different colour every step)
  give the same outcomes, failure types and end step, and exactly the outcomes from the seed alone (u(k) < p(k)).
- Real solver: every round of the statistical run below is checked against the seed alone: 0 mismatches so far.
- Files checked: every src/**/*.ts. Only src/core/round.ts reads the 'outcome' stream. solver.ts, solverFailure.ts,
  physicsProvider.ts, presolve.ts, solverWorker.ts import only types from round.ts. gamePage.ts calls nextOutcome() before
  SHOOT only for the failure TYPE; the worker always solves both outcomes, success first. The outcome is read at SHOOT.
- Owner round reds15-102978669: steps 1-9 u < p; step 10 u 0.9912 >= p 0.9011 (miss). 4.8f (phone), 4.9 and the fake all miss at step 10.
- By design: step 1's break is picked by its outcome (B.2), but step 1 plays itself, before any CASH OUT. Left out below.
## 2. Statistical (bench/fairness.test.ts, summary: node bench/fairness-sum.mjs)
Real rounds, always SHOOT, steps >= 2. Position measured before the shot from the balls only. Bad (fixed before the data):
cue ball <= 25 cm from a cushion, or no open pot, or best open pot cut > 40 deg, or cue ball > 1.5 m from the nearest target.
Expected failures = sum of 1 - p(step). chi2 p: failures vs p(step) for good and bad; "by step bucket": steps 2-5/6-10/11-20/21+.
| Level | rounds | Good: shots, failures seen vs expected | Bad: same | Bad share | chi2 p (good/bad) | p by step bucket |
|---|---|---|---|---|---|---|
| reds6 | 301 | 1527 | 211 vs 205.8 (13.8% vs 13.5%) | 496 | 54 vs 64.8 (10.9% vs 13.1%) | 25% | 0.33 (chi2 2.2, df 2) | 0.35 (df 6); alone: near 0.66, noOpen 0.87, cut40 0.77, far 0.44 |

Reading: a p-value above 0.05 means no difference beyond noise. Run status: bench/results/fairness/<level>.done (target 5,000 rounds per level).
Note (not a position issue): seed and ladder live in the browser, so a player with developer tools could compute outcomes. Needs a server-side seed before real money.
