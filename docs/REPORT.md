# Report: ladder-strip frame bug + chance under each chip (2026-11-28, second task)

**Process answer (the 4 extra replay runs in the last task).** They were not planned reruns. I stopped the first, one-by-one replay script with TaskStop and killed the test it was running. But its `sh` loop kept going, and I had also rewritten that script while it was running. It then ran v2/v3 at 10 and 15 reds again until 08:54, which overwrote those 4 logs and added 4 lines to summary.txt.
**The report's numbers came from the first (parallel) run.** They are its `lines.txt` "identical / different" lines, all written by 08:35:44. The leftover loop had no OUT set, so it wrote nothing there. Its 4 runs also passed.
From now on: no check result goes into the report or a push until every run of that check has ended. After stopping a job I list the processes and kill any loop that is left (this time: 0 left, checked before writing). Saved as a working rule.

## In short
| Part | Result |
|---|---|
| 1. Strip frame bug | **cause found and fixed**; check: **54/54 PASS** (3 sizes × 3 levels × 6 states); before the fix 4 of 6 short-screen states FAILED |
| 2. Chance under each chip (option C) | in the game; truth check **187/187 YES** (80 new chip rows); new `tests/ladderStrip.test.ts` |
| Checks | replay check **916/916 identical** (v1-v4, all runs ended 09:50:45); `npm test` **333/333**; both builds OK |

## Part 1: the cut-off frame
**Cause (one line):** the end line ("WON … · x…") was 36 px tall (34 px + 1 px borders), but on a short screen (in-app browser, height/width under 2.05) the strip is 30 px, so the line stuck out 3 px above the strip and the absolutely positioned 3D canvas (and on a clearance the cloth message) painted over its top border.
- So it was not part 5: it happens only on short screens, in every end state (cash out, miss, re-rack, clearance). On 390x844 the line also stuck out 1 px, but the 6 px gap hid it.
- **Fix** (`index.html`): the end line is now exactly the strip's height, borders included (`height: 100%; box-sizing: border-box`).
  The table did not change: 418 px tall at 360x640 and 558 px at 390x844, the same before and after.
- **The 10 px gap does not fit at the in-app size** without making the table smaller. On a short screen the only space above the strip is the table's 2 px margin. The bottom area is already full (CASH OUT + hint + SHOOT). So I left it. The gap to the drawn wood rail is 6 px at 360x640 and 31 px at 360x720. At 390x844 it is 45 px (the box gap is 6 px, but the canvas is dark below the rail).
- **Check:** `scripts/strip-frame-check.mjs` (dev server). For every state it measures the boxes and tests 1 px inside the frame's top and bottom edges (every 6 px) to see which element is really on top there. PASS = the frame is fully on screen and no edge point is covered. Crops: `bench/results/2026-11-28b/strip/`, all lines: `strip/check.txt`.
  360x720 stands in for your in-app browser (360 wide, shorter because of the browser bar); 360x640 is the smallest.
- Before the fix (`bench/results/2026-11-28b/strip-before/`, 360x640, 6 reds): bet screen PASS, in round PASS; after cash out, miss, re-rack and clearance **FAIL**: the frame was at 469-505 in a 472-502 strip, with 53 edge points covered by the canvas (on the clearance: by the cloth message).

| Size | Reds | State | Result | Frame top-bottom (px) | Gap above: box / drawn rail (px) | Covered edge points | Screenshot (bench/results/2026-11-28b/strip/) |
|---|---|---|---|---|---|---|---|
| 390x844 | 6 | bet-first | PASS | 654-688 | 30 / 69.1 | 0 | `390x844-reds6-bet-first.jpg` |
| 390x844 | 6 | in-round | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds6-in-round.jpg` |
| 390x844 | 6 | after-cashout | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds6-after-cashout.jpg` |
| 390x844 | 6 | after-miss | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds6-after-miss.jpg` |
| 390x844 | 6 | after-rerack | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds6-after-rerack.jpg` |
| 390x844 | 6 | after-clearance | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds6-after-clearance.jpg` |
| 390x844 | 10 | bet-first | PASS | 654-688 | 30 / 69.1 | 0 | `390x844-reds10-bet-first.jpg` |
| 390x844 | 10 | in-round | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds10-in-round.jpg` |
| 390x844 | 10 | after-cashout | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds10-after-cashout.jpg` |
| 390x844 | 10 | after-miss | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds10-after-miss.jpg` |
| 390x844 | 10 | after-rerack | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds10-after-rerack.jpg` |
| 390x844 | 10 | after-clearance | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds10-after-clearance.jpg` |
| 390x844 | 15 | bet-first | PASS | 654-688 | 30 / 69.1 | 0 | `390x844-reds15-bet-first.jpg` |
| 390x844 | 15 | in-round | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds15-in-round.jpg` |
| 390x844 | 15 | after-cashout | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds15-after-cashout.jpg` |
| 390x844 | 15 | after-miss | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds15-after-miss.jpg` |
| 390x844 | 15 | after-rerack | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds15-after-rerack.jpg` |
| 390x844 | 15 | after-clearance | PASS | 630-664 | 6 / 45.1 | 0 | `390x844-reds15-after-clearance.jpg` |
| 360x640 (short) | 6 | bet-first | PASS | 490-520 | 20 / 24.2 | 0 | `360x640-reds6-bet-first.jpg` |
| 360x640 (short) | 6 | in-round | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds6-in-round.jpg` |
| 360x640 (short) | 6 | after-cashout | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds6-after-cashout.jpg` |
| 360x640 (short) | 6 | after-miss | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds6-after-miss.jpg` |
| 360x640 (short) | 6 | after-rerack | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds6-after-rerack.jpg` |
| 360x640 (short) | 6 | after-clearance | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds6-after-clearance.jpg` |
| 360x640 (short) | 10 | bet-first | PASS | 490-520 | 20 / 24.2 | 0 | `360x640-reds10-bet-first.jpg` |
| 360x640 (short) | 10 | in-round | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds10-in-round.jpg` |
| 360x640 (short) | 10 | after-cashout | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds10-after-cashout.jpg` |
| 360x640 (short) | 10 | after-miss | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds10-after-miss.jpg` |
| 360x640 (short) | 10 | after-rerack | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds10-after-rerack.jpg` |
| 360x640 (short) | 10 | after-clearance | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds10-after-clearance.jpg` |
| 360x640 (short) | 15 | bet-first | PASS | 490-520 | 20 / 24.2 | 0 | `360x640-reds15-bet-first.jpg` |
| 360x640 (short) | 15 | in-round | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds15-in-round.jpg` |
| 360x640 (short) | 15 | after-cashout | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds15-after-cashout.jpg` |
| 360x640 (short) | 15 | after-miss | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds15-after-miss.jpg` |
| 360x640 (short) | 15 | after-rerack | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds15-after-rerack.jpg` |
| 360x640 (short) | 15 | after-clearance | PASS | 472-502 | 2 / 6.2 | 0 | `360x640-reds15-after-clearance.jpg` |
| 360x720 (short) | 6 | bet-first | PASS | 570-600 | 20 / 48.9 | 0 | `360x720-reds6-bet-first.jpg` |
| 360x720 (short) | 6 | in-round | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds6-in-round.jpg` |
| 360x720 (short) | 6 | after-cashout | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds6-after-cashout.jpg` |
| 360x720 (short) | 6 | after-miss | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds6-after-miss.jpg` |
| 360x720 (short) | 6 | after-rerack | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds6-after-rerack.jpg` |
| 360x720 (short) | 6 | after-clearance | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds6-after-clearance.jpg` |
| 360x720 (short) | 10 | bet-first | PASS | 570-600 | 20 / 48.9 | 0 | `360x720-reds10-bet-first.jpg` |
| 360x720 (short) | 10 | in-round | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds10-in-round.jpg` |
| 360x720 (short) | 10 | after-cashout | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds10-after-cashout.jpg` |
| 360x720 (short) | 10 | after-miss | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds10-after-miss.jpg` |
| 360x720 (short) | 10 | after-rerack | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds10-after-rerack.jpg` |
| 360x720 (short) | 10 | after-clearance | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds10-after-clearance.jpg` |
| 360x720 (short) | 15 | bet-first | PASS | 570-600 | 20 / 48.9 | 0 | `360x720-reds15-bet-first.jpg` |
| 360x720 (short) | 15 | in-round | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds15-in-round.jpg` |
| 360x720 (short) | 15 | after-cashout | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds15-after-cashout.jpg` |
| 360x720 (short) | 15 | after-miss | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds15-after-miss.jpg` |
| 360x720 (short) | 15 | after-rerack | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds15-after-rerack.jpg` |
| 360x720 (short) | 15 | after-clearance | PASS | 552-582 | 2 / 30.9 | 0 | `360x720-reds15-after-clearance.jpg` |

## Part 2: the chance under each chip (option C)
- Each chip now shows its multiplier and, under it, the chance of that step in whole percent (9.5 px, as in `mockups/chance/C-chips.jpg`).
  It shows on every visible chip: before the first shot (step 1: 92%), during the round, and between rounds.
- The value is `chipPercent(p)` = round half up of the same ladder p the game draws with (`src/game/rulesText.ts`).
  The strip is built in a new file without screen code, `src/game/ladderStrip.ts`, so the checks read exactly the chips the game shows.
- No step rounds differently in the chip than the Rules table's one-decimal value suggests. I checked every step of every level, for example 89.4% → 89%, 89.8% → 90%.
- **Truth check** (`bench/night8/truth.test.ts` → `bench/results/night8/truth.txt`): **187 rows, 187 YES, 0 NO**.
  The 80 new rows (18 + 26 + 36) render the strip for every step 0..n, in a round and between rounds. They check that each step's chip is the same in every strip, and that chip % = round(config p) = round(outcomeDraw p) = round(Rules table value). The test fails on any NO.
- `tests/ladderStrip.test.ts` (2 tests, in `npm test`): the same rule for every chip of every strip, and half up.
- **Outcomes unchanged:** this is display only.

| Replay check (`bench/results/2026-11-28b/reproof/`) | Result |
|---|---|
| v1: your 16 marks | 16 identical, 0 different |
| v2 codes, 6 / 10 / 15 reds | 300 identical, 0 different |
| v3 codes, 6 / 10 / 15 reds | 300 identical, 0 different |
| v4 codes | 300 identical, 0 different |

## Tests and builds
- `npm test`: 36 files, **333/333 pass**.
- `npm run build` (dist/): 24 files, 5,171,053 bytes (`assets/index-CePea_BP.js` 702,509, `index.html` 11,646; other files unchanged).
- `npm run build:test` (dist-test/, developer menu, no PC posting), 24 files, 5,185,524 bytes:
```
    716783  assets/index-B6mxzBC7.js
     50036  assets/solverWorker-DZ2ilWjG.js
    589119  breaks/reds10.json
    712742  breaks/reds15.json
    489861  breaks/reds6.json
    589812  breaks-v3/reds10.json
    712882  breaks-v3/reds15.json
    488825  breaks-v3/reds6.json
    491890  breaks-v4/reds6.json
     11843  index.html
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

## Files changed
`index.html` (end-line height, chip layout), `src/game/ladderStrip.ts` (new), `src/game/rulesText.ts` (`chipPercent`),
`src/game/gamePage.ts` (uses `stripHtml`), `bench/night8/truth.test.ts`, `tests/ladderStrip.test.ts` (new),
`scripts/strip-frame-check.mjs` (new), results in `bench/results/2026-11-28b/`, NOW.md, this report
(the old one: `docs/reports/2026-11-28-8b388ac.md`). Not committed (your phone data): `phone-cost.jsonl`, `WEIRD-SHOTS.md`.

## For you
Phone check: the strip after a round (the whole gold frame), and the % under the chips.
