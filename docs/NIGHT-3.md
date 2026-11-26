# Night 3 (2026-11-25 23:50 to 2026-11-26 ~04:00) — report
## Task 1, replay by round code: DONE
- Code `reds6-48213-BKPK-C7`: level-seed, one letter per colour after a red (Y G N B P K), `-C7` = cashed out after step 7.
  Old codes (`reds6-48213`, all marks) still work and replay with the automatic colours.
- Menu (≡): "Round code" shows the full code; at the end of a round "Replay this round". Paste a code + "Replay code":
  the round plays itself (same break, shots, outcomes, colours, cash-out). Present in the real build; no dev-only text.
- Test: 100 random rounds per level (random cash-out, 1 colour in 5 not the automatic pick): 300/300 identical,
  2,797 trajectories compared frame by frame (bench/results/roundcode.txt). Small version in npm test.
## Task 2, soak baseline (solver 4.10, 3,000 rounds per level, headless): DONE
| Level | stuck | RE-RACK | off table / overlap | fallback (success, any flex / last resort; failure) | over 3.5 s (not last resort) | pace red / colour median, 90% | success vs p |
|---|---|---|---|---|---|---|---|
| 6 reds | 0 | 4 | 0 | 55.4% / 2.9%; 15.4% | 172 (147) of 19,756 | 1.50, 2.09 / 1.57, 2.13 | 18 steps, worst 1.98 sd |
| 10 reds | 0 | 0 | 0 | 52.9% / 1.6%; 15.1% | 158 (115) of 24,075 | 1.48, 2.03 / 1.57, 2.13 | 26 steps, worst 2.20 sd |
| 15 reds | 0 | 0 | 0 | 56.1% / 1.2%; 16.4% | 105 (65) of 27,987 | 1.53, 2.10 / 1.59, 2.12 | 36 steps, worst 2.95 sd |
- Stuck = over the simulated-shot cap or a crash. All 4 RE-RACKs are 6 reds, step 11, a red (seeds in the failure files).
- Success vs p: tolerance 3 sd per step; no step outside. RNG-only RTP, 2 million rounds per level: every cash-out
  step within 4 sd of the formula (15 reds worst 3.73 on seeds 1..2M, deep steps; seeds from 1e9 and 3e9: worst 2.37).
- Pace targets (docs/SPEED.md) hold for median and 90%, but "none over 3.5 s except last resort" does not: 65-147
  shots per level (0.2-0.7%). This was true before tonight too (old soaks), not new.
- Note: the first run stopped early (an old default stop after 1,000 successful shots per worker); I continued it on
  the next seeds, so the 3,000 are all different rounds. Solves over 10 s (49 / 50 / 88) are wall time on a PC
  running 12-15 jobs at once, not a stuck solver.
## Task 3, owner's 11 marks: diagnosis DONE; fix 4.11 tried and REVERTED
- Diagnosis per mark in docs/WEIRD-SHOTS.md (Night 3 review). Causes: a red leaves the cue ball badly placed for the
  black (7: 1527464874:6, 3813538593:8 also a 3.3 s miss, 483330344 x4, 640290895:10); a blue leaves it far from
  every red (3132621162:17, :19); a black struck at 4.5 m/s into the pack (2764519739:2); a red miss that stops short (942643257:15).
- 4.11 (one cause only: a colour struck over 4.0 m/s into the pack is not planned) would fix 2764519739:2 and change
  3 more marks for the better, 1 for the worse. Paired soak on the same 1,713 rounds (4.11 vs 4.10) was worse:
  fallback 57.8/55.3, 53.7/52.3, 56.8/55.6%; over 3.5 s 28/26, 26/23, 32/22; RE-RACK (6 reds) 2/1. Reverted.
- Status of all 11 marks in the game: STILL HAPPENS (no change kept). Not tried: position play (general tuning).
## Task 4, look options: DONE — open http://192.168.1.111:5181/docs/look-options.html on the phone.
A classic club, B TV tournament, C modern slate, D flat casual; camera C, balls 1.4x; textures drawn in code (ASSETS.md).
## Task 5, server outcomes note: DONE — docs/SERVER-OUTCOMES.md (5 open decisions at the top).
## Look at first
1. Pick a look (A-D) on the phone. 2. Try "Replay this round" after a round. 3. Decide if the over-3.5 s rule
   needs work (it fails in the soak) and whether position play may be tuned (most marks need it).
## Tests
Final code (solver 4.10): npm test 250/251; the one failure is tests/solver.test.ts hitting its 60 s limit in the
full parallel run (also in earlier nights); alone it passes in 36 s. Fairness tests pass. Real build: no dev-only text.
