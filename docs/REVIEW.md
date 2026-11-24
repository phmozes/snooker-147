# Review list (session 2026-11-24 evening)

The previous review list (tasks 4.2-5.1, approved) is in git history (commit 5233022).

## 1. Small fixes
- **Work cap per decision.** "850 of 250" happened because the 250 is only the first search. After it, the lookahead
  checks up to 6 of the best shots: each costs 1 shot (to see where the balls stop) + up to 120 shots (solving the
  next step from there). Those were counted, but the line showed only the 250. Now every simulated shot is counted
  (also the failure fallbacks, which were not counted before) and the soft-foul fallback has its own cap (40). Fixed
  caps from the config, the same on every device (`shotCaps()` in src/core/solver.ts):
  normal search 976, wide search 2,226, spray 2,000 -> success 5,202; failure 564; one decision (both) 5,766.
  debug.html shows "N simulated shots" with the cap, and the cap per decision. Tests check counts never pass the caps.
- **Header** on debug.html now names the real target ("black due" after a red).
- **Payout test**: cash out at every step of every level for every bet 1-100 = round(bet x multiplier of that step);
  same for RE-RACK and clearance (tests/round.test.ts).

## 2. Task 5.2: game page connected to the round (gray-box)
**Built:** START -> quick re-rack (0.4 s) -> the opponent's break-off from the library -> step 1 plays itself -> SHOOT /
CASH OUT (with the exact amount) -> end line in the ladder strip ("WON 12.70 · x1.27", "MISSED · LOST 10.00",
"RE-RACK · WON ... · x...", "CLEARED · WON ..."), the balance counts up, the bet area returns after 1 s. Clearance:
big message on the cloth, max 3 s, tap to skip. Black is picked automatically. Balls stay until the next START.
The next shot is solved for both outcomes (success first, then the failure, always the same order) in a Web Worker
while the player decides; SHOOT uses the answer, or shows "THINKING…" until it is ready.
**Developer menu:** "Live game" or the static screens D/A/C; round code; a seed field (seed or "reds6-12345") +
"Use" so the next START replays that round; "Replay this round"; "Balance back to 1000"; the last shot's length,
compute time, shots used, and whether SHOOT had to wait; fallback count (details in the browser console).
Address option: `?seed=reds6-12345`.
**Checked:** headless Chrome played 10 rounds (cash out, MISSED, SNOOKERED, up to step 9): no errors, the balls drawn
match the rules state after every shot. Test: pre-solved rounds equal rounds solved at SHOOT time.

**Decisions for you (my choices, easy to change):**
- The bottom area has one fixed height in every state, so the table does not change size between START and SHOOT
  (screen A's table is 30 px smaller than in the mockup).
- Failure end line says "<LABEL> · LOST <bet>".
- Balance is not saved between visits yet (always 1000 after reload).

**Open problem (the solver task you postponed):** in my headless test on this PC, about half of the success shots
needed the wide search, 2-4 s of work. When you press SHOOT quickly the game waits ("THINKING…" up to about 2.5 s here; slower on a phone). The
developer menu shows it per shot. This is the same root cause as the RE-RACK rate.

## 3. Task 4.7: natural shots (realism first) - partly reached
**Built:** every shot gets a label (plain pot, pot with cannon into the pack, pot with cannon, long pot, cushion-first,
plant, double, kiss, far pocket, fluke; failures: attempt that misses, soft foul, gentle tap; step 1: from the
library) and a naturalness score; the solver prefers natural shots and plays exhibition shots only as a last resort
before RE-RACK. RULES B.3 changed as you decided (black, else pink, else blue; RULES.md updated, tests show the
pick never changes outcomes or money). Failures are attempts at a sensible pot at medium power.
Developer menu: the last-shot line shows the label; "Mark this shot as weird", "Copy list" (if the phone does not
allow copying, the list appears in a box to select), "Clear list". The list stays in the phone's browser.
I replay listed shots with `SHOTS="reds6-123:4" npx vitest run bench/replay-shot.test.ts` (same solver version).
**Numbers:** docs/SOLVER.md "Task 4.7". Natural 65% -> 71-73% (target 90%: NOT reached), exhibition 22-26% -> 7%
(target 2%: not reached), RE-RACK 0.7-1.8% -> 0 in 338 success shots, solve time median about 1 s -> 0.14-0.19 s.
**Open:** reds still packed after the black (step 3/5) and long pots after a colour. Next: a planned pack-cannon search.
