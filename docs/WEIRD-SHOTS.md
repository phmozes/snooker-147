# Weird shots (marked on the phone with the flag button)

Replay: `SHOTS="<round code>:<step>" npx vitest run bench/replay-shot.test.ts` (needs the same solver version).
RTP option 3c (2026-11-25) changed p, so outcomes of old seeds changed slightly: marks made before 2026-11-25 14:00
replay on the old p with `OLDP=1` added to the command.

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
