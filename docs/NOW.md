# NOW (max 30 lines, no history)

## Owner's turn
- Play real rounds on the phone (task 5.2) and read docs/REVIEW.md: small fixes, 5.2, three small choices to confirm.
- Then decide: approve 5.2, and when to start the RE-RACK / pace solver task (SHOOT can wait 1-3 s on hard layouts).

## Claude's turn (after the owner's review)
- Biggest open item: RE-RACK 1-3 per 100 success shots in real rounds (RULES D.6: 1 per 100,000). Cause: black boxed
  in by reds, pots out of a cluster. Needs a solver task (position for the black, plants) before real play. docs/SOLVER.md. Waits for the owner.
- Failure shots are long (median 1.8-3.4 s); success shots in real rounds: median 1.7 s, about 40% within 1.5 s.
- Step-1 snookered escape: built in the library (failed escape stored with each snookered break).
- Owner 2026-11-24: shot cap per decision fixed (shotCaps, 5,766); quickest valid shot, friction 0.05 (provisional), shot ends when all balls stop; camera C (A/B kept).
- Always give the owner the dev address printed in the terminal (port 5173 is used by another project).

## Waiting on others: nothing.

## Later
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
