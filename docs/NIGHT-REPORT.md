# Night report 2026-11-24 / 25 (roll back everything: `git reset --hard night-start`)
## 1. Done
- Start: 188 tests passed, tag `night-start`. RULES B.3 now says the black is natural only if it also leaves a natural red.
- Phase 1: your five positional rules are in the solver (config `solver.natural.blackPlay`); 4 new measures; your 4 marks replayed (top of docs/WEIRD-SHOTS.md: 2 fixed, 1 partly, 1 milder but still happens).
- Phase 2: 4 rounds. Kept: stronger cannon/long costs, red shots planned two shots ahead. Not kept: 2 mixed ideas. Stopped by your rule.
- Phase 3: soak test runs as a background script. It found 5 different RE-RACK positions; all fixed (solver 4.8d, 4.8e, 4.8f), each with a test.
- Phase 4: test panel in the ≡ menu (dev build only): force next outcome, clearance, jump to step, auto play. Red tag on screen.
- Phase 5: solver.ts split (failure shots in solverFailure.ts), docs updated, NOW.md updated. End: 202 tests pass.
## 2. Before (solver 4.7c) / after (4.8f) / target, 60 real rounds per level, strict definition
| | 6 reds | 10 reds | 15 reds | Target |
|---|---|---|---|---|
| Natural | 85.0 -> 86.9% | 91.0 -> 91.0% | 84.1 -> 88.2% | 90% |
| Exhibition | 3.2 -> 1.0% | 1.3 -> 1.3% | 2.8 -> 1.8% | under 2% |
| RE-RACK | 0 -> 0 | 0 -> 0 | 0 -> 0 | 0 |
| Black shots from behind the black | 18.9 -> 8.2% | 14.6 -> 7.2% | 13.9 -> 5.4% | low |
| Reds into baulk-end corners | 8.7 -> 4.0% | 4.2 -> 1.2% | 9.7 -> 2.0% | only reds in the baulk half |
| Median cut / cuts over 50 deg | 19 -> 17 deg / 3.5 -> 2.2% | 24 -> 18 / 1.6 -> 1.6% | 23 -> 17 / 3.5 -> 3.0% | comfortable / none |
| Shot length median / within 2.5 s | 1.53 -> 1.56 s / 96 -> 99% | 1.60 -> 1.48 s / 99 -> 98% | 1.63 -> 1.53 s / 96 -> 97% | 1.8 s / 90% |
| Shots over 3.5 s (all) | 1 -> 0 | 2 -> 1 | 7 -> 3 | 0 |
## 3. Soak (details: bench/results/soak*/summary.txt, docs/SOAK-FAILURES.md)
- Run on 4.8d: 18,648 / 16,232 / 15,142 success shots (6 / 10 / 15 reds). Far below your 100k: the PC was too slow.
- RE-RACK: 8 / 2 / 0 there, but only 2 different positions (the same break repeats); both fixed and replayed (4.8e, 4.8f).
- Run on 4.8f (newest code) started 01:35 and stops by itself at 05:40: `node bench/soak-merge.mjs bench/results/soak`.
- No crash, no invalid shot, no ball off the cloth, no overlap, no shot over its cap. Over 3.5 s: 0.5-1.1% of shots.
- Types: plain 66-80%, cannons 13-29%, long 3-6%, cushion-first/double/plant about 1-2%. RTP for "cash out after step k": 94.5-97.4% (only about 2-3k rounds: still noisy; your ladders were not touched).
## 4. Check first on your phone
- Open http://192.168.1.111:5180. Tap ≡, find TEST PANEL. Tap "Rattle", then SHOOT: the red tag says NEXT FORCED, the end line says FORCED.
- Type 10 in the step box, "Jump to step": the balls jump to step 10. Then "Clearance". Then "Play a round automatically".
- Play 3-4 normal rounds and watch the black: the cue ball should stay on the pink side, reds should go into the black-end corners.
## 5. Decisions I made alone (owner to confirm)
1. B.3 "leaves a natural red" applies to pink and blue too, not only black (same test for all three).
2. When no colour is natural, the colour pick prefers a colour that keeps the next red reachable and runs a rescue search for black, pink and blue, before "any shot in time" (RULES B.3 says only "the first with any shot in time, else black").
3. New steps in the success chain (RULES D.3): "rescue" after the wide search, "doubles" before the spray, and a last-resort shot must leave a ball pottable if one can. Also a cost for leaving only "locked" reds.
4. "Behind the black" = the cue ball is nearer the black-end cushion than the black. A red into a middle pocket costs a little more (0.3) than a black-end corner.
5. Phase 2 "better" = better at both 6 and 15 reds. Soak RTP = "cash out after step k"; forced test-panel rounds change the (demo) balance, always marked FORCED.
## 6. Not finished
- Natural 90% at 6 and 15 reds (now 87-88%); some shots over 3.5 s; cuts over 50 deg not gone (mostly fallback shots). Soak far below 100k per level.
- The test panel was not clicked through by me (no browser tool tonight): type check, build check (no panel code in the real build) and core tests only.
