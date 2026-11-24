# 147 - Rules we implement (locked; change only with the owner's OK)

## A. The money game
1. Player picks a level (6 / 10 / 15 reds), sets a bet (1-100) and presses START. The bet is locked.
2. Each successful pot = one step up the ladder (18 / 26 / 36 steps). Multiplier after step k is in the config.
3. Before every shot from step 2 on: SHOOT (continue) or CASH OUT (receive bet x current multiplier).
4. A failed shot ends the round; the bet is lost. Clearing the table pays the top multiplier (x25 / x50 / x100).
5. **Outcome first.** Before a shot is shown, the seeded RNG decides success/failure using p(step).
   p depends only on the step number, never on the ball or colour picked. Then the solver finds a
   physically valid shot that matches the outcome. Nothing visual (ball, pocket, difficulty, failure type,
   variety, fluke) ever changes the odds.

## B. Round flow
1. START -> balls re-rack quickly -> the OPPONENT plays the break-off (taken from the pre-computed library).
2. Step 1 (our first red) plays automatically, no button.
   - Success: break was of kind "red pottable"; we pot a red.
   - Failure: 80% plain miss after the break, 20% "snookered" (break leaves us snookered, our escape fails = foul).
3. From step 2: SHOOT / CASH OUT before every shot. On colour steps the player picks one of 2-3 offered colours
   (BLACK is always offered; the choice changes only the snooker score). Until the colour-choice stage, the game
   picks the colour automatically.
4. End: cash out ("WON <amount> - x<mult>"), failure (MISSED / IN-OFF / FOUL / SNOOKERED), or clearance
   (big message on the empty cloth, max 3 s, tap to skip). No modal, no separate screen. Balls stay until the next START.
5. After a cash out we never show what the next shot would have been.

## C. Snooker rules (simplified: only our player shoots after the break)
1. **Order:** red, colour, red, colour ... While reds remain, a pot of a red is followed by a pot of one colour.
2. **Re-spotting:** while reds remain, a potted colour returns to its own spot. If the spot is covered: the highest
   free spot (black, pink, blue, brown, green, yellow); if none free, the nearest free point on the long centre line
   above its own spot (toward the top cushion), else below it.
3. **Last red:** after the last red and its colour, the colours are potted in order yellow, green, brown, blue,
   pink, black, and they stay down (not re-spotted).
4. **A success shot** pots exactly the target ball and nothing else; the cue ball stays on the table.
   (Real snooker allows two reds in one shot; we do not, to keep 1 pot = 1 step.)
5. **Fouls** (all end the round as a failure): cue ball potted (IN-OFF), hitting a wrong ball first (FOUL),
   missing every ball (escape from a snooker fails = SNOOKERED). A failed shot never pots any ball except the
   cue ball in an in-off.
6. **Values:** red 1, yellow 2, green 3, brown 4, blue 5, pink 6, black 7. Opponent score is always 0.
7. **Points remaining:** red next = 8 x redsLeft + 27; after a red, before its colour = 8 x redsLeft + 27 + 7;
   final colours = sum of colours still on the table.
8. **Opponent needs snookers** = playerScore > pointsRemaining (strictly).
9. **Maximum** = table cleared with black after every red (75 / 107 / 147).
10. Balls never leave the table, never overlap, and every movement has a visible physical cause.

## D. Not implemented
Free ball, miss rule, re-racking after a foul, push shot, touching ball, side spin (maybe later), opponent turns.
