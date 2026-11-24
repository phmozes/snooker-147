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

## 4. Flag button, break library, task 4.7 second part
**Flag (developer only):** top-left corner of the table area. One tap marks the last shot played; it is appended to
docs/WEIRD-SHOTS.md on the PC (dev server endpoint in vite.config.ts) and kept on the phone as a backup.
**Your two marked shots (replayed: same shots, 3.43 s and 1.78 s):**
- reds6-1145075499 step 9: two reds left by the pink, the pink between the cue ball and both: no direct pot at all.
  The flex chain's last step before RE-RACK (exhibition search) played a cushion-first. The real fault was step 8:
  the colour left the cue ball behind the pink.
- reds6-2988766261 step 3: after the black the cue ball stopped by the blue, the reds still in two tight groups: every
  direct pot blocked or too thin, so again the exhibition step. Fault: the break left the reds packed and the black
  did not open them. Now: breaks must open the pack, and a colour that leaves a poor red runs the pack search.
**Break library:** 371 of 1,200 breaks moved a baulk colour or the blue more than 2 cm (up to 1.9 m). All 1,200 were
rebuilt with three rules (colours still, natural step 1 + black + next red, pack opened).
**Numbers per level:** docs/SOLVER.md "second part". 10 reds reaches the exhibition target (1.7%) and nearly the
natural one (89%); 6 reds 85% / 4%; 15 reds 83% / 7% with 2 RE-RACKs in 177 shots. Targets not fully reached.

## 5. Strict naturalness, two shots ahead (task 4.7 third part)
**Your marked shot reds15-3804251161 step 10** (black, "plain", 5.22 s): under the strict definition NOT natural
(over 2.5 s; the cue ball rolls 7.8 m with 4 cushions). Why it was chosen: no colour had a natural shot within 2.2 s,
and the flex rule "a natural-looking pot, even long, before an exhibition shot" took the shortest plain pot: a black at
full power. Now that pot pays the unnatural-play cost and the two-shot plan avoids such positions.
**RACKING:** the hint line at START now says RACKING.
**Pace:** your decision is in docs/SPEED.md and NOW.md; reported for reds and colours separately (docs/SOLVER.md).
**To confirm:** the auto colour now treats black as natural only if it also leaves a red (else pink, then blue). Only
the snooker score changes. Switch: config `solver.natural.autoColourNeedsNextRed`.
**Numbers:** docs/SOLVER.md "third part". Natural 85 / 91 / 84%, exhibition 3.2 / 1.3 / 2.8%, RE-RACK 0 in 1,124.

## 6. Night 2026-11-24 (overnight run; summary in docs/NIGHT-REPORT.md)
Measurements: bench/results/night/*.sum (60 real rounds per level, strict definition; script run.sh, summary sum.mjs).
Phase 1 (solver 4.8a), before -> after, 6/10/15 reds:
- black shots from behind the black 18.9/14.6/13.9% -> 8.9/4.0/4.5%; reds into baulk-end corners 8.7/4.2/9.7% ->
  5.6/4.8/5.1% (the rest are reds already in the baulk half); median cut 19/24/23 -> 19/21/19 deg; cuts over 50 deg
  3.5/1.6/3.5% -> 3.8/4.2/3.5% (not better: mostly fallback shots); natural 85/91/84.1 -> 84.7/89.4/85.2%.
- First try gave RE-RACKs (3 at 6 reds). Causes found: (a) the new costs could make a playable next pot look like
  'no shot' (fixed: they only rank playable pots); (b) reds6-276/395 step 9: two reds glued behind the pink spot, no
  pocket can take them, and the solver potted the last free red (fixed: lockedCost + rescue step). RE-RACK 0 again.
- Your four marks: see the top of docs/WEIRD-SHOTS.md (2 fixed, 1 partly, 1 still happens but milder).
- B.3 now needs a natural red after the colour (shot.nextNatural), as you confirmed.
Phase 2 (6 and 15 reds, 60 rounds each, strict; files bench/results/night/r*.sum):
- Fix first: a shot that leaves only locked reds is not 'good' (wide search and rescue look for a cannon that frees
  them). New base (base2): natural 84.4 / 85.7%, exhibition 2.9 / 1.8%, RE-RACK 0.
- Round 1, cannon and long costs 1.5/2.0 -> 3/3: natural 84.4 / 87.1%, exhibition 1.9 / 1.4%, RE-RACK 0. KEPT (4.8b).
  (Before the locked-reds fix the same change gave 2 RE-RACKs at 6 reds.)
- Round 2, plan a red two shots ahead (solve black / pink / blue after each candidate red pot, `planReds`):
  natural 87.9 / 87.8%, exhibition 1.3 / 1.4%, cuts over 50 deg 2.5 / 2.5%, RE-RACK 0. KEPT (4.8c).
- Round 3, unnaturalPlayCost 3 -> 5: natural 87.6 / 88.5%, exhibition 1.3 / 1.4%. Mixed (6 reds worse). NOT kept.
- Round 4, wide search also after a red pot that leaves a poor colour (`wideForPoorColour`, left false):
  natural 87.6 / 88.9%, exhibition 1.6 / 1.4%. Mixed (6 reds worse). NOT kept. Two rounds without gain: phase stopped.
- Targets not reached: natural 90% (87.9 / 87.8), exhibition under 2% reached (1.3 / 1.4), pace median 1.8 s reached
  (about 1.55 s), 90% within 2.5 s reached (97%), "no shot over 3.5 s" not reached (1 and 4 shots, see NIGHT-REPORT).
