# Weird shots (marked on the phone with the flag button)

Replay: `SHOTS="<round code>:<step>" npx vitest run bench/replay-shot.test.ts` (needs the same solver version).

Night review 2026-11-24 (solver 4.8a, positional play around the black; details in docs/REVIEW.md "Night"):
- reds10-983480511:7 (long red to a baulk-end corner): broke rule 1/5 (the pink before left the cue ball 1 m away).
  Now a plain natural pot (2.6 m in all, 27 deg); still a baulk-end corner, but this red is in the baulk half (allowed). PARTLY FIXED.
- reds10-983480511:10 (black, 4.5 s full-power pack cannon): broke rule 4 (wrong side of the black for the next red).
  Now 25 deg, 1.0 m, no smash, but it still moves the pink, so not strictly natural. STILL HAPPENS (milder).
- reds10-983480511:15 (red, 66 deg thin cannon, 4.1 s): broke rule 3 (the pink before left a thin cut). Now 28 deg plain pot. FIXED.
- reds15-1877393965:11 (long red to a baulk-end corner from behind the black): broke rules 1 and 2 (the black before left
  the cue ball behind the black). Now the cue ball stays in front and the red goes in a middle pocket. FIXED.

| Time | Round code | Step | Ball | Outcome | Shot type | Length | Level | Solver |
|---|---|---|---|---|---|---|---|---|
| 2026-11-24 21:29 | reds15-3804251161 | 10 | black | success | plain | 5.22 s | reds15 | 4.7b |
| 2026-11-24 22:14 | reds10-983480511 | 7 | red | success | long | 2.08 s | reds10 | 4.7c |
| 2026-11-24 22:14 | reds10-983480511 | 10 | black | success | packCannon | 4.50 s | reds10 | 4.7c |
| 2026-11-24 22:14 | reds10-983480511 | 15 | red | success | cannon | 4.07 s | reds10 | 4.7c |
| 2026-11-24 22:15 | reds15-1877393965 | 11 | red | success | long | 1.61 s | reds15 | 4.7c |
