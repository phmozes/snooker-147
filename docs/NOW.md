# NOW (max 30 lines, no history)

## Owner's turn
- Test replay.html on the real phone at home (smoothness, camera feel). 1.1-4.1 approved; 4.2 NOT yet approved.

## Claude's turn (first thing next session, before 4.3; then the owner checks again and approves 4.2)
1. Explain why a plain miss is often not found (owner's Run 20, 6 reds, red due: 7 of 20 nothing) and fix it.
2. Build the last D.2 fallbacks (soft wrong-ball-first shot, gentle tap that hits nothing): "nothing found" = 0; test it.
3. In-off found in only about 6 of 20: say whether that is acceptable or can be improved.
4. Step-1 snookered escape waits for task 4.6.
- Pace plan for 4.3-4.5: position play + cue-ball stop; solver counts shots, not ms.
- Balls drawn at 1.3x (owner, provisional until the real-phone test). If still too small: closer camera, not bigger balls.
- Owner 2026-11-24: quickest valid shot, friction 0.05 (provisional), shot ends when all balls stop; camera C (A/B kept).
- Always give the owner the dev address printed in the terminal (port 5173 is used by another project).

## Waiting on others: nothing.

## Later
- Measure the solver against its 150 ms budget on a real phone (1 ms per shot is a guide, not a limit).
- Revisit friction and 1.2x playback once real solver shots are visible (at 0.05, 35% of quickest shots exceed 1.5 s).
- Tune jaw bounce and pocket generosity once real shots are played (middle pockets generous on purpose for now).
- Voice files for 14 announcer slots (owner, stage 9-10). History strip, turbo, landscape layout, DEMO label (stage 11).

## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Gray-box first, no polish until the game loop is approved. Tasks of about 2 hours; stop for review after each.
- Outcome first (seeded RNG), shot second; visuals never change odds. No Math.random in physics/rules/solver; all numbers in config.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md.
- Costs (if any ever) go in EXPENSES.md.
