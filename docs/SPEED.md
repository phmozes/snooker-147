# Speed and pace (task 1.4)

## Pace targets (owner decision 2026-11-24, replaces the old 1-1.5 s per shot target)
A full step of about 2.1 s on average is fine. In shot length (until every ball stops), for reds and colours separately:
median 1.8 s or less; 90% of shots 2.5 s or less; no shot over 3.5 s except the last-resort step before RE-RACK
(exhibition / spray search). Realism is not traded for speed: a natural 2.2 s shot beats an unnatural 1.2 s one.
Measured with `bench/natural.test.ts` ("pace" in each row). The solver's own pace numbers (shot.maxDuration 1.5,
maxDurationFlex 2.2, position.overFrom 1.5) are unchanged so far.
Night 2026-11-24, solver 4.8d (60 rounds per level, all success shots): median 1.56 / 1.48 / 1.53 s, within 2.5 s
98.7 / 98.4 / 96.8%, over 3.5 s 0 / 1 / 3 (6 / 10 / 15 reds); bench/results/night/final2.sum.

Run again with `npm run bench` (about 1 minute). Numbers below: this PC, Node, 2026-11-24.

## Speed: computer time per simulated shot (target under 1 ms)
Random full-rack shots (cue ball anywhere, hit at a red, 1-6 m/s, random spin), run until every ball stops.

| friction | 6 reds | 15 reds | shot length (game time) |
|---|---|---|---|
| 0.015 realistic cloth | 2.27 ms | 3.34 ms | 6.3 s |
| 0.030 | 1.13 ms | 1.90 ms | 4.1 s |
| 0.050 | 0.78 ms | 1.28 ms | 3.0 s |
| 0.080 | 0.52 ms | 0.87 ms | 2.2 s |
| 0.120 game | 0.41 ms | 0.67 ms | 1.7 s |

Before this task the same shot at 0.12 / 15 reds took 10.6 ms. Fixes: plain square roots instead of `Math.hypot`
(slow in V8), cushion/jaw/pocket tests only for balls near the edge, ball pairs only where a ball moves.
Same physics: every existing test gives the same result. Computer time grows with the shot length, so low friction
costs more. Phones are slower than this PC (expect 2-4x).

## Pace: quickest potting shot per layout
30 random layouts (one red, cue ball, the pocket with the smallest cut, cut up to 45 degrees). Every power
(0.3-6 m/s, step 0.1) and every solver spin is tried; the quickest shot that pots the red and keeps the cue ball
on the table counts. "Settle" = until every ball stops.

| friction | median settle | red drops at | settle within 1.5 s | settle at 1.3x playback |
|---|---|---|---|---|
| 0.015 realistic cloth | 2.62 s | 1.35 s | 13% | 2.01 s |
| 0.030 | 1.61 s | 1.24 s | 39% | 1.24 s |
| 0.050 | 1.28 s | 1.18 s | 65% | 0.98 s |
| 0.080 | 1.06 s | 1.04 s | 74% | 0.81 s |
| 0.120 game | 0.88 s | 0.79 s | 86% | 0.68 s |

Finding: on realistic cloth the red is down in time, but the cue ball keeps rolling for seconds afterwards.

## Ways to keep shots short (for the owner to choose)
- A. Solver picks the quickest shot (power and spin). Already in the numbers above; costs nothing visually.
- B. Light game cloth 0.05 (3x real instead of 8x at 0.12): balls still glide; median 1.28 s.
- C. Playback 1.2-1.3x (`shot.playbackTimeScale`): everything looks a little fast.
- D. Realistic cloth, and the shot ends for the player when the red drops; the cue ball rolls on while the buttons
  come back. Needs a rules change (today: shot ends when the cue ball stops).
Recommendation: A + B, with C at 1.2x only if needed. D is the most realistic, but it is a rules decision.

## Follow-up checks (owner questions, 2026-11-24)
- Speed at 0.05 (three runs): 6 reds 0.79-0.91 ms (under 1 ms), 15 reds 1.25-1.30 ms (over 1 ms).
- "Pottable 22-23 of 30" is a limit of the pace study, not of the physics: it tries ONE pocket (smallest cut) and
  aims only at the mouth centre. Retrying the 8 failed layouts with every pocket and aim points across the mouth
  found potting shots for all 8 (0.12 and 0.015). Task 4.1 must test "every success outcome finds a shot" on many
  layouts, with the flex order as the backup.
- Break at 0.12: energy 0.02 s after the cue ball reaches the pack is identical at 0.015, 0.05 and 0.12
  (26.1 of 36 left, 9.4 in the object balls). Only the roll-out afterwards differs: reds moving more than 10 cm
  are 10/15 (0.015), 5/15 (0.05), 3/15 (0.12). So the closed pack is the friction value, not a bug.

## Decision (owner, 2026-11-24, provisional)
- Chosen: A + B. The solver picks the quickest valid shot; cloth friction 0.05 is the config default.
- Not chosen: D. A shot ends when all balls stop. Playback 1.2x (C) is not set; revisit with real solver shots.
- 1 ms per shot is a guide. No further physics optimisation now; measure the solver's 150 ms budget on a phone later.
- Final pace decision when real solver shots can be watched.
