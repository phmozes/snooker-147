# NOW (max 30 lines, no history)

## Owner's turn
- Read docs/NIGHT-REPORT.md (40 lines) and confirm the decisions in its part 5.
- On the phone: try the TEST PANEL (≡ menu, dev only) and play rounds; flag weird shots (docs/WEIRD-SHOTS.md).
- Decide: more solver work (natural 87-88% at 6/15 reds, target 90%) or move on (5.4 replay by code, stage 6).

## Claude's turn (after the owner's review)
- Solver 4.8f. Strict natural 86.9 / 91.0 / 88.2%, exhibition 1.0 / 1.3 / 1.8% (6/10/15 reds), RE-RACK 0 in 60 rounds.
- Soak (task 5.5): docs/SOAK-FAILURES.md, bench/results/soak/summary.txt. RULES D.6: at most 1 RE-RACK per 100k.
- Left in 4.7/4.8: hard cannons and long colour pots, shots over 3.5 s, cuts over 50 deg (mostly fallback shots).
- Pace (owner 2026-11-24): median <= 1.8 s, 90% <= 2.5 s, none over 3.5 s except the last resort. docs/SPEED.md.
- Measure: bench/results/night/run.sh <tag> (60 rounds x 3 levels, about 4 min), sum.mjs prints one line per level.
- Always give the owner the dev address printed in the terminal (port 5173 is used by another project).

## Waiting on others: nothing.

## Later
- Owner idea (not now): rare bonus for a 147 maximum. Must keep RTP 97%; colour choice or a blocked black must never change money by accident. Needs its own design + RTP calc.
- Measure the solver on a real phone (rescue and colour-pick rescue can cost a few thousand simulated shots).
- Revisit friction and 1.2x playback once real rounds are visible on screen.
- Tune jaw bounce and pocket generosity once real shots are played (middle pockets generous on purpose for now).
- Voice files for 14 announcer slots (owner, stage 9-10). History strip, turbo, landscape layout, DEMO label (stage 11).

## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Gray-box first, no polish until the game loop is approved. Tasks of about 2 hours; stop for review after each.
- Outcome first (seeded RNG), shot second; visuals never change odds. No Math.random in physics/rules/solver; all numbers in config.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md. Costs (if any ever) go in EXPENSES.md.
