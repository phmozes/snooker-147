# Weird shots (marked on the phone with the flag button)

Replay: `SHOTS="<round code>:<step>" npx vitest run bench/replay-shot.test.ts` (needs the same solver version).
RTP option 3c (2026-11-25) changed p, so outcomes of old seeds changed slightly: marks made before 2026-11-25 14:00
replay on the old p with `OLDP=1` added to the command.
Break library rebuilt 2026-11-25 ~15:00 (pink/black limit): marks made before that replay with
`LIB_DIR=bench/results/breaks-pre410` added. Solver 4.10 from 2026-11-25 ~16:00.

Night review 2026-11-24 (solver 4.8a, positional play around the black; details in docs/REVIEW.md "Night"):
- reds10-983480511:7 (long red to a baulk-end corner): broke rule 1/5 (the pink before left the cue ball 1 m away).
  Now a plain natural pot (2.6 m in all, 27 deg); still a baulk-end corner, but this red is in the baulk half (allowed). PARTLY FIXED.
- reds10-983480511:10 (black, 4.5 s full-power pack cannon): broke rule 4 (wrong side of the black for the next red).
  Now 25 deg, 1.0 m, no smash, but it still moves the pink, so not strictly natural. STILL HAPPENS (milder).
- reds10-983480511:15 (red, 66 deg thin cannon, 4.1 s): broke rule 3 (the pink before left a thin cut). Now 28 deg plain pot. FIXED.
- reds15-1877393965:11 (long red to a baulk-end corner from behind the black): broke rules 1 and 2 (the black before left
  the cue ball behind the black). Now the cue ball stays in front and the red goes in a middle pocket. FIXED.

Review 2026-11-25 (solver 4.9, old p, OLDP=1; details bench/results/marks-diag.txt; no solver change yet):
- reds15-3634511757:10 blue long: after the step-9 red (plain) the cue ball sat near the black; black only by a hard pack
  cannon that leaves no red, pink had no path at all, so the pick fell to the blue (in time, red reachable). Cause: step-9 position.
- reds15-3634511757:11 red cannon 53 deg: yes, the long blue left the cue ball mid-table with no red open (the blue's lookahead
  already said "next red not natural"; it was the only colour that kept a red at all).
- reds15-2927609577:8 blue long: black only by a pack cannon that disturbs the pink (not natural), pink no path; blue long, next red natural.
- reds15-2927609577:15 red cannon 49 deg: follows a natural pink at step 14 (not the blue) that left no red open.
- reds6-362783338:5 red jaw rattle: 16 deg cut, 1.25 m to the red, 0.48 m to the middle pocket, slow (1.9 m/s): a believable
  near-pot by the numbers. The step-4 black left the cue ball behind the black, so the only natural success was a 39 deg red.

Task 4.10 (solver 4.10, 2026-11-25; replays on the old library, old p where marked):
- reds15-3634511757:10-11: FIXED. Step 9 red now to a middle pocket; step 10 a plain blue to a middle pocket; step 11 a plain red.
- reds15-2927609577:8 and :15: NOT CHANGED. Step 7: all checked finishes are the same red, none leaves a natural black or pink.
- reds10-165926990:14: FIXED. Step 13 a different red; step 14 a plain black (no long blue, the yellow stays); step 15 a plain red.
- reds15-912620600:6 and :9: NOT CHANGED. Step 5: all checked finishes are the same red, none leaves a natural black or pink; step 9 (plant) follows a black at step 8, not the blue.

Night 3 review (2026-11-26, solver 4.10, current p and library; every mark replays exactly: same type and length.
Details: bench/results/n3-marks-replay.txt, n3-marks-diag.txt, n3-diag.txt). No code change in this part.
- reds6-1527464874:6 blue long (2.0 m pot to a baulk corner): the step-5 red (stun, 0.14 m) left the cue ball at the top-left,
  level with the black: black only 3.7 s (over 2.5 s), pink no shot, so the pick fell to the blue. One red open only.
  Breaks: long colour (4.10 colourLong) caused by the red's position. Cause: step-5 position with a single red.
- reds10-3813538593:8 blue plain miss, 3.3 s: step-7 red left the cue ball at the top-left (0 reds with an open pot);
  black natural but no red after it, blue long, also no red after it; the pick took the blue. The miss is a long blue
  (spot to baulk corner, 2 cushions, ends 0.30 m from the pocket) at 2.5 m/s. Breaks: pace (over 2.5 s) and a long
  colour attempt. Cause: the step-7 position; the miss search found nothing shorter than 3.3 s on that one pot.
- reds10-483330344:3 / 6 / 8 / 10: every shot is "natural" by the checks; the pattern is the problem. Reds 5, 7 and 9 go
  into the top-left corner and leave the cue ball level with the black on the left (y 1.1-1.4): the black is then a
  pack cannon (6), 2.5 s (8) or leaves no red (10), so the pink goes into the middle-right pocket three times. Step 3
  is a red into the same middle pocket. Breaks no coded rule; looks repetitive. Cause: red position after the black.
- reds15-640290895:10 pink pack cannon into a middle pocket: step-9 red ran 1.2 m off a cushion to (0.53, 1.11), right of
  the black: black plain but leaves no natural red, so pink, whose cue ball then runs into the pack. Cause: step-9 position.
- reds15-942643257:15 red plain miss, 2.3 s: after the step-14 blue (cue ball mid-table left) only one red was open, a
  41 deg cut along the left cushion. The red runs up the cushion and stops 0.14 m short of the corner (soft, 1.9 m/s):
  a believable under-hit by the numbers. No rule broken; it looks feeble rather than wrong.
- reds15-3132621162:17 red cushion-first 56 deg (last resort, 2.9 s) and :19 red cannon 65 deg (2.9 s): the step-16
  blue (cue ball next to the blue after the step-15 red) screwed back to (0.09, -0.45), far from the reds, 0 reds
  open -> step 17 only by the exhibition search. Step 18 (not marked) is a black cannon of 4.4 s with the cue ball
  running 6.5 m over 4 cushions, which left :19 a 65 deg cannon. Breaks: pace (over 3.5 s at 18) and rule 1/5 (a
  colour leaving the cue ball far from every red). Cause: step-16 blue position.
- reds15-2764519739:2 black pack cannon, 1.6 s: the library step-1 red left the cue ball beside the black (0.59, 1.43);
  pink no shot, blue long; the black into the top-left is struck at 4.5 m/s (top of the allowed range) with heavy screw
  and the cue ball comes back into the pack. It passes the "hard cannon into the pack" check because the cue ball has
  slowed down by the time it reaches the pack. Breaks: owner's "no full-power pack cannon on a colour" (as the night
  review of reds10-983480511:10). Cause: strike power is not looked at for a colour pack cannon.

Night 3 fix try, solver 4.11 (REVERTED: the paired soak was worse, docs/NIGHT-3.md). Only cause tried: a colour struck
over 4.0 m/s whose cue ball goes on into the pack (mark 2764519739:2). The game is still on 4.10, so every mark below
STILL HAPPENS. What 4.11 did (bench/results/n3-marks-replay-411.txt):
- reds15-2764519739:2: would be FIXED (plain black, 1.29 s, no pack cannon).
- reds15-3132621162:17 / :19 and reds10-3813538593:8: would change through an earlier hard pack cannon in the same
  round (plain reds 1.55 / 1.63 s; a 2.2 s miss on the black instead of the 3.3 s long blue).
- reds15-942643257:15: would be WORSE (the step-14 black leaves the cue ball touching the black; step 15 a soft foul).
- reds6-1527464874:6, reds10-483330344:3/6/8/10, reds15-640290895:10: NOT CHANGED (cause is red/colour position play,
  not tried tonight: it would be general tuning).

| Time | Round code | Step | Ball | Outcome | Shot type | Length | Level | Solver |
|---|---|---|---|---|---|---|---|---|
| 2026-11-24 21:29 | reds15-3804251161 | 10 | black | success | plain | 5.22 s | reds15 | 4.7b |
| 2026-11-24 22:14 | reds10-983480511 | 7 | red | success | long | 2.08 s | reds10 | 4.7c |
| 2026-11-24 22:14 | reds10-983480511 | 10 | black | success | packCannon | 4.50 s | reds10 | 4.7c |
| 2026-11-24 22:14 | reds10-983480511 | 15 | red | success | cannon | 4.07 s | reds10 | 4.7c |
| 2026-11-24 22:15 | reds15-1877393965 | 11 | red | success | long | 1.61 s | reds15 | 4.7c |
| sent 2026-11-25 13:58 | reds15-3634511757 | 10 | blue | success | long | 1.68 s | reds15 | 4.9 |
| sent 2026-11-25 13:58 | reds15-3634511757 | 11 | red | success | cannon | 2.48 s | reds15 | 4.9 |
| sent 2026-11-25 13:58 | reds15-2927609577 | 8 | blue | success | long | 1.83 s | reds15 | 4.9 |
| sent 2026-11-25 13:58 | reds15-2927609577 | 15 | red | success | cannon | 2.01 s | reds15 | 4.9 |
| sent 2026-11-25 13:58 | reds6-362783338 | 5 | red | jawRattle | attempt | 2.26 s | reds6 | 4.9 |
| 2026-11-25 14:25 | reds10-165926990 | 14 | blue | success | long | 1.33 s | reds10 | 4.9 |
| 2026-11-25 14:26 | reds15-912620600 | 6 | blue | success | long | 1.52 s | reds15 | 4.9 |
| 2026-11-25 14:26 | reds15-912620600 | 9 | red | success | plant | 2.20 s | reds15 | 4.9 |
| 2026-11-25 16:45 | reds6-1527464874 | 6 | blue | success | long | 1.31 s | reds6 | 4.10 |
| 2026-11-25 16:46 | reds10-3813538593 | 8 | blue | plainMiss | attempt | 3.30 s | reds10 | 4.10 |
| 2026-11-25 16:47 | reds10-483330344 | 3 | red | success | plain | 1.13 s | reds10 | 4.10 |
| 2026-11-25 16:47 | reds10-483330344 | 6 | pink | success | plain | 1.23 s | reds10 | 4.10 |
| 2026-11-25 16:48 | reds10-483330344 | 8 | pink | success | packCannon | 1.20 s | reds10 | 4.10 |
| 2026-11-25 16:48 | reds10-483330344 | 10 | pink | success | plain | 1.38 s | reds10 | 4.10 |
| 2026-11-25 19:20 | reds15-640290895 | 10 | pink | success | packCannon | 1.51 s | reds15 | 4.10 |
| 2026-11-25 20:13 | reds15-942643257 | 15 | red | plainMiss | attempt | 2.34 s | reds15 | 4.10 |
| 2026-11-25 20:13 | reds15-3132621162 | 17 | red | success | cushionFirst | 2.91 s | reds15 | 4.10 |
| 2026-11-25 20:13 | reds15-3132621162 | 19 | red | success | cannon | 2.95 s | reds15 | 4.10 |
| 2026-11-25 23:23 | reds15-2764519739 | 2 | black | success | packCannon | 1.60 s | reds15 | 4.10 |
| 2026-11-26 17:41 | reds15-136485470 | 3 | red | inOff | attempt | 4.61 s | reds15 | 4.10 |
