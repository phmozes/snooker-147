# Report: clean-up, pocket x0.4, applause levels 1-6 in the game, miss sound options (2026-11-27)

## Part 1: side effects of the last task
1. **Processes:** the 5 vitest workers had already ended on their own. A search for node processes with "vitest" in
   their command line found none (0 left), so there was nothing to close.
2. **Restored with `git restore`** (10 files the stopped run rewrote):
   bench/results/fairness/reds6.done, fairness/reds6.jsonl, marks-diag.txt, n3-diag.txt, n3-rerack.txt, pink-black.txt,
   roundcode.txt, rtp-rng.txt, rtp50m/shard-0.json, soak/reds6-0-failures.txt, soak/reds6-0.json (that is 11 paths:
   I counted 10 last time; reds6-0-failures.txt was one of them too). Also deleted one new file the run had made:
   bench/results/camera57/replay.txt (not in git; the run's default output file).
   `git status` after that: only `bench/results/phone-cost.jsonl` and `docs/WEIRD-SHOTS.md` changed (your phone files).
   The untracked folders that were already there at the start of the session (rtp200m logs, night7/start-flow-dev,
   rtp200m-speed, .claude/) were left alone.
3. **New rule** in CLAUDE.md and NOW.md Working rules: check code with `npm test` (tests/ only), never `npx vitest run`
   on the whole repo.

## Part 2: pocket drop volume
`sound.tableHits.pocket.gain`: **0.5 -> 0.4** (softest pot 0.18, hardest 0.4, x masterVolume 0.8). Cue stays 0.75.

## Part 3: applause levels in the game (your picks: B for all 6)
Files: mockups/applause/1-B ... 6-B copied unchanged to public/sounds/applause-1.mp3 ... applause-6.mp3.
**win.mp3 removed** from the game (public/sounds/ and both builds). docs/ASSETS.md updated.

When each level plays (rules in src/game/applause.ts, wired in src/game/gamePage.ts):
| Level | When | Moment |
|---|---|---|
| 1 | CASH OUT, RE-RACK | as the round ends |
| 2 | the break reaches 50 | the moment the ball that reaches it drops on screen (slow motion of the pocket cam included) |
| 3 | the opponent needs snookers (lead > points left, RULES C.8) | same: as that ball drops |
| 4 | the break reaches 100 | same: as that ball drops |
| 5 | a clearance | after the clearance replay, when the big message appears |
| 6 | the maximum (75 / 107 / 147, RULES C.9) | same as 5, instead of 5 |
- Each level at most once a round. Several on the same shot: only the highest (example: 50 and needs-snookers on the
  same pot plays 3). The clearance's last pot plays no milestone, only its 5 or 6.
- A failure plays nothing. A free replay (REPLAY by round code, no bet) plays nothing either, as before with win.mp3.
- Never delays the game (SHOOT and CASH OUT work while it plays). A new applause stops the old one. Mute stops it.
- One volume for all six: `uiSounds.applauseVolume` 0.8 (was `winVolume` 0.8); the files themselves grow +3 dB a level.
- In the developer jump (no animation) a level counts as heard but plays nothing.
- **Dev panel:** new "APPLAUSE (DEV ONLY)" row with 6 buttons (1 CASH OUT ... 6 MAXIMUM). It is in the test build too.

## Part 4: miss sound options (mockups/miss/index.html, not in the game)
1.5 s each, same loudness (-24 dB RMS), trimmed, fade-out, mono 96 kbps. All Freesound **CC0 1.0** (checked on each page).
| File | What | Source | Author | Licence |
|---|---|---|---|---|
| miss-A | group groan | https://freesound.org/people/CHallSmith/sounds/870630/ | CHallSmith | CC0 1.0 |
| miss-B | crowd "oh…", disappointed | https://freesound.org/people/mrrap4food/sounds/619007/ | mrrap4food | CC0 1.0 |
| miss-C | crowd sigh of disappointment (softer, more distant) | https://freesound.org/people/ShangusBurger/sounds/764215/ | ShangusBurger | CC0 1.0 |
Not used: two single-voice "aww" files (one person, not a crowd). C came from a quiet recording, so it may have a little
more background hiss.

## Tests and checks
- `npm test` (tests/ only): **31 files, 314 tests passed** (95 s). New: tests/applause.test.ts (5 tests, which level when);
  tests/tableSounds.test.ts checks pocket 0.4 and the 6 applause files.
- **Replay check** (bench/camera-replay.test.ts, every outcome and every ball path frame by frame), run before and after
  the change: **identical** (bench/results/applause/replay-before.txt = replay-after.txt). The sounds change no round.
- Live sound check (scripts/sound-check.mjs on the dev server): SOUND CHECK OK; CASH OUT played applause-1.
- Live applause run (6 reds, every shot forced to succeed, a clearance): step 10 applause-3 (needs snookers),
  step 14 applause-2 (break 50), end applause-5 (clearance, not a maximum). No page errors. Level 6 was checked by the
  unit test only (a maximum needs black after every red).
- No soak ran, so there is no *-failures.txt line to list.

## Builds (bytes)
`npm run build` (dist/) and `npm run build:test` (dist-test/) both built OK.
| File | dist/ | dist-test/ |
|---|---|---|
| index.html | 10,860 | 11,057 |
| assets/index-*.js | 696,731 (index-3tAM5Qu-.js) | 710,648 (index-9yfG4XCd.js) |
| assets/solverWorker-B34iVOky.js | 49,830 | 49,830 |
| breaks/reds6.json | 489,861 | 489,861 |
| breaks/reds10.json | 589,119 | 589,119 |
| breaks/reds15.json | 712,742 | 712,742 |
| breaks-v3/reds6.json | 488,825 | 488,825 |
| breaks-v3/reds10.json | 589,812 | 589,812 |
| breaks-v3/reds15.json | 712,882 | 712,882 |
| sounds/applause-1.mp3 | 18,808 | 18,808 |
| sounds/applause-2.mp3 | 27,271 | 27,271 |
| sounds/applause-3.mp3 | 36,675 | 36,675 |
| sounds/applause-4.mp3 | 46,393 | 46,393 |
| sounds/applause-5.mp3 | 60,813 | 60,813 |
| sounds/applause-6.mp3 | 72,724 | 72,724 |
| sounds/ball-hard.mp3 | 4,075 | 4,075 |
| sounds/ball-soft.mp3 | 2,507 | 2,507 |
| sounds/break.mp3 | 21,359 | 21,359 |
| sounds/cue.mp3 | 5,015 | 5,015 |
| sounds/cushion.mp3 | 2,194 | 2,194 |
| sounds/pocket.mp3 | 13,165 | 13,165 |
| sounds/tap.mp3 | 1,924 | 1,924 |

## Your turn
- Phone: listen to the applause levels (dev menu > APPLAUSE buttons) and the quieter pocket drop.
- Pick A, B or C for the miss sound: http://192.168.1.111:5181/mockups/miss/
