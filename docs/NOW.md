# NOW (max 30 lines, no history)

## Owner's turn
- Read the pace investigation in docs/SOLVER.md (black shots long: physics/layout, not search). Tasks 1.1-4.1 approved.
- Test replay.html on the real phone at home (smoothness, camera feel). Open; does not block the next task.

## Claude's turn
- 4.1 done: solver (src/core/solver.ts), debug-page Solver section, tests/solver.test.ts, bench/solver.test.ts report.
- 4.1 left: about 12-18% of red and 18-39% of black layouts have no shot (see docs/SOLVER.md); handled in 4.5.
- Next: task 4.2 (failure shots) after the owner's go. Pace plan: position play + cue-ball stop (4.3-4.5); count shots, not ms.
- Balls drawn at 1.3x (owner, provisional until the real-phone test). If still too small: closer camera, not bigger balls.
- Owner 2026-11-24: quickest valid shot, friction 0.05 (provisional), shot ends when all balls stop; camera C (A/B kept).
- Always give the owner the dev address printed in the terminal (port 5173 is used by another project).

## Waiting on others: nothing.

## Later
- Measure the solver against its 150 ms budget on a real phone (1 ms per shot is a guide, not a limit).
- Revisit friction and 1.2x playback once real solver shots are visible (at 0.05, 35% of quickest shots exceed 1.5 s).
- Tune jaw bounce and pocket generosity once real shots are played (middle pockets generous on purpose for now).
- Voice files for the 14 announcer slots (owner supplies, stage 9-10).
- History strip, turbo mode, landscape/desktop layout, DEMO label (stage 11).

## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Gray-box first, no polish until the game loop is approved. Tasks of about 2 hours; stop for review after each.
- Outcome first (seeded RNG), shot second; visuals never change odds. No Math.random in physics/rules/solver; all numbers in config.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md.
- Costs (if any ever) go in EXPENSES.md.
