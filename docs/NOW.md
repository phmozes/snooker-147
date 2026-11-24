# NOW (max 30 lines, no history)

## Owner's turn
- Play rounds; flag weird shots (they land in docs/WEIRD-SHOTS.md). Read docs/REVIEW.md 5.
- 4.7 strict: natural 85 / 91 / 84%, exhibition 3.2 / 1.3 / 2.8% (6/10/15 reds). Decide: go on or move to 5.3.

## Claude's turn (after the owner's review)
- 4.7 left: long red pots after a colour, hard cannons, cushion-first reds (last resort); 6 and 15 reds below 90%.
- Pace (owner 2026-11-24, replaces 1-1.5 s): median <= 1.8 s, 90% <= 2.5 s, none over 3.5 s except the last resort
  before RE-RACK; realism before speed. Now 1-4 shots per level over 3.5 s. docs/SPEED.md.
- Strict naturalness (owner): docs/SOLVER.md 4.7 third part. Solver 4.7c. RE-RACK 0 in 1,124 real-round shots.
- Owner 2026-11-24: B.3 auto colour; breaks keep baulk colours + blue within 2 cm; caps fixed (shotCaps); camera C.
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
