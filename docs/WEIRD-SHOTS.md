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
