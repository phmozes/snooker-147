# Review list (autonomous session 2026-11-24, 16:23-18:23)

One section per task: what was built, how to check it, numbers, decisions for the owner to confirm, what is unfinished.

## 0. Phone fixes on the game page
**Built:** the game now sizes itself to the area you can really see (visual viewport minus the notch/bar insets) and
re-fits when the browser bars show or hide. The page is locked: no scroll, no pinch or double-tap zoom, no sideways
drag, no browser text zoom, no text selection, no long-press menu, no tap highlight. Balls are drawn at 1.4x (new
default), with 1.4x added to the menu.
**Check:** on the phone open http://192.168.1.111:5180/ . Screen D: "BALANCE" fully visible, START fully on screen
with a small gap below. Screen C (≡ menu): colour buttons not touching the bottom. Long-press "x1.14": nothing happens.
Pinch, double-tap, drag sideways: nothing moves.
**Likely cause of the old problem:** the in-app browser's text zoom made everything larger, and the old code used the
window height including the area under the browser bars. Both are fixed; I could not test on Android myself.
**Decisions to confirm:** none (1.4x is your choice, marked provisional).
**Not finished:** nothing.

## 1. Finish task 4.2 (failure shots)
**Built:** the failure search now tries the easiest (ball, pocket) pairs first and medium powers first, and takes the
first failure that is not too long. The last two RULES D.2 fallbacks exist: a soft shot into a wrong ball (FOUL), then
a gentle tap that hits nothing (FOUL). So a failure shot is always found.
**Why a plain miss was often not found:** two reasons. (1) The search tried hard pairs first and the 150 ms ran out
(a longer search found some). (2) The miss rules were too strict: aim error only 6-9 cm at the pocket, and the missed
ball had to come within 15 cm of the mouth. Now: aim error 6-13 cm, within 20 cm.
**Check:** debug.html, Solver section, "Failure shot": pick a type, "Run 20 (this type)". The summary line shows the
fallbacks per kind and "nothing found: 0". "Solve failure" names the fallback in red when one was used.
**Numbers** (20 random layouts each, `npx vitest run bench/failure.test.ts`):
| Level, due | Plain miss found | In-off found (was) | Nothing found |
|---|---|---|---|
| 6 reds, red | 18/20 (was 13) | 9/20 (was 12*) | 0 (was 2-7) |
| 15 reds, red | 17/20 (was 16) | 11/20 (was 6) | 0 |
| 15 reds, black | 15/20 (was 12) | 10/20 (was 5) | 0 |
(*the 6-red in-off rows used different layouts before; the order of the search changed too.) Jaw rattle 13-18/20,
wrong ball first 9-15/20. Test: `tests/failure.test.ts` "a failure shot ALWAYS exists": 60 layouts, nothing found = 0.
**In-off:** about half the layouts. That is acceptable in my view: an in-off needs the cue ball to run into a pocket
after a near-miss, which many layouts simply do not allow, and the fallback is a plain miss (the most common failure
anyway, 60% of later failures in the config). Wider aim points raised it from about 6 to about 10 of 20.
**Decisions to confirm:** (a) the miss aim error 6-13 cm and "within 20 cm of the pocket" (config
`solver.failure`); (b) a failure does not need to be the quickest shot: the first one under 2.2 s is taken;
(c) the soft foul and the tap are labelled FOUL (RULES D.2), the tap is "missed every ball" in the rules code.
**Not finished:** the step-1 snookered escape (needs the break-off library, task 4.6). Failure shots are still long
(median 1.8-3.4 s).

## 2. Solver stops after a number of shots, not milliseconds
**Built:** every solver search stops after `solver.shotBudget` simulated shots (250) instead of 150 ms. A slow phone
and a fast PC now pick exactly the same shot. Compute time is still shown, only as information.
**Check:** debug.html, Solver: "Solve" shows "N of 250 shots tried". Test `tests/solver.test.ts`: a normal clock and a
clock 50x slower pick identical success and failure shots.
**Numbers** (100 layouts, `npx vitest run bench/solver.test.ts`, this PC): solved 87 / 82 / 86 / 63 of 100 (6 reds red,
6 reds black, 15 reds red, 15 reds black), about the same as with 150 ms. Compute time median 81-133 ms, longest
261 ms on this PC. A phone is about 2-4x slower, so up to about 0.5-1 s there.
**Decisions to confirm:** the budget of 250 shots (about 150 ms on this PC). The real-phone time is still to be
measured (already in "Later").
**Not finished:** nothing.

## 3. Task 4.3: position play and stopping the cue ball
**Built:** the success solver now also scores where the cue ball stops: shot length + 2 x "how hard the next shot
looks from there", with a heavy extra cost above 1.5 s so red shots stay short. Debug page: "Next shot from here"
continues the round (applies the shot with the rules code, then solves the next ball: red, black, red...).
**Check:** debug.html, Solver: Solve, then "Next shot from here" several times. Each result shows "Position for the
next shot (cost x.xx, lower = easier)". The black after a red should often be an easy one.
**Numbers:** see the table in docs/SOLVER.md "Position play". Default: reds unchanged (median 1.4 s), black within
1.5 s from 3% to 5% (6 reds) and from 8% to 27% (15 reds); more blacks are pottable after the red (33 -> 37 of 40,
25 -> 30 of 35). Without the 1.5 s cap the black is short (median 1.1 s, about 60% within 1.5 s) but the red gets long
(median 2.6 s). It is a trade-off in random layouts.
**Decisions to confirm (pace, your area):** weight 2 and "red capped at 1.5 s" (config `solver.position`). The
alternatives in the table move time from the black to the red. I suggest deciding after real rounds (task 5.x), where
the reds start next to the black.
**Not finished:** extra screw/stun samples for stopping the cue ball were not tried (they cost shot budget).

## 4. Task 4.5: flex chain and fallback log
**Built:** `solveSuccessFlex` follows RULES D.3: normal search, longer time (up to 2.2 s), (other pockets and other reds
are already in the normal search), wide search (more aims/powers/spins, cushion-first shots, plants), then RE-RACK
(D.4). Each step except "normal" returns a log entry (round code, step, target, step name, shots tried).
**Check:** no screen yet (the round flow uses it in stage 5). Test `tests/flex.test.ts`; report
`N=40 npx vitest run bench/flex.test.ts` (about 4 minutes).
**Numbers:** table in docs/SOLVER.md "Flex chain". Random layouts: RE-RACK 1 of 40 for reds, 4-7 of 40 for black.
The wide search is slow: up to 1.8 s on this PC (phones 2-4x slower).
**Decisions to confirm:**
(a) **"Over 2.2 s" step before RE-RACK.** With a strict 2.2 s limit, RE-RACK happened in 48 of 60 black layouts, and
almost always a longer shot existed. RULES D.4 says RE-RACK only when "no shot exists", so I added a last step: the
shortest shot found even if it is longer than 2.2 s (median about 3 s). Alternative: RE-RACK instead (much more often).
(b) "Other pocket" and "other ball of the same type" (D.3) are part of the normal search, not separate steps.
(c) The wide search budget (1500 shots) and its slowness: to revisit with the phone measurement.
**Not finished:** the lookahead (accept a pot only if the next step stays solvable) and the 100,000-shot soak test
(D.6): they need real rounds (stage 5).

## 5. Task 4.6: break-off library
**Built:** an offline generator (`npm run breaks`, about 16 minutes) that makes, for each level, 200 "red pottable"
breaks (at least 2 reds with an open pocket) and 200 "snookered" breaks (no red can be hit straight). The opponent
breaks from a random place in the D at the side of the pack (4.5-6 m/s). Breaks that pot a ball or do not hit a red
first are skipped. Every break is stored with its tested step-1 shots (RULES D.1): red pottable = a potting shot and
a plain miss; snookered = an escape that fails (hits a wrong ball or nothing). Files: `public/breaks/reds6.json`,
`reds10.json`, `reds15.json`. Seeded: the same seed always gives the same library.
**Check:** debug.html, "Break-off library": pick the level (Level buttons) and the kind, ◀ ▶ to browse, "Play break",
"Play step 1" (pot or failed escape), "Step 1 miss".
**Numbers:** per level 200 + 200 breaks; red pottable: 2965 / 2708 / 3669 breaks tried (6 / 10 / 15 reds),
snookered: 5868 / 5479 / 6461 tried; build time 5-6.5 minutes per level (about 16 minutes in all); files 0.5-0.7 MB.
Check page shortcut: debug.html?breaks=1&reds=15 opens the first stored break. Lookahead: a red
pottable break is kept only if the black can be potted after the step-1 red (this removed the step-2 RE-RACKs in real
rounds). `tests/breaks.test.ts` replays a break and its step-1 shots and checks them with the rules code.
**Decisions to confirm:** (a) "snookered" = no red reachable by a straight line (edge-of-ball hits are not counted);
(b) the break-off speed range and aim (config `breakLibrary.breakShot`); (c) breaks that pot a ball are thrown away
(the opponent never pots in the break); (d) the failed escape is a cushion-first or straight shot at a red that hits a
wrong ball first or nothing.
**Not finished:** the step-1 "snookered" shot is a simple failed escape; no variety yet (task 4.4 territory).

## 6. Task 5.1: round state machine (headless)
**Built:** `src/core/round.ts`: bet and level (locked after START), START (takes the bet), opponent break + automatic
step 1 from the library, SHOOT / CASH OUT from step 2, black picked automatically on colour steps (RULES B.3; a colour
choice can be passed), failure ends the round, clearance pays the top multiplier, RE-RACK pays the next multiplier.
Outcome first: success/failure of step k comes only from the round seed and k (stream "outcome"); the failure type
from its own stream ("failureType"). `src/core/physicsProvider.ts` connects it to the library and the solver.
**Check:** tests only (no screen; task 5.2 connects the buttons). `tests/round.test.ts` (fast fake shots) and
`tests/roundPhysics.test.ts` (6 seeded rounds with real physics, library and solver).
**Numbers:** "cash out after step k" returns 0.97 of the bet (+-0.03) over 20,000 rounds for k = 1, 3, 6 (the ladder
RTP); step-1 failures split 80/20 plain miss / snookered; later failures follow the config shares (60/25/10/5) within
2 points; the colour choice never changes the outcomes (300 seeds).
**Decisions to confirm:** (a) CASH OUT is allowed from step 1 on (before shot 2), as RULES A.3 says "from step 2";
(b) when the solver must use a D.2 fallback, the round's failure label is the one shown (e.g. MISSED instead of
IN-OFF); (c) the round code is "<level>-<seed>" for now; (d) the money is rounded to cents after every step.
**Not finished:** the colour-offer rules (B.3: which colours are offered) and the lookahead (next step must stay
solvable) are not in the state machine yet.

## Extra: lookahead and real-round measurement (part of the solver work, found while testing 5.1)
**Built:** the solver's lookahead (config `solver.lookahead`, planned since the start): the best candidate shots are
checked by solving the next step from where they leave the balls. A report of real rounds: `bench/rounds.test.ts`.
**Numbers:** docs/SOLVER.md "Real rounds". RE-RACK per success shot in real rounds: 6 reds 15% -> 3%; 15 reds 5%.
Success shots within 1.5 s: about 36-38%; median about 1.8 s.
**Important, not finished:** RE-RACK is still about 3-5 per 100 success shots in real rounds, while RULES D.6 allows 1
per 100,000. The cause is pots out of a cluster of reds (the solver does not find them in time). This needs its own
task before the game can be played for real (my suggestion: as part of 4.4 or a new 4.7).
**Decision to confirm:** none new (lookahead was already in the config).
