# NOW (max 30 lines, no history)

## Owner's turn
- Play rounds on the phone; mark weird shots (developer menu) and send the copied list. Read docs/REVIEW.md 1-3.
- Task 4.7 (natural shots) partly reached: natural 71-73% (target 90%), exhibition 7% (target 2%). Decide: go on.

## Claude's turn (after the owner's review)
- Task 4.7 next: planned pack-cannon search (reds packed after the black), fewer long pots. docs/SOLVER.md "Task 4.7".
- RE-RACK: 0 in 338 success shots of real rounds now; soak test (5.5) will measure against 1 per 100,000.
- Owner 2026-11-24: realism first; RULES B.3 auto colour black/pink/blue; cap per decision fixed (shotCaps, 11,334).
- Owner 2026-11-24: quickest valid shot, friction 0.05 (provisional), shot ends when all balls stop; camera C (A/B kept).
- Always give the owner the dev address printed in the terminal (port 5173 is used by another project).

## Waiting on others: nothing.

## Later
- Owner idea (not now): rare bonus for a 147 maximum. Must keep RTP 97%; colour choice or a blocked black must never change money by accident. Needs its own design + RTP calc.
- Measure the solver on a real phone (250-shot budget: about 150 ms here; the wide search up to 1.8 s here).
- Revisit friction and 1.2x playback once real rounds are visible on screen.
- Tune jaw bounce and pocket generosity once real shots are played (middle pockets generous on purpose for now).
- Voice files for 14 announcer slots (owner, stage 9-10). History strip, turbo, landscape layout, DEMO label (stage 11).

## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Gray-box first, no polish until the game loop is approved. Tasks of about 2 hours; stop for review after each.
- Outcome first (seeded RNG), shot second; visuals never change odds. No Math.random in physics/rules/solver; all numbers in config.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md. Costs (if any ever) go in EXPENSES.md.
