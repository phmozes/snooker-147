# NOW (max 30 lines, no history)

## Owner's turn
- Review docs/REVIEW.md (autonomous session 2026-11-24): tasks 0, 4.2 finish, shot budget, 4.3, 4.5, 4.6, 5.1.
- Phone: check the game page fixes (fit, no zoom/scroll/selection) at the phone address; balls now 1.4x (provisional).
- Confirm or change the "decisions to confirm" in REVIEW.md (biggest: "over 2.2 s" step before RE-RACK, pace weights).
- Then approve 4.2-5.1 or ask for changes. 4.4 and 5.2 wait for you.

## Claude's turn (after the owner's review)
- Biggest open item: RE-RACK 3-5 per 100 success shots in real rounds (RULES D.6: 1 per 100,000). Cause: pots out of a
  cluster of reds are not found. Needs a solver task (plants / splitting the pack) before real play. See docs/SOLVER.md.
- Failure shots are long (median 1.8-3.4 s); success shots in real rounds: median 1.8 s, 36-38% within 1.5 s.
- Step-1 snookered escape: built in the library (failed escape stored with each snookered break).
- Owner 2026-11-24: quickest valid shot, friction 0.05 (provisional), shot ends when all balls stop; camera C (A/B kept).
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
