# Report: night run 8 (2026-11-28): 6-red RE-RACK fix A, soaks, pocket-cut recalibration, captions, checks

## In short
| Step | Result | Switched on? |
|---|---|---|
| 1. v4 6-red break library + round marker v4 | built; every replay proof identical | **v4 is built but NOT switched on**: step 2 failed its rule |
| 2. 6-red soak on v4 | RE-RACK rule **FAIL** (5 in 47,474 shots = 10.5 per 100,000; rule: at most 1). Long shots **PASS** (12 vs 65) | nothing |
| 3. pocket-cut soak + recalibration | **PASS** at every level on the held-out seeds | **yes**: new cut chances for 10 and 15 reds, plus a new `reds6-v4` entry (used only by v4 rounds) |
| 4. tests + builds | `npm test` 326/326 pass; `npm run build` and `npm run build:test` OK | - |
| 5-8 | see the sections below | report only (no game change) |

**What this means for you.** The new 6-red library helps a lot: 7 times fewer RE-RACKs than night 6 (76.7 → 10.5 per
100,000 shots), and 0 RE-RACKs on the same 1,000 seeds that gave 5 in night 6. But your rule is at most 1 per 100,000,
so I did not switch it on. Every new round is still v3, exactly as before tonight. To switch v4 on is one line:
`src/config/game.config.ts` `breakLibrary.v4Levels: ['reds6']` (your word). The RE-RACKs that are left all happen at
step 11 (the last red of 6 reds). The break library cannot fix that, because it happens 10 shots after the break.

## Step 1: the v4 6-red break library (fix A)
- **Built:** `public/breaks-v4/reds6.json` (library version tag 4). It keeps every old rule (baulk-line start, no
  pot, red first, colours moved at most 2 cm / 30 cm, a tested step-1 shot). Two new rules apply to the
  "red pottable" breaks: no red within 2 mm of the pink (surface to surface, `v4Rules.redPinkMinGap`), and no red that no pocket
  can take (path or ghost-ball spot blocked, the other balls as blockers; `noLockedRed`). The "snookered" list is
  the v3 list unchanged: a snookered round ends at step 1, so its later layout never matters.
- **Numbers:** 200 red-pottable breaks were found after 673,413 tries (indices 0..673,412; deterministic, built in 11
  parallel chunks that merge to exactly the sequential result). Rejected by the new rules in 4.4 million tries: red
  within 2 mm of the pink 101,327; a red no pocket can take 1,186. CPU 31,092 s. Details: `bench/results/night8/breaks-v4.txt`.
- **Round codes:** `reds6-v4-<seed>`. v4 uses the same HMAC generator as v2/v3 (a test checks every stream value
  v4 == v3), so the 200M RTP result still holds. Only the 6-red break file differs. 10 and 15 reds stay on v3.
  The parsers (round code, phone cost lines, weird-shot marks in vite.config.ts) accept v4.
- **Replay proofs (`bench/results/night8/proof-old.txt`, `proof-v4.txt`; re-run at the end with the final config:
  `bench/results/night8/reproof/`):**

| Set | Rounds | Result |
|---|---|---|
| your 16 marks (WEIRD-SHOTS) | 16 | 16 identical, 0 different |
| old v2 codes, 6 / 10 / 15 reds | 3 x 100 | 300 identical, 0 different |
| v3 codes, 6 / 10 / 15 reds | 3 x 100 | 300 identical, 0 different |
| new v4 codes (recorded, then replayed from the code alone) | 3 x 100 | 300 identical, 0 different |

  Before any change I checked the night-6 reference files on an untouched copy of the old code (HEAD 6ca03d9): 616/616 identical.

## Step 2: 6-red soak on v4
Run 00:50-02:50, 8 shards, seeds 5,000,000 + i (the first 1,000 seeds are night 6's 1,000 seeds). Summary:
`bench/results/night8/soak6/step2.txt` (`node bench/night8/soak-sum.mjs bench/results/night8/soak6`).

**Pass rules (fixed before the run):**
| Rule | Night 6 (v3) | Night 8 (v4) | Result |
|---|---|---|---|
| RE-RACK at most 1 per 100,000 shots (RULES D.6) | 5 in 6,521 shots = 76.7 per 100k (upper 95% bound 161.2) | **5 in 47,474 shots = 10.5 per 100k (upper 95% bound 22.1)** | **FAIL** (the run is long enough: even the lower end is above 1 per 100k) |
| long shots fewer than night 7 (65; success shot over 3.5 s, not exhibition/rescue, on the night-6 seeds) | 65 | **12** | **PASS** |

- Same 1,000 night-6 seeds (923 rounds with a SHOOT shot, 6,535 shots): RE-RACK 5 → **0**; long shots: measure A 65 → 12,
  any success over 3 s 141 → 40, any shot over 3 s 212 → 80.
- All 7,234 rounds: success shots over 3.5 s (measure A) 124 (2.61 per 1,000 shots; night 6: 9.97); success over 3 s 355; any shot over 3 s 655.
- The 5 RE-RACKs are all at **step 11, target red** (the 6th and last red). Four of them follow a slow solver at steps 8 and 10.
  The step-3 soak added 1 more (below): 6 RE-RACKs in 66,305 v4 shots in all (9.0 per 100k).

**Per-step success against p(step)** (success or RE-RACK counts as success):
| step | measured | p | SE away |
|---|---|---|---|
| 1 | 6663/7234 = 92.11% | 92.38% | -0.88 |
| 2 | 6073/6663 = 91.15% | 92.11% | -2.91 |
| 3 | 5458/6073 = 89.87% | 89.76% | +0.28 |
| 4 | 4878/5458 = 89.37% | 89.44% | -0.15 |
| 5 | 4336/4878 = 88.89% | 88.20% | +1.49 |
| 6 | 3766/4336 = 86.85% | 87.03% | -0.34 |
| 7 | 3222/3766 = 85.55% | 86.45% | -1.60 |
| 8 | 2741/3222 = 85.07% | 85.26% | -0.30 |
| 9 | 2309/2741 = 84.24% | 83.95% | +0.42 |
| 10 | 1918/2309 = 83.07% | 83.29% | -0.28 |
| 11 | 1571/1918 = 81.91% | 81.96% | -0.06 |
| 12 | 1250/1566 = 79.82% | 81.11% | -1.30 |
| 13 | 1011/1250 = 80.88% | 80.00% | +0.78 |
| 14 | 801/1011 = 79.23% | 79.04% | +0.15 |
| 15 | 631/801 = 78.78% | 77.99% | +0.54 |
| 16 | 480/631 = 76.07% | 77.00% | -0.56 |
| 17 | 371/480 = 77.29% | 75.92% | +0.70 |
| 18 | 284/371 = 76.55% | 74.92% | +0.72 |

All within 3 SE (step 2 is the furthest, -2.91 SE; with 18 steps one value near 3 SE is expected now and then). The
outcome comes only from the seeded RNG; the physics never changes it, and the 200M RNG run already checks p exactly.

**Every line of the step-2 failures files (26 lines):**
```
reds6-0-failures.txt: reds6-v4-5005168 step 8: solver took 10553 ms (stuck limit 10000)
reds6-0-failures.txt: reds6-v4-5005168 step 10: solver took 13573 ms (stuck limit 10000)
reds6-0-failures.txt: reds6-v4-5005168 step 11: RE-RACK (target red)
reds6-0-failures.txt: reds6-v4-5006616 step 8: solver took 10818 ms (stuck limit 10000)
reds6-1-failures.txt: reds6-v4-5000289 step 9: solver took 10711 ms (stuck limit 10000)
reds6-1-failures.txt: reds6-v4-5003065 step 8: solver took 11528 ms (stuck limit 10000)
reds6-2-failures.txt: reds6-v4-5000442 step 9: solver took 10097 ms (stuck limit 10000)
reds6-3-failures.txt: reds6-v4-5002195 step 8: solver took 10624 ms (stuck limit 10000)
reds6-3-failures.txt: reds6-v4-5006595 step 8: solver took 10722 ms (stuck limit 10000)
reds6-4-failures.txt: reds6-v4-5003708 step 8: solver took 10712 ms (stuck limit 10000)
reds6-4-failures.txt: reds6-v4-5003708 step 10: solver took 13914 ms (stuck limit 10000)
reds6-4-failures.txt: reds6-v4-5003708 step 11: RE-RACK (target red)
reds6-4-failures.txt: reds6-v4-5005372 step 8: solver took 10679 ms (stuck limit 10000)
reds6-5-failures.txt: reds6-v4-5000253 step 8: solver took 11660 ms (stuck limit 10000)
reds6-5-failures.txt: reds6-v4-5001525 step 8: solver took 10128 ms (stuck limit 10000)
reds6-6-failures.txt: reds6-v4-5003494 step 8: solver took 10653 ms (stuck limit 10000)
reds6-6-failures.txt: reds6-v4-5003494 step 10: solver took 13952 ms (stuck limit 10000)
reds6-6-failures.txt: reds6-v4-5003494 step 11: RE-RACK (target red)
reds6-6-failures.txt: reds6-v4-5003958 step 8: solver took 10705 ms (stuck limit 10000)
reds6-6-failures.txt: reds6-v4-5003958 step 10: solver took 13743 ms (stuck limit 10000)
reds6-6-failures.txt: reds6-v4-5003958 step 11: RE-RACK (target red)
reds6-6-failures.txt: reds6-v4-5004846 step 8: solver took 10592 ms (stuck limit 10000)
reds6-6-failures.txt: reds6-v4-5004846 step 10: solver took 13853 ms (stuck limit 10000)
reds6-7-failures.txt: reds6-v4-5005543 step 8: solver took 10460 ms (stuck limit 10000)
reds6-7-failures.txt: reds6-v4-5005543 step 10: solver took 13531 ms (stuck limit 10000)
reds6-7-failures.txt: reds6-v4-5005543 step 11: RE-RACK (target red)
```
"solver took ... ms" means one solve took over 10 s on the soak PC with all 12 cores busy. It is a warning, not a
RE-RACK. The night-6 baseline lines (v3, same seeds) for comparison: 5000520 step 11 RE-RACK; 5000094 step 10 solver
10472 ms; 5000094 step 11 RE-RACK; 5000282 step 11 RE-RACK; 5000510 step 11 RE-RACK; 5000347 step 11 RE-RACK.

## Step 3: pocket-cut soak and new cut chances
Run 01:21-04:45 (10 / 15 reds) and 02:51-04:45 (6 reds v4), SHOTS=1 PAIRED=1, seeds from 5,400,000 (never used for
anything else). Soaked: 6 reds v4 2,810 rounds / 18,831 shots; 10 reds 2,558 / 21,053; 15 reds 2,010 / 18,718.
Calibration on the even seeds (`bench/results/night8/pocketcut/calib.txt`), check on the odd seeds (`test.txt`).
The failure mix per step group comes from the step-2 v4 soak (6 reds) and the night-6 soak (10 / 15 reds).

**New chances** (chance that a cuttable shot gets the cut; failure per step group 2-4, 5-8, 9-12, 13-20, 21+):
| Level | success | failure (old → new) |
|---|---|---|
| 6 reds v4 (new entry `reds6-v4`) | 0.1667 | new: 0.6552, 0.6151, 0.6526, 0.6303, 0.6369 (v1-v3 6-red rounds keep 0.6407, 0.6131, 0.5113, 0.7300, 0.6078) |
| 10 reds | 0.1667 | 0.6787→0.6829, 0.6690→0.6734, 0.5412→0.5439, 0.7338→0.7389, 0.6654→0.6758 |
| 15 reds | 0.1667 | 0.6667→0.6709, 0.5939→0.5974, 0.5403→0.5433, 0.7346→0.7409, 0.7365→0.7453 |

**Check on the held-out odd seeds** (rule: each rate within 3 SE of 1/6 = 16.67%, and the difference within 3 SE of 0):
| Level | shots | P(cut given success) | P(cut given failure) | difference | result |
|---|---|---|---|---|---|
| 6 reds v4 | 9,570 | 16.60% (-0.16 SE) | 15.11% (-1.48 SE) | 1.49 points (1.33 SE) | PASS |
| 10 reds | 10,564 | 16.74% (+0.19 SE) | 15.52% (-1.05 SE) | 1.22 points (1.06 SE) | PASS |
| 15 reds | 9,403 | 16.89% (+0.54 SE) | 15.43% (-1.02 SE) | 1.45 points (1.14 SE) | PASS |

All 29,537 shots: 16.58% cut, P1b view 69.64%, +0.297 s per shot. **Switched on** (`src/config/game.config.ts`
`pocketCut.cutChance`). The cut is visual only: it never changes an outcome. A v4 round uses `reds6-v4`; since v4 is
off, 6-red rounds today still use the old `reds6` numbers. Test: `tests/pocketCam.test.ts`.

**Every line of the step-3 failures files (17 lines):**
```
reds10-2-failures.txt: reds10-v3-5400514 step 17: solver took 10130 ms (stuck limit 10000)
reds15-0-failures.txt: reds15-v3-5400892 step 5: solver took 13005 ms (stuck limit 10000)
reds15-0-failures.txt: reds15-v3-5401128 step 7: solver took 13243 ms (stuck limit 10000)
reds15-0-failures.txt: reds15-v3-5401832 step 29: RE-RACK (target red)
reds15-0-failures.txt: reds15-v3-5402464 step 5: solver took 12938 ms (stuck limit 10000)
reds15-1-failures.txt: reds15-v3-5400017 step 5: solver took 12690 ms (stuck limit 10000)
reds15-1-failures.txt: reds15-v3-5401217 step 11: solver took 11837 ms (stuck limit 10000)
reds15-1-failures.txt: reds15-v3-5401333 step 25: solver took 10283 ms (stuck limit 10000)
reds15-1-failures.txt: reds15-v3-5402429 step 13: solver took 10040 ms (stuck limit 10000)
reds15-2-failures.txt: reds15-v3-5400086 step 7: solver took 12567 ms (stuck limit 10000)
reds15-2-failures.txt: reds15-v3-5400174 step 7: solver took 12087 ms (stuck limit 10000)
reds15-3-failures.txt: reds15-v3-5400107 step 10: solver took 12239 ms (stuck limit 10000)
reds15-3-failures.txt: reds15-v3-5400311 step 9: solver took 10181 ms (stuck limit 10000)
reds15-3-failures.txt: reds15-v3-5400427 step 29: RE-RACK (target red)
reds15-3-failures.txt: reds15-v3-5400867 step 11: solver took 12091 ms (stuck limit 10000)
reds15-3-failures.txt: reds15-v3-5400943 step 5: solver took 13152 ms (stuck limit 10000)
reds6-1-failures.txt: reds6-v4-5402181 step 11: RE-RACK (target red)
```
(reds6-0/2/3, reds10-0/1/3 failures files: empty.)

## Step 4: tests, builds
- `npm test`: 34 files, **326/326 pass** (one old test still said "a v4 code is not valid"; it now checks v4 is read and v5 is refused).
- `npm run build` (production, dist/) and `npm run build:test` (dist-test/, developer menu, no PC posting): both OK.
  The new file in both is `breaks-v4/reds6.json` (not loaded while v4 is off: the game loads a library only for the round's version).

dist/ (production, 24 files, 5,166,220 bytes):
```
    698469  assets/index-bpUhgZuU.js
     50029  assets/solverWorker-CzTa1GWI.js
    589119  breaks/reds10.json
    712742  breaks/reds15.json
    489861  breaks/reds6.json
    589812  breaks-v3/reds10.json
    712882  breaks-v3/reds15.json
    488825  breaks-v3/reds6.json
    491890  breaks-v4/reds6.json
     10860  index.html
     18808  sounds/applause-1.mp3
     27271  sounds/applause-2.mp3
     36675  sounds/applause-3.mp3
     46393  sounds/applause-4.mp3
     60813  sounds/applause-5.mp3
     72724  sounds/applause-6.mp3
      4075  sounds/ball-hard.mp3
      2507  sounds/ball-soft.mp3
     21359  sounds/break.mp3
      5015  sounds/cue.mp3
      2194  sounds/cushion.mp3
     18808  sounds/miss.mp3
     13165  sounds/pocket.mp3
      1924  sounds/tap.mp3
```
dist-test/ (test build, 24 files, 5,180,488 bytes): the same files and sizes except `assets/index-CceScDPE.js` 712,540
(the developer menu) and `index.html` 11,057.

## Files changed tonight
Code: `src/core/round.ts` (RngVersion 4, `newRngFor`), `src/core/physicsProvider.ts` (v4 files, library tag),
`src/core/breakLibrary.ts` (v4 rules, ranged build), `src/core/roundCode.ts`, `src/game/costLine.ts`, `vite.config.ts`
(v4 marker), `src/game/gamePage.ts` (new rounds use `newRngFor`, v4 library loaded for v4 codes), `src/view/pocketCam.ts`
(`reds6-v4` chances for v4 rounds), `src/config/game.config.ts`. Data: `public/breaks-v4/reds6.json`. Tests:
`tests/round.test.ts`, `tests/roundCodeFormats.test.ts`, `tests/roundCodeLib.ts`, `tests/breakLibraryV4.test.ts` (new),
`tests/pocketCam.test.ts`, `tests/gameLoop.test.ts`. Bench: `bench/night8/*`, `bench/soak.test.ts` (RNG default),
`bench/pocketcut-sum.test.ts` (several folders, CURRENT / V4 filters). Docs: RULES.md B.1, FAIRNESS.md.
Not committed: the 11 build chunks `bench/results/night8/v4chunk-*.json` (big; `bench/night8/gen-v4.sh` rebuilds them).

## Step 5: on-screen captions (options page only; no game change)
Page: `mockups/captions/index.html` (9 JPGs, 79-88 KB each, relative paths). Three styles on stills of the real game
screen (390x844; the caption is drawn on top by `scripts/captions-shots.mjs`; never on the cloth):
- **A, banner above the table:** a short gold label (red for a failure) between the top bar and the table (its bottom is at 91 px, the table starts at 105 px).
- **B, in the hint line:** the caption replaces "RED · NEXT x1.27" for its time, in bold gold or red. The quietest option.
- **C, over the top bar:** a big caption covers the balance and the multiplier for its time. The loudest option.

Each style shows MAXIMUM IS ON (before a shot), CENTURY (after a pot) and MISSED (after a miss). The page also has the
table for all 14 messages: when each appears, how long it stays, its priority, and before or after the shot. The three
BEFORE messages (LAST RED, MAXIMUM IS ON, FRAME BALL) use only the table and the score, never the outcome that is already
drawn. For you to decide: the clearance message is on the cloth today (RULES B.4), and a failure caption repeats the
strip line "MISSED · LOST". Note: the config priority list also has ON THE COLOURS, which is not one of the 14 messages.

## Step 6: truth check (report only)
Script: `bench/night8/truth.test.ts` → `bench/results/night8/truth.txt` (compares the shown numbers with the config,
docs/RTP-OPTION3.md option 3c, and bench/results/rtp-rng-v2-200M.txt).

| What the player sees | Where | Source of truth | Match |
|---|---|---|---|
| 6 reds ladder: x1.05 … x25.00 (18 chips) | ladder strip | RTP-OPTION3 3c | yes |
| 10 reds ladder: x1.05 … x50.00 (26) | ladder strip | RTP-OPTION3 3c | yes |
| 15 reds ladder: x1.05 … x100.00 (36) | ladder strip | RTP-OPTION3 3c | yes |
| p(step) behind each ladder (not shown) | config levels[].p | RTP-OPTION3 3c (2 decimals) | yes (all 80 values) |
| top multipliers "up to x25.00 / x50.00 / x100.00" | Rules box; "UP TO x25.00" in the ladder strip | RULES A.4, config labels "up to x25" … | yes (shown with 2 decimals) |
| steps 18 / 26 / 36 | ladder "STEP k / 18" | RULES A.2 | yes |
| "RTP 97% at every cash-out step" (6 reds) | Rules box | RTP-OPTION3 player text, RULES A.6 | yes |
| "RTP 97% (between 96.94% and 97%, …)" (10 reds) | Rules box | same | yes |
| "RTP 97% (between 96.42% and 97%, …)" (15 reds) | Rules box | same | yes |
| measured cash-out RTP behind these texts (200M rounds per level) | - | pass rule \|z\| < 4, formula column = config | yes: 6 reds 96.9994-97.0124% (worst \|z\| 1.44); 10 reds 96.9201-97.0115% (1.84); 15 reds 96.4270-97.0849% (1.50) |
| bet 1-100, step 1 | BET − / + | RULES A.1, config money | yes |
| quick bets 1 · 5 · 10 · 50; default bet 10; START · 10.00 | bet row | config money | yes |
| balance 1,000.00 at start | top bar | config startingBalance | yes |
| "WON <amount> · x<mult>", "CLEARED · WON …", "MISSED / IN-OFF / FOUL / SNOOKERED · LOST <bet>" | ladder strip (end) | RULES B.4, C.5 | yes |
| "RE-RACK · WON <amount> · x<multiplier>" | ladder strip (end) | RULES D.4 | yes |
| hint "RED · NEXT x1.61" | hint line | RULES (next multiplier) | yes |
| "MAXIMUM 75/107/147", "TOTAL CLEARANCE <score>" | on the cloth after a clearance | RULES B.4, C.9 | yes |
| footer "147 · DEMO · Round <code> · <clock>", "Rules · PLAY RESPONSIBLY" | footer | PLAN (DEMO label) | yes |
| Rules box: "The opponent breaks off **and your first red plays itself**." | Rules box, line 1 | RULES B.2 (since 2026-11-27 step 1 is played by SHOOT) | **NO** |
| Rules box: "If no shot can be found the balls are re-racked and the round is paid." | Rules box, line 4 | RULES E: must include "In the rare case of a stalemate (re-rack), the round ends and you are paid the next step's multiplier." | **NO** (the required sentence is missing; also no balls are re-racked: RULES D.4 says the pot counts and no shot is played) |
| Rules box: "A miss, a foul or an in-off ends the round" | Rules box, line 3 | RULES C.5 (also SNOOKERED) | yes (SNOOKERED is a kind of foul) |

**Two mismatches, both in the Rules box text** (`src/game/gamePage.ts` `openRules`). I did not fix them (report only).

## Step 7: game vs mockups (report only)
Page: `mockups/compare-mockups/index.html`: mockups D, A, C next to the game in the same states (game screenshots by
`scripts/compare-shots.mjs`, 390x844, developer marks hidden), with a list of differences.
- **Deliberate (owner decisions):** full-screen layout; the 3D table at 57° with wood rails and the D; level balls
  6/10/15 instead of the "6 reds · up to x25" pill; back / sound buttons in the top bar; cue ball on the baulk line;
  "BREAK n" in the hint line; the DEMO footer; SHOOT with an automatic colour instead of the Blue / Pink / Black buttons (RULES B.3).
- **May be unintended (your call):** the ladder label between rounds says "UP TO x25.00" (mockup "STEP 0 / 18"); the bet
  − / + and the quick bets are on one row with smaller buttons (mockup: two rows); an empty gap of about 40 px between the
  ladder strip and the bet row; the SHOOT / START font is heavier than in the mockups.
- Same as the mockup: multiplier, ladder chips, CASH OUT amounts, hint text, gold and background colours.
