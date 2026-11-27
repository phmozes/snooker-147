# Report: WIN, TAP and BREAK-OFF sounds in the game (PLAN 9.1 / 9.2, 2026-11-27)

Your round-2 picks: WIN = A (crowd applause), TAP = B, BREAK-OFF = C. Copied unchanged from mockups/sounds2/ to
`public/sounds/` as win.mp3, tap.mp3, break.mp3. All CC0 1.0 (public domain, commercial use, no credit); sources in
docs/ASSETS.md (win: miuziqa, Freesound #858309; tap: NenadSimic, #268108; break: DariusOW, #766411).

## What plays when
- **WIN (applause):** on every paid end: CASH OUT, RE-RACK and clearance. For a clearance it plays when the big
  clearance message appears, which is after the pocket-camera replay. Not on a failure, and not at the end of a free
  replay of a round code (it pays nothing).
- **TAP:** on every button on the page: START, SHOOT, CASH OUT, bet buttons (- / + / quick bets), level balls, BACK,
  menu, mute, Rules (and colour buttons, if any appear later). Not on the table (also not the small weird-shot flag
  on the table) and not inside the developer panel. A greyed-out button gives no tap.
- **BREAK-OFF:** on the opponent's break-off only. The break sound plays at the moment the cue ball first touches a
  ball of the pack. From that moment, ball-hits-ball sounds are off for 1.5 s; the cue, cushion and pocket sounds
  stay on. Later ball hits play as usual. All other shots (step 1, our shots) are unchanged.
- **Same rules as the table sounds:** nothing before the first tap on the page; the mute button stops everything;
  the break sound follows the playback clock (the moment comes from the recording, like the other hits).
- WIN and TAP are never left out because of the 6-sound limit (only table hits count for that).

## Config values added (src/config/game.config.ts, `sound`)
| Value | Meaning |
|---|---|
| `tableHits.breakOff.volume: 1.0` | volume of the break sound (0..1, x master volume 0.8) |
| `tableHits.breakOff.muteBallSeconds: 1.5` | ball-ball sounds are off this long after the cue ball hits the pack |
| `uiSounds.winVolume: 0.8` | volume of the applause |
| `uiSounds.tapVolume: 0.5` | volume of the button tap (kept low: it plays often) |

## Checks
- **Replay check** (bench/camera-replay.test.ts, 10 round codes, every outcome and ball path frame by frame):
  **identical** before and after this task, and identical to the file from before any sound work
  (bench/results/sounds/replay-before.txt = replay-before2.txt = replay-after2.txt).
- **npm test: 309 / 309 passed** (30 files; the 2 sound test files were run again after the last small dev-only edit: 9 / 9). tests/tableSounds.test.ts now also checks that the break moment is the cue ball's first
  touch of the pack, and that all 8 files exist.
- **Live check** (scripts/sound-check.mjs, real clicks in headless Chrome at phone size; in a developer build the
  game keeps a list of the sounds it started, by name):
  - no sound before the first tap; a tap on the table: no sound
  - START: tap sound. Break-off: exactly one break sound, 0 ball-ball sounds in the 1.5 s after it
    (sounds heard: tap, cue, break, cushion, cushion, cushion)
  - SHOOT: tap, then step 1 (cue, ball-hard, pocket, cushion). CASH OUT: tap + applause
  - mute on: START and a whole break-off with no sound at all; no page errors
  - Not live-checked: the applause at a clearance (the code plays it at the same place as for CASH OUT, right
    before the clearance message, after the replay), and the RE-RACK end.
  The check counts sounds; it cannot judge how they sound.

## Soak failures
No soak ran (sound only; outcomes proven unchanged by the replay check). Nothing new to list.

## Build files
`npm run build` (production, dist/):
| File | Size |
|---|---|
| index.html | 10.6 KB |
| assets/index-CIe8NIcf.js | 679.2 KB |
| assets/solverWorker-OK6aZ2BX.js | 48.6 KB |
| sounds/ball-hard.mp3 | 4.0 KB |
| sounds/ball-soft.mp3 | 2.4 KB |
| sounds/break.mp3 | 20.9 KB |
| sounds/cue.mp3 | 4.9 KB |
| sounds/cushion.mp3 | 2.1 KB |
| sounds/pocket.mp3 | 12.9 KB |
| sounds/tap.mp3 | 1.9 KB |
| sounds/win.mp3 | 26.7 KB |
| breaks/reds6.json, reds10.json, reds15.json | 478.4 / 575.3 / 696.0 KB |
| breaks-v3/reds6.json, reds10.json, reds15.json | 477.4 / 576.0 / 696.2 KB |

`npm run build:test` (dist-test/: developer menu, no PC posting): the same files, except
| File | Size |
|---|---|
| index.html | 10.8 KB |
| assets/index-CC726PFd.js | 692.5 KB |

## Owner's turn
Listen on the phone (tap once first): table sounds, break-off, applause, tap. Say what is too loud, too quiet or
wrong; each volume is one number. The hosted demo is not republished (your word).

Committed and pushed to origin/master (standing approval). Nothing published.
