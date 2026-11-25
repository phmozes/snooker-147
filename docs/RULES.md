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
6. **RTP (option 3c, owner 2026-11-25).** p(step) is the config table; it falls strictly from step to step and the
   cash-out RTP is 97.00% or a little below at every step, never above. Shown to the player (computed by code,
   src/core/ladder.ts rtpText; tests/ladder.test.ts checks these lines against the config):
   - 6 reds: RTP 97% at every cash-out step
   - 10 reds: RTP 97% (between 96.94% and 97%, depending on the cash-out step)
   - 15 reds: RTP 97% (between 96.42% and 97%, depending on the cash-out step)

## B. Round flow
1. START -> balls re-rack quickly -> the OPPONENT plays the break-off (taken from the pre-computed library).
2. Step 1 (our first red) plays automatically, no button.
   - Success: break was of kind "red pottable"; we pot a red.
   - Failure: 80% plain miss after the break, 20% "snookered" (break leaves us snookered, our escape fails = foul).
3. From step 2: SHOOT / CASH OUT before every shot. On colour steps (while reds remain) the player picks a colour.
   Offered: BLACK always, plus every other colour with a ready pot, up to 3 buttons, higher values first.
   The choice changes only the snooker score. Until the colour-choice stage, the game picks the colour automatically
   (owner, 2026-11-24, confirmed; 2026-11-25 approved): black, else pink, else blue: the first whose shot is natural
   AND leaves a natural red (the same test for all three). If none passes: the first with a shot in time that keeps
   the next red reachable; else a rescue search for each colour (the first that leaves a red pottable by any shot;
   a natural one first, then one in time); else the first natural colour shot; else any colour shot; else black.
   The pick depends only on the layout, never on the decided outcome, and changes only the snooker score, never the
   odds or the money.
   In the final colours (yellow ... black) only one ball is legal, so SHOOT is shown and the label names the colour.
4. End: cash out ("WON <amount> · x<mult>"), failure (MISSED / IN-OFF / FOUL / SNOOKERED), RE-RACK (see D.4), or
   clearance (big message on the empty cloth, max 3 s, tap to skip). No modal, no separate screen. Balls stay until
   the next START.
5. After a cash out we never show what the next shot would have been.
6. **Pocket-camera cut must never reveal the result.** From step 2, the cut to a pocket camera (same timing, same slow
   motion) is played on a share of rattles AND on a share of successful pots. Both rates are in the config and are set
   so that P(cut | success) = P(cut | failure). The clearance finale does not cut during the shot: the final pot plays
   from the main camera, then is replayed from the pocket camera in slow motion.

## C. Snooker rules (simplified: only our player shoots after the break)
1. **Order:** red, colour, red, colour ... While reds remain, a pot of a red is followed by a pot of one colour.
2. **Re-spotting:** while reds remain, a potted colour returns to its own spot. A spot is covered when a ball placed
   there would touch another ball. If the spot is covered: the highest free spot (black, pink, blue, brown, green,
   yellow); if none free, the nearest free point on the straight line from its own spot toward the top cushion
   (the long centre line for black, pink, blue and brown; a parallel line through their own spot for yellow and
   green), else on the same line below its own spot.
3. **Last red:** the colour potted after the last red is re-spotted. After that, the colours are potted in order
   yellow, green, brown, blue, pink, black, and they stay down (not re-spotted).
4. **A success shot** pots exactly the target ball and nothing else; the cue ball stays on the table.
   In the red phase any red is the target (hitting one red that knocks another red in is a success).
   (Real snooker allows two reds in one shot; we do not, to keep 1 pot = 1 step.) A shot that pots two balls, or
   the target plus the cue ball, is neither a success nor a failure: it is invalid and is never shown.
5. **Failures and fouls** (all end the round): right ball hit but nothing potted (MISSED), cue ball potted
   (IN-OFF), hitting a wrong ball first (FOUL), missing every ball. "Missing every ball" is one type; its label is
   SNOOKERED for the step-1 escape and FOUL for the D.2 fallback. A failed shot never pots any ball except the
   cue ball in an in-off.
6. **Values:** red 1, yellow 2, green 3, brown 4, blue 5, pink 6, black 7. Opponent score is always 0.
7. **Points remaining:** red next = 8 x redsLeft + 27; after a red, before its colour = 8 x redsLeft + 27 + 7;
   final colours = sum of colours still on the table. After a failure, points remaining stay at the value of the
   shot that failed.
8. **Opponent needs snookers** = playerScore > pointsRemaining (strictly).
9. **Maximum** = table cleared with black after every red (75 / 107 / 147).
10. Balls never leave the table, never overlap, and every movement has a visible physical cause.

## D. When the solver finds no shot (the decided outcome NEVER changes)
The solver works out the next shot for both outcomes while the player is still deciding, so a problem is
known before SHOOT is pressed. Every fallback is logged with the round code and step.
1. **Step 1** never needs a fallback: every break in the library is stored together with a step-1 shot
   that was already tested offline.
2. **Failure outcomes** are always possible. If the chosen failure type cannot be found, use a plain miss.
   If no plain miss is found, play a soft shot that hits the wrong ball first (FOUL). If even that fails, tap the
   cue ball gently so it hits no ball at all (FOUL). A gentle tap can always be played.
3. **Success outcomes** go through the flex chain in this order (every pocket and every ball of the right type are
   searched at each step; updated 2026-11-25, owner approved): normal search; longer shot time (up to
   `maxDurationFlex`); wide search (more angles, powers and spins, natural shots only); **rescue** (only when every
   shot found leaves the next ball unpottable: a search for a shot that keeps the next ball pottable); any natural
   shot found anyway (even longer than `maxDurationFlex`); exhibition (cushion-first, plants, kisses, far pockets);
   **doubles**; spray. A last-resort shot (exhibition, doubles, spray) must leave a pottable ball for the next step
   if any of them can (`solver.lastResortCheck`); if none can, the first one is played anyway.
4. **Last resort: RE-RACK.** This happens only if a success is decided and still no shot exists. The pot counts and
   no shot is played. The ladder strip advances one step and shows "RE-RACK · WON <amount> · x<multiplier>" at the NEW
   multiplier. The balance counts up and the bet area returns, just like after a normal cash out. An optional
   announcer slot says "Re-rack". The odds and the RTP do not change.
5. **Colour steps:** a colour is offered only if both its success shot and its failure shot were found. The one
   exception is black, which is always offered. If black is picked and has no success shot, rule 4 applies.
6. The soak test fails if rule 4 happens more than once in 100,000 shots.

## E. In-game rules text (menu) must include
"In the rare case of a stalemate (re-rack), the round ends and you are paid the next step's multiplier."

## F. Not implemented
Free ball, miss rule, re-racking after a foul, push shot, touching ball, side spin (maybe later), opponent turns.
