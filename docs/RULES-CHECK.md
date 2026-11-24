# Rules check (tasks 3.1 and 3.2)

Each case below is one test in `tests/rules.test.ts` (3.1) or `tests/score.test.ts` (3.2), written as a sentence. The first column is the section of
`docs/RULES.md` it comes from. The results table is rebuilt by `npm run rules-check` (it runs the tests and rewrites
the part between the markers). The code is `src/core/rules.ts`.

## Results

<!-- RESULTS START -->
Result: **56 of 56 passed** (2026-11-24).

### Reds and colours alternate

| RULES.md | Case | Result |
|---|---|---|
| C.1 | a new round starts with a red as the target, with every red and colour on the table | pass |
| C.1 | after a red is potted, the next target is a colour, and any of the six colours may be chosen | pass |
| C.1 | after a colour is potted while reds remain, the next target is a red again | pass |
| C.1 | a colour cannot be the target when a red is due, and a red cannot be the target when a colour is due | pass |
| C.1 | a whole 6-red round alternates red, colour, red, colour ... and then goes to the final colours | pass |

### Colours are re-spotted

| RULES.md | Case | Result |
|---|---|---|
| C.2 | a colour potted while reds remain goes back to its own spot | pass |
| C.2 | the colour after the LAST red is also re-spotted (the final colours start with all six on the table) | pass |
| C.2 | if its own spot is covered, the colour goes to the highest free spot (black, pink, blue, brown, green, yellow) | pass |
| C.2 | a spot counts as covered when a ball there would touch another ball, not only when a ball sits on it | pass |
| C.2 | if every spot is covered, the colour goes to the nearest free point straight above its own spot (toward the top cushion) | pass |
| C.2 | yellow and green (spots not on the centre line) go straight up the table from their own spot | pass |
| C.2 | if there is no room above, the colour goes to the nearest free point below its own spot | pass |
| C.2 | a re-spotted colour never overlaps another ball | pass |

### Final colours in order

| RULES.md | Case | Result |
|---|---|---|
| C.3 | after the last red and its colour, the target is yellow | pass |
| C.3 | the final colours must be potted in the order yellow, green, brown, blue, pink, black | pass |
| C.3 | a final colour stays down after it is potted (it is not re-spotted) | pass |
| C.3 | in the final colours only the next colour is a legal target | pass |
| C.3 | potting the black last clears the table and wins the round | pass |

### Exactly the target ball is potted

| RULES.md | Case | Result |
|---|---|---|
| C.4 | hitting a red first and potting exactly that red is a success | pass |
| C.4 | potting two reds in one shot is NOT a success (real snooker allows it, we do not): the solver must not play it | pass |
| C.4 | potting the target and another ball is NOT a success: the solver must not play it | pass |
| C.4 | potting the target while the cue ball also drops is NOT a success (it is an in-off with a pot: not playable) | pass |
| C.4 | in the colour phase, potting a different colour from the one chosen is not a success | pass |
| C.4 | hitting one red that knocks a different red in counts as a success (any red is the target in the red phase) | pass |
| C.4 | a real simulated shot ("Pot a red" from the replay page) is judged a success | pass |

### Fouls and failures end the round

| RULES.md | Case | Result |
|---|---|---|
| C.5 | the cue ball going into a pocket (and nothing else) is an IN-OFF failure | pass |
| C.5 | hitting a wrong ball first (and potting nothing) is a FOUL failure | pass |
| C.5 | in the colour phase, hitting a colour other than the chosen one first is a FOUL failure | pass |
| C.5 | missing every ball is a failure (shown as SNOOKERED when escaping a snooker) | pass |
| C.5 | hitting the right ball but potting nothing is a failure (MISSED) | pass |
| C.5 | a failed shot never pots an object ball: wrong ball first plus a pot is not playable | pass |
| C.5 | every failure ends the round, and the round remembers which failure it was | pass |
| C.5 | no shot can be played after a failure (the round is over) | pass |
| C.3 | no shot can be played after the table is cleared | pass |
| C.5 | a shot the solver must never play is refused instead of being applied | pass |

### Score and ball values

| RULES.md | Case | Result |
|---|---|---|
| C.6 | a new round starts at 0 points for both players | pass |
| C.6 | each pot scores its value: red 1, yellow 2, green 3, brown 4, blue 5, pink 6, black 7 | pass |
| C.6 | the final colours add 2 + 3 + 4 + 5 + 6 + 7 = 27 | pass |
| C.6 | the opponent score stays 0 for the whole round | pass |
| C.6 | a failed shot scores nothing | pass |

### Points remaining

| RULES.md | Case | Result |
|---|---|---|
| C.7 | before any shot, points remaining = 8 x reds + 27: 75 (6 reds), 107 (10 reds), 147 (15 reds) | pass |
| C.7 | after a red, before its colour, points remaining = 8 x reds left + 27 + 7 | pass |
| C.7 | in the final colours, points remaining = the colours still on the table (27, 25, 22, 18, 13, 7, then 0) | pass |
| C.7 | with black after every red, score + points remaining stays at the starting total after every shot | pass |
| C.7 | after a failure, points remaining are those of the shot that failed | pass |

### Opponent needs snookers

| RULES.md | Case | Result |
|---|---|---|
| C.8 | 6 reds, after 4 reds and 4 blacks: score 32, 43 remaining, snookers are NOT needed | pass |
| C.8 | 6 reds, after 5 reds and 5 blacks: score 40, 35 remaining, snookers ARE needed | pass |
| C.8 | 10 reds, after 6 reds and 6 blacks: score 48, 59 remaining, snookers are NOT needed | pass |
| C.8 | 10 reds, after 7 reds and 7 blacks: score 56, 51 remaining, snookers ARE needed | pass |
| C.8 | 15 reds, after 9 reds and 9 blacks: score 72, 75 remaining, snookers are NOT needed | pass |
| C.8 | 15 reds, after 10 reds and 10 blacks: score 80, 67 remaining, snookers ARE needed | pass |
| C.8 | score equal to points remaining means snookers are NOT needed (it must be strictly greater) | pass |

### Maximum

| RULES.md | Case | Result |
|---|---|---|
| C.9 | black after every red, then all the colours, is a maximum: 75 (6 reds), 107 (10 reds), 147 (15 reds) | pass |
| C.9 | the maximum of every level matches the config (maximumBreak) | pass |
| C.9 | one pink instead of a black: the table can still be cleared (74 with 6 reds) but it is not a maximum | pass |
| C.9 | a round that is not finished is not a maximum, even with black after every red so far | pass |

<!-- RESULTS END -->

## Rules in RULES.md with no test yet

| RULES.md | What | When |
|---|---|---|
| C.10 | Balls never leave the table or overlap | Partly covered by the physics tests (`tests/physics.test.ts`), not by the rules tests |
| A.1, A.3, A.4, A.5 | Bet, SHOOT / CASH OUT, round end, outcome first | Stage 4-5 (A.2, the ladder multipliers, is already tested in `tests/ladder.test.ts`) |
| B.1 - B.6 | Round flow (break-off, step 1, colour buttons, end messages, pocket-camera cut) | Stage 4-8 |
| D.1 - D.6 | Solver fallbacks and re-rack | Stage 4 |
| E | Rules text in the menu | Later (menu) |
| F | Not implemented on purpose | Nothing to test |

## Where RULES.md was unclear and Claude decided

Decisions 1-8 were confirmed by the owner on 2026-11-24 and are now written into RULES.md C.2-C.5.
Decision 9 (task 3.2) was confirmed by the owner on 2026-11-24 and is written into RULES.md C.7.

1. **C.4 "exactly the target ball", red phase.** Any red counts as the target. Hitting red A so that red B drops is a
   success (allowed in real snooker). The alternative would be: only the red the solver aimed at counts.
2. **C.4 / C.5, shots that are neither.** Two balls potted, target potted with an in-off, a wrong ball first plus a pot,
   or a wrong colour potted: not a success, and not a failure either (C.5 says a failure never pots a ball). The rules
   call these "invalid": the solver must never show them, and the code refuses to apply them.
3. **C.2 "spot is covered".** A spot counts as covered if a ball placed there would touch another ball (0.2 mm gap),
   not only when a ball sits exactly on it. Same as the official rule.
4. **C.2 "long centre line above its own spot" for yellow and green.** Their spots are not on the centre line, so they
   use the straight line from their own spot toward the top cushion (the official rule). For the other four colours
   this is the centre line, as written.
5. **C.2 / C.3, colour after the last red.** It is re-spotted, so the final colours start with all six on the table
   (C.3 says the order starts "after the last red and its colour").
6. **C.5 vs D.2, missing every ball.** C.5 calls it SNOOKERED, D.2 calls the "gentle tap that hits no ball" a FOUL.
   The rules code reports one type ("missed every ball"); the round flow (stage 4-5) picks the label: SNOOKERED for
   the step-1 escape, FOUL for the D.2 fallback.
7. **C.1 colour choice.** At the rules level any of the six colours may be chosen after a red. Which colours are offered
   as buttons (B.3: black always, up to 3) is decided later by the solver and the screen.
8. **Hitting the right ball and potting nothing** (plain miss or jaw rattle) is a failure, MISSED. RULES.md lists it in
   A.4 / B.4 rather than in C.5.
9. **C.7 after a failure.** Points remaining are those of the shot that failed (for example 74 if a colour was due
   with 5 reds left). RULES.md does not say what they are once the round has ended.
