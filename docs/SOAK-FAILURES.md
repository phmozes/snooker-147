# Soak failures (task 5.5)
Every crash, invalid shot or rules violation the soak test finds: round code, step, what, and what was done.
Replay: `SHOTS="<round code>:<step>" npx vitest run bench/replay-shot.test.ts`. Raw lists: bench/results/soak*/*-failures.txt.

## Solver 4.8c (first soak run, stopped after about 6,600 success shots to fix these)
| Round code | Step | What | Fix (solver 4.8d) | Test |
|---|---|---|---|---|
| reds10-5000066 | 17 | RE-RACK (red): two reds just above the pink spot; the colour pick took a natural pink that left them unreachable | colour pick: shots that keep the next red reachable first, then a rescue search for black, pink and blue | tests/soakRegressions.test.ts |
| reds6-5000294 | 11 | RE-RACK (red) | same fix (now an exhibition cushion-first red, no RE-RACK) | tests/soakRegressions.test.ts |
| reds6-5000311 | 13 | RE-RACK (yellow) | same fix (now a plain yellow) | tests/soakRegressions.test.ts |
No crash, no invalid shot, no ball off the cloth, no overlap, no shot over its cap in that run.

## Solver 4.8d (main soak run)
| Round code | Step | What | Fix (solver 4.8e) | Test |
|---|---|---|---|---|
| reds6-5000614 | 11 | RE-RACK (red): the last red touches the pink spot from above; no straight pot exists | new last search before the spray: object-ball doubles (`solver.doubles`); now a kiss pot, no RE-RACK | tests/soakRegressions.test.ts |
| reds6-5001006, -5001417, -5001773, -5001867, -5002339, -5002385, -5002907 | 11 | RE-RACK (red): the same position as reds6-5000614 (same break-off) | fixed by 4.8e (replayed: now a success) | reds6-5000614 case |
| reds10-5001536, -5001744 | 18 | RE-RACK (black): step 17 potted a red with a cushion-first shot that left the cue ball behind the brown, no colour pottable | solver 4.8f: a last-resort shot must leave a pottable ball if exhibition, doubles or spray can (`solver.lastResortCheck`); step 17 is now a doubles plant, step 18 a pink | tests/soakRegressions.test.ts |
4.8d run stopped at 01:45 to restart on 4.8f: 18,648 / 16,232 / 15,142 success shots (6 / 10 / 15 reds), results in bench/results/soak-4.8d-partial. No crash, no invalid shot, no ball off the cloth, no overlap, no shot over its cap.

## Solver 4.8f (final soak run, bench/results/soak)
