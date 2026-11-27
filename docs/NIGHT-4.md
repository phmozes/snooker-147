# Night 4 report (2026-11-26/27) — all five parts done, nothing pushed
Commits on master only. Dev server on port 5181. npm test: 27 files, 270 tests green. No p, multiplier or other
existing config number changed; new numbers only for the new switches. Everything is drawn in code.

## Summary for the owner
| Part | Result |
|---|---|
| 1 Look in the game | DONE. Look A + T1 pockets in the game, ONE shared file (src/view/tableLook.ts) also used by docs/pocket-options.html (its picture is pixel-identical to before). Old gray box behind a dev switch ("TABLE LOOK"). Shots unchanged: 916 old rounds replay identical. Phone frame time +7.4% (rule +20%). Pocket pictures: see 1c. |
| 2 Generator v2 | DONE. HMAC-SHA256. 200M fairness check PASSED. Old codes replay exactly. New soak baseline below. |
| 3a Free replay | DONE. A replay takes no bet and pays nothing; REPLAY label; no money amounts. Tested. |
| 5 Phone layout | DONE. Checked at 360x640, 390x844, 412x915: nothing cut off, no overlap, no scrolling. |
| 4 Cue | DONE. Shared src/view/cue.ts (cue-options.html imports it; picture pixel-identical). ON by default. Adds 0.25 s per shot. |
| 3b Faster end | DONE, switch OFF. Removes every success shot over 3.5 s that is not last resort (table in docs/SLOW-SHOTS.md). |
| 3c Position play 4.11p | Built, switch OFF. Paired soak: FAIL (more fallback shots, more shots over 3.5 s). Marks: 2 fixed, 4 better, 6 same. |

## Part 1: the approved look in the game (visual only)
a. One shared piece of code: the table drawing (cloth, rails, cushions, T1 pockets, leather, net, light) moved from the
   mockup into src/view/tableLook.ts. docs/pocket-options.html imports it (no copy); screenshot before/after: 0 pixels
   differ. src/view/table3d.ts draws it (config view3d.look = 'club'); the old gray box stays behind the dev panel switch
   TABLE LOOK (kept per device). Balls 1.4x with the mockup's ball material. Camera C as before. No text on the cloth.
b. Physics, solver and outcomes unchanged: 916 v1 rounds recorded BEFORE any change (the 16 owner marks, the 300 rounds
   of bench/roundCode, 200 natural rounds per level) replay frame-by-frame identical afterwards (bench/results/night4/
   v1-compare.txt: 302 + 304 + 310 identical, 0 different). A source test (tests/visualSwitches.test.ts) checks that no
   file in src/core imports view or page code.
c. Seen vs physics: the drawn hole edge of all six pockets IS the physics drop circle (bench/results/night4/
   hole-vs-drop-circle.txt, difference < 1e-15 m) and the drawn jaws lie on the physics jaws (self-check in the code,
   throws otherwise). A potted ball now falls into the hole (keeps its speed, drops, and goes dark as it sinks; before it
   just vanished). Pictures with the dev test panel (forced Success / Rattle / In-off, playback frozen at the jaw touch
   or 0.12 s after the drop): bench/results/night4/pockets/ (+ log.txt). See the log for which pockets were caught:
   the solver rarely chooses the near (bottom) and some side pockets, so not every pocket/outcome pair turned up.
   Found and fixed on the way: a ball dropping at a middle pocket looked as if it stopped at the mouth (seen from above a
   sinking ball hardly changes) -> it now darkens as it sinks.
d. Phone smoothness (bench/results/night4/frame-time.txt; 390x844, DPR 2, Chrome 4x CPU throttling, the same 3 rounds,
   break-off + step 1): mean frame interval gray 18.9 ms, club 20.3 ms = +7.4% (rule: at most +20%). Median 16.7 ms
   both. But frames over 33 ms: 41 gray vs 70 club of about 1,800, so check on the real phone; if it stutters, the first
   things to cut are the lamp shadow map (config view3d.club.shadowMap 2048 -> 1024) and the pixel ratio (maxPixelRatio).

## Part 2: generator v2 (cryptographic)
1. u = first 52 bits of HMAC-SHA256(key = seed as 4 bytes, msg = `stream#k`) / 2^52, for ALL streams. Own SHA-256
   (src/core/sha256.ts), tested against FIPS/RFC 4231 vectors and Node's crypto; u itself tested against Node's HMAC.
   docs/SERVER-OUTCOMES.md: the server will use the same function with a 32-byte seed.
2. Codes: new rounds `reds6-v2-48213-BKPK-C7`; without `v2` = v1, replayed with the old generator (streamValueV1).
   Proof: all owner marks + the 300 roundcode rounds replay identical (above); 100 new v2 rounds per level replay
   identical from their codes (after3c-compare.txt). The weird-mark list and the phone cost lines accept v2 codes.
3. Fairness, v2 only, 200,000,000 rounds per level, seeds 1..200M (bench/results/rtp-rng-v2-200M.txt): **PASS**.
   Worst |z|: cash-out 1.44 / 1.84 / 1.50, conditional 2.07 / 2.37 / 3.67, single 2.44 / 2.64 / 2.66. Cash-out steps
   above/below the formula: 17/1, 12/14, 11/25. A perfect generator fails this exact rule in 1.28% of runs (simulated).
   Honest note: a 1.2M speed test (seeds 1..1.2M, part of the 200M) ran first and its summary was looked at.
4. New soak baseline (v2, solver 4.10, 1,000 rounds per level, bench/results/soak-n4base/night4.txt) next to night 3
   (v1, 3,000 rounds per level):
   | Level | stuck | off table | RE-RACK | success vs p worst z | over 3.5 s (not last resort) | night 3 per 1,000 |
   |---|---|---|---|---|---|---|
   | 6 reds | 0 | 0 | 2 | 2.12 | 52 (50) | RE-RACK 1.3, over 3.5 s 57 (49) |
   | 10 reds | 0 | 0 | 0 | 2.47 | 50 (37) | 0, 53 (38) |
   | 15 reds | 0 | 0 | 0 | 3.00 (exactly at the 3 sd edge) | 37 (21) | 0, 35 (22) |
   Pace unchanged: red median 1.50/1.48/1.53 s, colour 1.57/1.56/1.59 s. Solve times over 10 s happened only because
   the PC ran 30 jobs at once.
5. docs/FAIRNESS.md: how u is made, v1 vs v2, the v1 50M failure, the v2 200M result.

## Part 3
- 3a Free replay: Round.free: START takes no bet, CASH OUT / clearance / RE-RACK pay nothing (balance 990 stays 990),
  works even with a balance below the bet. REPLAY label on the table; CASH OUT shows "x1.42 · REPLAY"; the end line says
  "REPLAY OVER · ... · NO BET". Tests: tests/round.test.ts (900 rounds, every end type), tests/gameLoop.test.ts.
- 3b Faster end: built, OFF. Results in docs/SLOW-SHOTS.md section C. With it ON: median shot 1.60 -> 1.30 s, success
  shots not last resort over 3.5 s: 45 / 30 / 21 -> 0 / 0 / 0. Failures are never sped up (too little time left).
- 3c Position play 4.11p (src/core/solver.ts, config solver.natural.pos411p): black / pink and black-half reds into
  black-end corners, cue ball on the inner side. OFF = identical shots to 4.10 (600 rounds, 200 per level, replayed
  identical after the change). Paired soak verdict (bench/results/night4/pos411p-verdict.txt): **FAIL**.
  The rule was written down and committed before the ON soak started (commit 8ff1457, 02:01; ON soak started 02:02):
  stuck 0; RE-RACK not higher; success-fallback % not higher by more than 1 point; shots over 3.5 s (not last resort)
  not higher; THINKING median not higher by more than 10%, measured as simulated shots per success solve (the PC load
  makes milliseconds unreliable; ms shown for information).
  | Level | stuck | RE-RACK | fallback % | over 3.5 s not last resort | THINKING (shots per solve) |
  |---|---|---|---|---|---|
  | 6 reds | 0 / 0 | 2 / 1 | 54.6 / 57.4 FAIL | 50 / 52 FAIL | 549 / 544 |
  | 10 reds | 0 / 0 | 0 / 0 | 53.0 / 57.0 FAIL | 37 / 47 FAIL | 614 / 612 |
  | 15 reds | 0 / 0 | 0 / 0 | 56.2 / 56.8 | 21 / 28 FAIL | 554 / 564 |
  Owner marks with 4.11p ON (bench/results/night4/marks-on.txt vs marks-off.txt; OFF replays exactly what the phone showed):
  - reds6-1527464874:6 SAME: still a long blue (now 1.62 s).
  - reds10-3813538593:8 SAME: the same 3.30 s blue miss (failures ignore position).
  - reds10-483330344:3 BETTER: red into the top-left corner, 2 deg, 1.01 s (was into the middle pocket).
  - reds10-483330344:6 BETTER: now the black into a black-end corner (was a pink into the middle), but it is a 2.18 s pack cannon.
  - reds10-483330344:8 BETTER: plain pink into a black-end corner (was a pink pack cannon into the middle), 2.02 s.
  - reds10-483330344:10 SAME: pink now into a black-end corner (no longer the middle pocket again) but as a pack cannon.
  - reds15-640290895:10 SAME: identical pink pack cannon.
  - reds15-942643257:15 SAME: still a red plain miss (2.09 s, a different red).
  - reds15-3132621162:17 FIXED: plain red, 37 deg, 1.83 s (was a 56 deg cushion-first last resort, 2.91 s).
  - reds15-3132621162:19 FIXED: plain red into a middle pocket, 1.23 s (was a 65 deg cannon, 2.94 s).
  - reds15-2764519739:2 SAME: identical black pack cannon (step 1 comes from the library).
  - reds15-136485470:3 BETTER: an in-off of 2.12 s on a different red (was 4.61 s), only because earlier shots changed.
  The switch stays OFF; the owner decides after a phone check (dev panel "POSITION PLAY (EXPERIMENT)").

## Part 4: the cue
- src/view/cue.ts holds the cue (shape, ash/ebony skin, brass ring with the name, shadow, motion and timing) and the
  raised-butt rule; docs/cue-options.html imports it (and the table look). Picture before/after: identical except the
  POT/MISS caption the page alternates.
- In the game: after SHOOT and on the automatic step 1 (not on the break-off): appears + one stroke = 0.25 s, then it
  follows through and fades while the balls roll. Direction = the planned shot's cue direction; elevation from the
  layout; the visible length is shortened (never skipped) if it would cover the object ball or the pocket that ball is
  sent towards (worked out from the layout and the direction only). Dev switch CUE (on). Pictures: bench/results/night4/cue/.
- Outcomes identical ON vs OFF: the cue lives only in the page and the 3D view (tests/visualSwitches.test.ts); the shots
  themselves are made in src/core and replay identical (Part 1b). Not run as a separate 200-round browser test.
- Real pace with the cue ON vs OFF (v2 soak, +0.25 s per shot): red median 1.55 -> 1.80 s, 90% 2.17 -> 2.42 s;
  colour median 1.64 -> 1.89 s, 90% 2.25 -> 2.50 s (6 reds; 10 / 15 reds in soak-n4base/night4.txt). This breaks the
  pace target (median <= 1.8 s, 90% <= 2.5 s) at the edge; with 3b ON it comes back under (playback median 1.30 s).

## Part 5: phone layout
Top bar: BACK (does nothing yet, TODO lobby), ≡, centre slot on the screen's centre line (between rounds the red balls
6 / 10 / 15 with a gold ring on the chosen one; during a round the big multiplier), mute (kept per device; there are
no game sounds yet), balance right-aligned (font shrinks; balls go to 40 px on narrow phones). Table edge to edge,
same size in every state (checked). Ladder "UP TO x25" between rounds. One bet row (- BET + 1 5 10 50), START; in a
round: status line, CASH OUT, SHOOT. Footer: "147 · DEMO · Round <code> · <clock>" and "Rules · PLAY RESPONSIBLY";
the RTP text moved into the Rules box (RTP per level). Pictures and the automatic check: bench/results/night4/layout/
(check.txt: all states ok at 360x640, 390x844, 412x915; a balance of 1,234,567.89 shrinks to 9 / 11 / 13 px).

## Extra (report only, no fix)
- Newest mark reds15-136485470:3 (in-off, 4.61 s): the in-off search accepts the cue ball going into ANY pocket and
  keeps the shortest in-off found; it stops early only at <= 2.2 s. Here nothing that short was found in its 250 tries,
  so it used a 4.5 m/s shot at red11 (aimed at the middle-left pocket) whose cue ball crosses the table into the
  middle-RIGHT pocket while the red runs round the table. There is no length limit on failure shots. Fix ideas (owner
  decides): cap failure length (e.g. 3.0 s) with a fallback, or require the in-off into the aimed pocket.
- Failure types (v2 soak, share of failures): plain miss 59-60%, jaw rattle 25-27%, in-off 10%, foul 4-5% (all levels).
  Failure length: median 2.14-2.17 s, 90% 2.58-2.89 s, longest 3.80 / 4.30 / 4.64 s; the longest are in-offs and rattles.

## Not done / open
- Pocket pictures: not every pocket x outcome appeared in the automatic run (see pockets/log.txt); the geometry check
  covers all six.
- The cue ON/OFF "200 rounds per level" proof is by code separation + the core replays, not a browser run.
- Frame time measured on the PC with throttling, not on a real phone.
