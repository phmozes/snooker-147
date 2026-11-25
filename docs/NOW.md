# NOW (max 30 lines, no history)

## Owner's turn
- P.1: play about 10 rounds on the phone (dev build); each shot's cost lands in bench/results/phone-cost.jsonl. Then Claude summarises.
- Read the solver cost line in the ≡ panel (dev only) on the phone while playing. Keep marking weird shots.
- Close the old dev servers on 5174 / 5180 (they started before vite.config.ts existed).
## Claude's turn (after the owner's review)
- RTP 3c applied. Solver 4.10 done (2 of 4 long-blue marks fixed; the other 2 have one red only). Only owner-marked shots get fixed.
- Left in 4.7/4.8: hard cannons and long colour pots, shots over 3.5 s, cuts over 50 deg (mostly fallback shots).
- Pace (owner 2026-11-24): median <= 1.8 s, 90% <= 2.5 s, none over 3.5 s except the last resort. docs/SPEED.md.
- Measure: bench/results/night/run.sh <tag> (60 rounds x 3 levels, about 4 min), sum.mjs prints one line per level.
- Dev server always on port 5181 (vite.config.ts, strictPort): phone http://192.168.1.111:5181. Never another port.

## Waiting on others: nothing.
## Later
- LAUNCH BLOCKER: Before real money: outcomes decided on a server (seed never in the browser), and a way for players to verify fairness afterwards.
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
