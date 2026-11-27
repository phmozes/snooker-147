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


# Outcome generator (night 4, 2026-11-27)
## How u is made
Every random number of a round is u = f(seed, stream, k) in [0, 1): stream = 'outcome' (success when u < p of step k),
'failureType', 'break', 'variety'. Nothing else in physics, rules or solver is random (no Math.random).
- **v2 (every new round since night 4):** u = first 52 bits of HMAC-SHA256(key = seed, message = `stream#k`) / 2^52.
  key = the 32-bit seed as 4 bytes, big-endian; message = UTF-8 text, e.g. `outcome#7`. Own SHA-256 code
  (src/core/sha256.ts), synchronous, the same in the browser and in Node; tested against the FIPS 180-2 examples, RFC 4231
  test cases 1-4, 6, 7, Node's crypto for every length 0-200, and u itself against Node's HMAC (tests/sha256.test.ts).
  The server (docs/SERVER-OUTCOMES.md) will use the same function with a 32-byte server seed as the key.
- **v1 (until night 4):** FNV-1a of seed and `stream#k` feeding one mulberry32 draw (a light hash). Kept only as
  streamValueV1 so that old round codes replay exactly as before.
- **v3 (every new round since night 6):** the SAME v2 HMAC generator (streamValue for v3 is streamValueV2; a test checks
  every stream value v3 == v2). Only the break-off library changed: v3 rounds take their break from public/breaks-v3
  (cue ball on the baulk line, RULES B.1); v1 and v2 rounds keep the old public/breaks. The library pick uses the same
  'variety' value as before, so a v3 round has the same outcomes (success / failure per step, failure type) as the v2
  round of that seed; only the shots differ. The 200M v2 result below therefore still stands for v3.
- **v4 (every new 6-red round since night 8; 10 and 15 reds stay v3):** the same v2 HMAC generator again (a test
  checks every stream value v4 == v3). Only the 6-red break-off library changed: public/breaks-v4/reds6.json, whose
  redPottable breaks leave no red within 2 mm of the pink and no red that no pocket can take (RE-RACK fix A, night 8).
  The library pick and every outcome stay as for v3, so the 200M v2 result still stands for v4.
## Round codes
A v3 code carries the marker `v3` before the seed: `reds6-v3-48213-BKPK-C7`; a v2 code (night 4 to 6) `v2`. A code
without a marker (`reds6-48213-BKPK-C7`, every code from before night 4, all owner marks) is v1 and replays with the old
generator. v1 and v2 codes replay on the old break-off library; the v3 library files carry `version: 3` and the
provider refuses them for a v1 / v2 round (night 6 proof: bench/results/night6/). A v4 code (`reds6-v4-48213`) plays
the v4 6-red file (`version: 4`); a v4 code at 10 or 15 reds would use the v3 files (night 8 proof: bench/results/night8/).
## The v1 failure (night 3) and the v2 result (night 4)
- v1, 50M rounds per level (bench/results/rtp-rng-50M.txt): failed its rule (|z| < 3 every cash-out step) on reds6
  steps 13, 14, 18 (all below 97%, worst z -3.45). Cause not proven; the light hash was the suspect.
- v2, 200M rounds per level, seeds 1..200,000,000 (bench/results/rtp-rng-v2-200M.txt). Rule fixed before the run, run
  once: every cash-out step |z| < 4 AND every "step k+1 ok given 1..k ok" |z| < 4 AND every single step |z| < 4.
  **PASS.** Worst |z|: cash-out 1.44 / 1.84 / 1.50, conditional 2.07 / 2.37 / 3.67, single 2.44 / 2.64 / 2.66
  (6 / 10 / 15 reds). Cash-out steps above vs below the formula: 17/1, 12/14, 11/25 (no one-sided drift: reds6 above,
  reds15 below; the cash-out cells of one level share the same rounds, so they move together).
  The worst cell, 3.67, is reds15 step 36 conditional (83.62% vs 83.53%, 1.9M rounds reached it).
  By simulation (20,000 runs of this exact rule) a PERFECT generator fails it in 1.28% of runs.
  Note: a 1.2M-round speed test of the same code (seeds 1..1.2M) was run before the real run (bench/results/rtp200m-speed),
  to time it, and the summary script was tried on it (it passed; these seeds are part of the 200M). The 200M run itself
  was started once and its result read only when all 12 parts had finished.
