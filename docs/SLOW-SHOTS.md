# Slow shots and RE-RACKs (diagnosis only, 2026-11-26, solver 4.10 — nothing changed)
Data: the night-3 soak (9,000 rounds) played again on the same seeds with a per-shot log (bench/results/soak-n3slow).
The rerun matches night 3 exactly (172/158/105 shots over 3.5 s, 147/115/65 not last resort, the same 4 RE-RACKs).
Groups: bench/results/slow-shots.txt (node bench/slow-shots.mjs). RE-RACKs: bench/results/n3-rerack.txt.
Replay on the phone: ≡ menu, paste the round code (for example `reds6-5002888`), "Replay code", watch the step given.

## A. Shots over 3.5 s that are not last resort: 327 (0.6% of success shots)
Main cause, one sentence: the normal and wide searches find no natural shot within 2.2 s, so the solver takes the
shortest natural shot it has ("overLong"), and that is usually a full-power shot whose cue ball runs round the table.
- Fallback level: overLong 294 (90%), rescue 33. (Exhibition = last resort, not counted here.)
- Power: 243 at full power 6 m/s, 70 at 4.5-4.8 m/s, 14 below 4. Cue-ball cushions: 3+ in 212, 2 in 79, 0-1 in 36.
- Ball: colour 253 (black 172, blue 49, brown 28), red 74. Step: middle third of the ladder 213, early 69, late 45.
- Length: 3.5-4 s 74, 4-4.5 s 113, 4.5-5 s 60, over 5 s 80 (longest 5.69 s).

| Group | How many | Typical example (round code : step) | What happens |
|---|---|---|---|
| overLong, cannon | 99 | reds15-5002703:15 (red, 4.41 s) | pot plus a cannon, power carries the cue ball on |
| overLong, pack cannon | 69 | reds15-5002976:16 (black, 5.00 s, 6 m/s) | black at full power into the pack, 4 cushions |
| overLong, long pot | 69 | reds6-5002888:6 (black, 4.81 s, 6 m/s) | long black, cue ball runs 3 cushions |
| overLong, plain pot | 57 | reds15-5002851:33 (brown, 3.94 s) | colours in order: plain pot hit firmly |
| rescue (RE-RACK avoidance) | 33 | reds6-5002331:9 (red, 4.19 s, 4 cushions) | only shot that keeps the next ball pottable |

What a fix would cost (no fix made; the owner decides):
1. Playback only: play the end of a shot faster (when the pots are done and only the cue ball still rolls). No change
   to the solver, odds or shots; about half a day, then a phone check. It shortens what the player sees, not the
   physics, so the soak number stays; the pace rule would then need to be measured on playback time.
2. Solver: add "kill" shots (screw/stun at high power, softer powers on long pots) to the wide search. Changes shots,
   costs more simulated shots in that search (rough guess 20-30%) (longer THINKING), needs a paired soak like 4.11 (that one
   came out worse). Unknown gain.
3. Rule: let overLong shots over 3.5 s count as last resort, like exhibition (0.6% of shots). No code; owner decision.
4. Order: try exhibition before overLong when overLong is over 3.5 s. Goes against "realism first" (owner, task 4.7),
   and 108 exhibition shots are over 3.5 s too, so it may not help.

## B. The 4 RE-RACKs (6 reds, step 11, the last red): ONE shared cause
Codes: reds6-5000265, reds6-5000787, reds6-5002931, reds6-5002489 (play to step 11).
- In all 4 the last red is the rack's apex red, never moved, still on its spot (0, 0.947) touching the pink (2 mm gap),
  pink and black on their spots. 3 of the 4 are identical down to the cue ball (-0.045, 1.577), behind the black.
- Why no shot: the top corners are the only pockets with a clear line, but the cue ball would have to stand where the
  pink is to pot into them; every other pocket is behind the pink. Plants via the pink push the red to the top cushion.
  The game's search (1,540-2,020 shots) and a 10x larger wide/exhibition search find nothing.
- How it happens: after the break-off a red is frozen to the pink in 2,013 of 3,000 rounds; usually a later shot knocks
  it free. In these 4 the solver potted the other 5 reds first. The look-ahead checks one step ahead, so by the time
  it sees "last red locked" every red pot already leaves it locked.
- RE-RACK is a legal end (RULES D.4, paid; included in the RTP). Rate: 4 of 3,000 six-red rounds (0.13%), 0 in 10/15 reds.
What a fix would cost (no fix made): (a) solver: when a red is frozen to a colour and 2-3 reds are left, prefer a
shot that moves it (pack cannon into it); changes shots, needs a paired soak; small, targeted. (b) a two-step
look-ahead: several times the solve work (rough guess), likely too slow for the phone. (c) break library: not possible (2/3 of entries).
(d) accept it as is: 0.13% of six-red rounds, already paid by the rules.

## C. Night 4: option 1 built (faster end of a shot, playback only) — switch OFF by default
Code: src/view/fastEnd.ts; config shot.fastEnd (rate 2.5x, ease 0.4 s, not when < 0.5 s would remain); dev panel
"FASTER SHOT END". Rule (same for success and failure): the speed-up starts only when every ball the shot pots is down,
the object ball has stopped or dropped, and the cue ball has touched a ball. There are no game sounds yet, so nothing
to keep in sync (the mute switch exists; future sounds must follow the playback clock).
Measured on the night-4 v2 soak (1,000 rounds per level, solver 4.10, bench/results/soak-n4base/night4.txt):

| Level | Shots | OFF median / 90% / over 3.5 s / longest | ON median / 90% / over 3.5 s / longest | Success not last resort over 3.5 s OFF → ON |
|---|---|---|---|---|
| 6 reds | 6,530 | 1.60 / 2.22 / 57 / 5.56 s | 1.30 / 2.10 / 7 / 4.20 s | 45 → 0 |
| 10 reds | 7,880 | 1.57 / 2.18 / 57 / 5.69 s | 1.28 / 2.05 / 12 / 4.30 s | 30 → 0 |
| 15 reds | 9,208 | 1.61 / 2.18 / 45 / 5.51 s | 1.27 / 1.99 / 13 / 4.64 s | 21 → 0 |

(Here "last resort" = exhibition or rescue.) Failure shots are not sped up at all (their object ball rolls until near the end, so less than 0.5 s is left): the
ON shots still over 3.5 s are failures (5 / 7 / 8) and a few last-resort successes. About half of all shots are sped up.
