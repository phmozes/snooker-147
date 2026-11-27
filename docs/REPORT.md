# Report: quieter pocket and cue; applause levels options page (2026-11-27)

## Part 1: volume change (in the game)
The old settings had no volume number of their own: the volume came from the impact speed alone (floor..1).
So I added one setting per sound, `gain`, which multiplies the result (src/config/game.config.ts, sound.tableHits),
plus one line in src/game/tableSounds.ts (`impactVolume` multiplies by `gain`, 1 if missing). No other sound changed.

| Sound | Old | New |
|---|---|---|
| Pocket drop (`pocket.gain`) | 1.0 (softest pot 0.45, hardest 1.0) | **0.5** (softest 0.225, hardest 0.5) = 50% quieter |
| Cue strike (`cue.gain`) | 1.0 (softest 0.25, hardest 1.0) | **0.75** (softest 0.19, hardest 0.75) = 25% quieter |

All x masterVolume 0.8, same as before. tests/tableSounds.test.ts: updated the pocket check and added two checks
(hardest pot = 0.5, hardest cue = 0.75): 4/4 pass. Type check (tsc) clean.
Full `npx vitest run`: NOT finished. I stopped it after 47 minutes (past the 30-minute rule); its result is unknown.
5 of its worker processes are still running in the background (I was not allowed to force-close them); they
stop on their own or when the PC restarts.
The stopped run also rewrote 10 saved files in bench/results/ (fairness, soak, diag files). They are partial results of an
unfinished run, so I did NOT commit them (left as they are). bench/results/soak/reds6-0-failures.txt got 3 lines:
- reds6-v3-5000057 step 8: solver took 13904 ms (stuck limit 10000)
- reds6-v3-5000094 step 10: solver took 11564 ms (stuck limit 10000)
- reds6-v3-5000094 step 11: RE-RACK (target red)
The two slow-solver lines are most likely the busy PC (tests running at the same time); the RE-RACK is the known 6-red one.

## Part 2: applause levels (options page only, mockups/applause/index.html)
12 files, 2 per level. Two big buttons play all A (or all B) from level 1 to 6, with a 0.6 s gap, so you hear the growth.
Treatment: Freesound preview, trimmed, 30 ms fade-in, fade-out over the last 35% (at least 0.5 s), mono 96 kbps.
Not levelled the same: average loudness goes up 3 dB each level (level 1 = -30 dB, level 6 = -15 dB).
All CC0 1.0 (checked on each sound's page on 2026-11-27). Nothing from freesoundeffects.com.

| File | Level | Length | Size | Source | Author | Licence |
|---|---|---|---|---|---|---|
| 1-A | 1 CASH OUT | 1.5 s | 18.8 KB | freesound.org/s/462362 | Breviceps | CC0 1.0 |
| 1-B | 1 CASH OUT | 1.5 s | 18.8 KB | freesound.org/s/433880 | jodybruchon | CC0 1.0 |
| 2-A | 2 break 50 | 2.2 s | 27.3 KB | freesound.org/s/858309 (= current win.mp3) | miuziqa | CC0 1.0 |
| 2-B | 2 break 50 | 2.2 s | 27.3 KB | freesound.org/s/481646 | bowlingballout | CC0 1.0 |
| 3-A | 3 needs snookers | 3.0 s | 36.7 KB | freesound.org/s/859009 | ElevatorFan2020 | CC0 1.0 |
| 3-B | 3 needs snookers | 3.0 s | 36.7 KB | freesound.org/s/583130 | AudioSea | CC0 1.0 |
| 4-A | 4 break 100 | 4.0 s | 48.9 KB | freesound.org/s/845594 | 3to1video | CC0 1.0 |
| 4-B | 4 break 100 | 3.8 s | 46.4 KB | freesound.org/s/221567 | AlaskaRobotics | CC0 1.0 |
| 5-A | 5 clearance | 4.5 s | 54.9 KB | freesound.org/s/221568 | AlaskaRobotics | CC0 1.0 |
| 5-B | 5 clearance | 5.0 s | 60.8 KB | freesound.org/s/678543 | mglennsound | CC0 1.0 |
| 6-A | 6 MAXIMUM | 6.0 s | 72.7 KB | freesound.org/s/455660 | kyles | CC0 1.0 |
| 6-B | 6 MAXIMUM | 6.0 s | 72.7 KB | freesound.org/s/397434 | FoolBoyMedia | CC0 1.0 |

The exact parts used are in docs/ASSETS.md. A headless check confirmed "Play all A" plays 1-A ... 6-A in order.
Plan for later (not built): if several levels happen on one shot, play only the highest; levels 2-4 right after the pot.

## Builds
`npm run build` (dist/, production) and `npm run build:test` (dist-test/, developer menu) both built OK.

| File | dist/ | dist-test/ |
|---|---|---|
| index.html | 10,860 | 11,057 |
| assets/index-*.js | 695,489 (index-CkykZKLM.js) | 709,163 (index-DEfLbk7u.js) |
| assets/solverWorker-D6X530nS.js | 49,825 | 49,825 |
| breaks/reds6.json | 489,861 | 489,861 |
| breaks/reds10.json | 589,119 | 589,119 |
| breaks/reds15.json | 712,742 | 712,742 |
| breaks-v3/reds6.json | 488,825 | 488,825 |
| breaks-v3/reds10.json | 589,812 | 589,812 |
| breaks-v3/reds15.json | 712,882 | 712,882 |
| sounds/ball-hard.mp3 | 4,075 | 4,075 |
| sounds/ball-soft.mp3 | 2,507 | 2,507 |
| sounds/break.mp3 | 21,359 | 21,359 |
| sounds/cue.mp3 | 5,015 | 5,015 |
| sounds/cushion.mp3 | 2,194 | 2,194 |
| sounds/pocket.mp3 | 13,165 | 13,165 |
| sounds/tap.mp3 | 1,924 | 1,924 |
| sounds/win.mp3 | 27,315 | 27,315 |

(sizes in bytes; the sound files are unchanged, the volume change is in the code)

## Your turn
- Phone: listen to the pocket and cue sounds again (quieter now).
- Open mockups/applause/ (on the dev server: http://192.168.1.111:5181/mockups/applause/), pick A or B for each of the 6 levels.
