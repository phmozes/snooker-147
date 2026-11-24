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
