# Report: owner's decisions after night 8 (2026-11-28)

## In short
| Part | Result |
|---|---|
| 1. v4 on for 6 reds | **on**: `breakLibrary.v4Levels: ['reds6']`. New 6-red rounds are `reds6-v4-<seed>`; 10 / 15 reds stay v3. Line added to RULES.md D.6 and NOW.md |
| 2. Rules box lines 1 and 4 | fixed (text below) |
| 3. Chance table in the Rules box | added (the chosen level, from config p); **truth check 107/107 rows match**, 80 of them the table rows |
| 4. Captions (style B, hint line) | in the game: 8 captions, test that BEFORE captions ignore the seed and the drawn outcome; dev panel buttons |
| 5. Layout | gap between the ladder strip and the bet row closed (34 → 10 px); SHOOT / START weight 800 → 700 (mockup) |
| 6. Speed | first START → SHOOT **5.97 s → 4.94 s**; break-off worst frame **1,066 ms → 217 ms** |
| 7. Chance options page | `mockups/chance/index.html`, 4 stills (A-D), 80-82 KB each |
| 8. Checks | replay check **916/916 identical** (v1-v4); `npm test` **331/331**; both builds OK |

## Part 1: v4 on for 6 reds
- `src/config/game.config.ts`: `v4Levels: ['reds6']`. Every new 6-red round uses the v4 break library; 10 and 15 reds stay v3. Old codes replay as before.
- RULES.md D.6 and NOW.md now say: "6 reds v4: about 10 RE-RACKs per 100,000 shots, accepted for now (owner 2026-11-28);
  the remaining ones are the last red at step 11, to be fixed in shot choice later." RULES B.1 says v4 is on.
- `tests/round.test.ts`: the check now expects v4 for 6 reds and v3 for 10 / 15 reds.

## Parts 2 and 3: the new Rules box
The text now lives in `src/game/rulesText.ts` (no screen code), so the truth check reads exactly what the game shows.

**Rules**
- Pick a level and a bet, then START. The opponent breaks off, then you press SHOOT for your first shot.
- Each SHOOT plays the next ball in snooker order: a red, then a colour, and so on. A pot moves you one step up the ladder.
- CASH OUT after any pot to take bet × the current multiplier. A miss, a foul or an in-off ends the round and the bet is lost.
- Clearing the table pays the top multiplier. In the rare case of a stalemate (re-rack), the round ends and you are paid the next step's multiplier.
- Every outcome is decided before the shot is shown and does not depend on where the balls lie.

**Chance of each step (6 reds)** ("The chance depends only on the step, never on the ball or where the balls lie.")
The box shows the table of the level that is chosen (6, 10 or 15 reds). Then the RTP list as before. Screenshot: `bench/results/2026-11-28/check/rules-box.jpg`.

| Step | Pays | Chance | | Step | Pays | Chance |
|---|---|---|---|---|---|---|
| 1 | x1.05 | 92.4% | | 10 | x3.59 | 83.3% |
| 2 | x1.14 | 92.1% | | 11 | x4.38 | 82.0% |
| 3 | x1.27 | 89.8% | | 12 | x5.40 | 81.1% |
| 4 | x1.42 | 89.4% | | 13 | x6.75 | 80.0% |
| 5 | x1.61 | 88.2% | | 14 | x8.54 | 79.0% |
| 6 | x1.85 | 87.0% | | 15 | x10.95 | 78.0% |
| 7 | x2.14 | 86.4% | | 16 | x14.22 | 77.0% |
| 8 | x2.51 | 85.3% | | 17 | x18.73 | 75.9% |
| 9 | x2.99 | 83.9% | | 18 | x25.00 | 74.9% |

10 reds: 92.4 92.1 91.2 91.2 90.2 89.9 89.4 88.7 88.0 88.0 87.3 86.5 86.3 85.8 85.3 84.7 84.3 83.7 83.2 82.7 82.2 81.7 81.2 80.7 80.2 79.6 (%; step 26 pays x50.00).
15 reds: 92.4 92.4 91.7 91.7 91.4 91.4 91.0 90.4 90.3 90.1 90.0 89.4 89.3 89.2 88.7 88.7 88.3 88.0 87.9 87.5 87.3 87.1 86.8 86.6 86.3 86.1 85.8 85.6 85.3 85.0 84.8 84.5 84.3 84.0 83.8 83.5 (%; step 36 pays x100.00).

**Truth check** (`bench/night8/truth.test.ts` → `bench/results/night8/truth.txt`): 107 rows, **107 YES, 0 NO**. The test now fails on any NO.
- The 23 rows of night 8 (ladders, p, RTP texts, measured RTP, bets, balance, strip texts): all YES as before.
- New: line 1 says SHOOT plays the first shot and not "plays itself"; line 4 holds the RULES E sentence word for word
  (read from RULES.md) and does not say "re-racked"; line 3; the chance note.
- New: 80 table rows (18 + 26 + 36). Each one checks the shown % against the config p, against the p the game really
  draws with (`outcomeDraw`), the multiplier, and that the row is in the box's HTML.

## Part 4: captions in the game (style B)
`src/game/captions.ts` holds the rules (no screen code); `src/game/gamePage.ts` shows them. Each caption takes the place
of the whole hint line (bold gold, 13 px), as in the mockup.

| Caption | When | How long | Priority |
|---|---|---|---|
| RE-RACK | no shot found for a decided success | 1.5 s, then the strip line stays | top (ends the round) |
| OPPONENT NEEDS SNOOKERS | the pot that first takes our lead past the points left | 1.0 s | 3 |
| CENTURY | the pot that first takes the break to 100 | 1.0 s | 4 |
| FIFTY BREAK | the pot that first takes the break to 50 | 1.0 s | 5 |
| FRAME BALL (before) | potting the next ball would take our lead past the points left | until SHOOT | 6 |
| MAXIMUM IS ON (before) | a black after every red so far, at least 3 / 4 / 5 reds potted | until SHOOT | 7 |
| LAST RED (before) | one red left and a red is next | until SHOOT | 8 |
| FLUKE | the pot went into a pocket other than the one aimed at (the shot's own type) | 1.0 s | 10 |

- AFTER captions start when the pot is seen dropping (the same moment as its applause). Only one caption shows at a
  time; the highest wins and the others are dropped. Each shows at most once a round.
- As you asked: no failure captions (the strip shows MISSED etc.); MAXIMUM / TOTAL CLEARANCE stay on the cloth; no ON THE COLOURS.
- BEFORE captions read only the table and the score. On a colour step, FRAME BALL is worked out with the lowest
  colour (yellow), not with the colour the game picks, because that pick can differ from seed to seed.
- `tests/captions.test.ts` (5 tests): the same table with 300 seeds × 2 versions, where the drawn next outcome
  really differs, always gives the same caption; plus each rule, the priorities, once a round, no caption on a clearance.
- In the dev build: menu > CAPTIONS: one button per caption (shows it for 3 s).
- Seen in a real forced 6-red clearance (`bench/results/2026-11-28/check/check.txt`): FRAME BALL before step 10,
  OPPONENT NEEDS SNOOKERS after it, LAST RED before step 11, FIFTY BREAK at step 15.
- Note: config `messages.flukeRate` (0.02) is not used. FLUKE comes only from real fluke shots, so it is rare.

## Part 5: layout
- The gap: between rounds, before the first round there is no hint line, so the bottom area had 24 px spare, shown
  between the ladder strip and the bet row. That spare space now goes above the ladder strip. Measured: ladder strip →
  bet row 34 → **10 px** (the same as the other gaps). The table keeps its size (top 66, bottom 624 px, the same in the
  round). The ladder strip moves 24 px up once, at the first START. After a round the line holds "BREAK n", so nothing changes there.
- "UP TO x25.00" and the one-line bet row: no change.
- SHOOT / START: font weight 800 → **700**, as in mockup D.

## Part 6: speed
Same script and profile as night 8 (`scripts/speed-check.mjs`: slow 4G, CPU 4x slower). "Before" = this task's code
without part 6, measured today, so both runs are on the same PC. Files: `bench/results/2026-11-28/speed-*-before/after.json`.

| Measure | Before | After |
|---|---|---|
| first START until SHOOT shows | 5.97 s | **4.94 s** |
| downloaded after the first START | 395 KB (the break library 67 KB + all sounds) | 328 KB (sounds only; the library came on the betting screen) |
| break-off frames: worst frame | **1,066 ms** | **217 ms** |
| break-off frames: median / 95% | 16.8 / 50 ms | 33.2 / 50 ms (one run; the PC was busier, the pocket-cut runs show the same spread) |
| first screen: START ready | 5.7 s | 6.4 s (one run each; the library download now shares the line with the page) |

What was done:
1. **Applause later**: the 6 applause files are no longer fetched on the first tap; they start downloading when the
   first break-off starts. They are still downloaded during the break-off, so the KB after START does not fall. What changes is that they no longer hold up START.
2. **Break library on the betting screen**: downloaded and read right after the first screen, and again on a level change.
   A START during the download waits for the same download (no second copy).
3. **What the freeze really was**: a CPU profile of START (`scripts/start-profile.mjs`) showed that the 0.85-1 s freeze
   was mostly the graphics card building the cue's drawing programs the first time the cue appears (690 ms), not the library.
   So the cue is now made and prepared on the betting screen too (`table3d.warmUp`, invisible).
   After: the remaining long task at START (0.58 s) is the sound system starting. In this test START is the first tap
   on the page; on a phone that cost comes with any first tap (a bet button, a level).

## Part 7: chance options page (no game change)
`mockups/chance/index.html` + `A-none.jpg`, `B-hint.jpg`, `C-chips.jpg`, `D-above-shoot.jpg` (80-82 KB, relative paths), made by
`scripts/chance-shots.mjs`. The game screen is round reds6-v4-2970798829 after step 3, with CASH OUT and SHOOT. The next shot
(step 4, the black) is 89% (config p 0.8944).
- A: today, nothing. B: "BLACK · NEXT x1.42 · 89%". C: 92% 90% 89% 88% 87% under the chips x1.14 … x1.85.
- D: "Chance to pot: 89%" above SHOOT (SHOOT 16 px lower).
- Questions for you on the page: which option; whole % or one decimal; show it before step 1 too?

## Part 8: checks and builds
- **Replay check** (`bench/night4/fp.test.ts` compare, `bench/results/2026-11-28/reproof/`):

| Set | Result |
|---|---|
| v1: your 16 marks | 16 identical, 0 different |
| v2 codes, 6 / 10 / 15 reds | 300 identical, 0 different |
| v3 codes, 6 / 10 / 15 reds | 300 identical, 0 different |
| v4 codes (night 8 recordings) | 300 identical, 0 different |

- **`npm test`**: 35 files, **331/331 pass** (5 new caption tests; the v4 test now expects v4 for 6 reds).
- No soak ran (no change to shots or outcomes, which the replay check proves). Nothing new to list.

dist/ (production, `npm run build`, 24 files, 5,170,763 bytes):
```
    702361  assets/index-BGQ1c6Ii.js
     50036  assets/solverWorker-DZ2ilWjG.js
    589119  breaks/reds10.json
    712742  breaks/reds15.json
    489861  breaks/reds6.json
    589812  breaks-v3/reds10.json
    712882  breaks-v3/reds15.json
    488825  breaks-v3/reds6.json
    491890  breaks-v4/reds6.json
     11504  index.html
     18808  sounds/applause-1.mp3
     27271  sounds/applause-2.mp3
     36675  sounds/applause-3.mp3
     46393  sounds/applause-4.mp3
     60813  sounds/applause-5.mp3
     72724  sounds/applause-6.mp3
      4075  sounds/ball-hard.mp3
      2507  sounds/ball-soft.mp3
     21359  sounds/break.mp3
      5015  sounds/cue.mp3
      2194  sounds/cushion.mp3
     18808  sounds/miss.mp3
     13165  sounds/pocket.mp3
      1924  sounds/tap.mp3
```
dist-test/ (`npm run build:test`, developer menu, no PC posting, 24 files, 5,185,230 bytes): the same files and sizes,
except `assets/index-WQX280XV.js` 716,631 and `index.html` 11,701.

## Files changed
Code: `src/config/game.config.ts`, `src/game/gamePage.ts`, `src/game/rulesText.ts` (new), `src/game/captions.ts` (new),
`src/game/tableSounds.ts`, `src/view/table3d.ts`, `index.html`. Tests: `tests/captions.test.ts` (new), `tests/round.test.ts`,
`bench/night8/truth.test.ts`. Docs: RULES.md, NOW.md, this report (old one: `docs/reports/2026-11-28-4393753.md`).
Scripts: `scripts/start-profile.mjs`, `scripts/chance-shots.mjs`, `scripts/task-1128-check.mjs`. Results: `bench/results/2026-11-28/`.
Not committed (your phone data, as before): `bench/results/phone-cost.jsonl`, `docs/WEIRD-SHOTS.md`.

## For you
1. Pick a chance option in `mockups/chance/` (A, B, C or D).
2. Phone check: the captions (dev menu > CAPTIONS, or a real round), the Rules box table, the bet screen before the first round.
3. The hosted demo was not republished (publishing = your word).
