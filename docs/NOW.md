# NOW (max 30 lines, no history)

## Owner's turn
- Say "go" for task 2.1 (Three.js gray-box table, playback of a recording). Tasks 1.1-1.4 are approved.

## Claude's turn
- Next: task 2.1, after the owner's go.
- Pace (provisional, owner 2026-11-24): solver picks the quickest valid shot, cloth friction 0.05. Shot ends when all balls stop.
- Always give the owner the dev address printed in the terminal (port 5173 is used by another project).

## Waiting on others
- Nothing.

## Later
- Measure the solver against its 150 ms budget on a real phone (1 ms per shot is a guide, not a limit).
- Revisit friction and 1.2x playback once real solver shots are visible (at 0.05, 35% of quickest shots exceed 1.5 s).
- Tune jaw bounce and pocket generosity once real shots are played (middle pockets generous on purpose for now).
- Voice files for the 14 announcer slots (owner supplies, stage 9-10).
- History strip, turbo mode, landscape/desktop layout, DEMO label (stage 11).

## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Gray-box first. No visual polish until the game loop is approved.
- Tasks of about 2 hours. Stop for review after every task. Show one thing at a time.
- Outcome first (seeded RNG), shot second. Visual choices never change odds.
- No Math.random in physics, rules or solver. All numbers live in the config file.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md.
- Costs (if any ever) go in EXPENSES.md.
