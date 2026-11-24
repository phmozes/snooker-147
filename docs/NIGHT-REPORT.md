# Night report 2026-11-24 / 25 (roll back everything: `git reset --hard night-start`)

## 1. Done
- Start: 188 tests passed, tag `night-start`. RULES B.3 now says the black is natural only if it also leaves a natural red.
- Phase 1: your five positional rules are in the solver (config `solver.natural.blackPlay`); 4 new measures; your 4 marks replayed (top of docs/WEIRD-SHOTS.md: 2 fixed, 1 partly, 1 milder but still happens).
- Phase 2: 4 rounds. Kept: stronger cannon/long costs, red shots planned two shots ahead. Not kept: 2 mixed ideas. Stopped by your rule.
- Phase 3: soak test as background script; it found 3 RE-RACKs on the first run, fixed (with tests), then ran again. SOAK_LINE
- Phase 4: test panel in the ≡ menu (dev build only): force next outcome, clearance, jump to step, auto play. Red tag on screen.
- Phase 5: solver.ts split (failure shots in solverFailure.ts), docs updated, NOW.md updated.

## 2. Before (solver 4.7c) / after (4.8d) / target, 60 real rounds per level, strict definition
| | 6 reds | 10 reds | 15 reds | Target |
|---|---|---|---|---|
| Natural | 85.0 -> 86.9% | 91.0 -> 91.0% | 84.1 -> 88.2% | 90% |
| Exhibition | 3.2 -> 1.0% | 1.3 -> 1.3% | 2.8 -> 1.8% | under 2% |
| RE-RACK | 0 -> 0 | 0 -> 0 | 0 -> 0 | 0 |
| Black shots from behind the black | 18.9 -> 8.2% | 14.6 -> 7.2% | 13.9 -> 5.4% | low |
| Reds into baulk-end corners | 8.7 -> 4.0% | 4.2 -> 1.2% | 9.7 -> 2.0% | only reds in the baulk half |
| Median cut | 19 -> 17 deg | 24 -> 18 deg | 23 -> 17 deg | comfortable |
| Cuts over 50 deg | 3.5 -> 2.2% | 1.6 -> 1.6% | 3.5 -> 3.0% | none |
| Shot length median / within 2.5 s | 1.53 -> 1.56 s / 96 -> 99% | 1.60 -> 1.48 s / 99 -> 98% | 1.63 -> 1.53 s / 96 -> 97% | 1.8 s / 90% |
| Shots over 3.5 s (all) | 1 -> 0 | 2 -> 1 | 7 -> 3 | 0 |

## 3. Soak (solver 4.8d, details bench/results/soak/summary.txt and docs/SOAK-FAILURES.md)
SOAK_RESULTS

## 4. Check first on your phone
- Open DEV_ADDRESS. Tap ≡, find TEST PANEL. During a round: tap "Rattle", then SHOOT: the red tag says NEXT FORCED, the end line says FORCED.
- Type 10 in the step box, "Jump to step": the balls jump (no animation) to step 10. Then "Clearance". Then "Play a round automatically".
- Play 3-4 normal rounds and watch the black: the cue ball should stay on the pink side of it, and reds should go into the black-end corners.

## 5. Decisions I made alone (owner to confirm)
1. B.3 "leaves a natural red" applies to pink and blue too, not only black (same test for all three).
2. When no colour is natural, the colour pick now prefers a colour that keeps the next red reachable, and runs a rescue search for black, pink and blue, before "any shot in time" (RULES B.3 text says only "the first with any shot in time, else black").
3. New last-resort step "rescue" in the success chain after the wide search (RULES D.3 lists the chain): it keeps a shot only if the next ball can then be potted. Also a cost for leaving only "locked" reds (reds no pocket can take).
4. "Behind the black" = the cue ball is nearer the black-end cushion than the black (anywhere across the width).
5. A red into a middle pocket costs a little more than into a black-end corner (0.3).
6. Phase 2 "better" = better at both 6 and 15 reds; a mixed result was not kept.
7. Soak RTP = "cash out after step k" for fixed k; forced test-panel rounds change the (demo) balance like real ones, always marked FORCED.

## 6. Not finished
- Natural 90% at 6 and 15 reds (now 87-88%); some shots over 3.5 s; cuts over 50 deg not gone (mostly fallback shots).
- SOAK_SHORT
- The test panel was not clicked through by me (no browser tool tonight): type check, build check (no panel code in the real build) and core tests only.
