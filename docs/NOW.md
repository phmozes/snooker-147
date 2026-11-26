# NOW (max 30 lines, no history)

## Owner's turn
- Read docs/NIGHT-3.md. Pick a look A-D on the phone: http://192.168.1.111:5181/docs/look-options.html
- Try 5.4 on the phone: end a round, ≡ menu, "Replay this round" (or paste a code + "Replay code").
- Decide: may position play be tuned (7 of 11 night-3 marks need it)? The "none over 3.5 s" pace rule fails in the soak.
- Answer the 5 open decisions at the top of docs/SERVER-OUTCOMES.md (before any real money).
- Keep marking weird shots.
## Claude's turn (after the owner's review)
- Night 3 done: 5.4 replay by round code (300/300 rounds identical), soak baseline 3,000 rounds per level, marks
  diagnosed, solver 4.11 tried and reverted (paired soak worse), look options page, server note. Solver is 4.10.
- Soak baseline 4.10 (bench/results/soak-n3base/night3.txt): stuck 0, RE-RACK 4/0/0 (all 6 reds step 11), off table 0,
  success vs p within 3 sd on every step; over 3.5 s not last resort 147/115/65 shots.
- Pace (owner 2026-11-24): median <= 1.8 s, 90% <= 2.5 s, none over 3.5 s except the last resort. docs/SPEED.md.
- Measure: bench/results/night/run.sh <tag> (60 rounds x 3 levels); big soak: bench/soak.test.ts with ROUNDS
  (and START_I to continue), summary node bench/soak-night3.mjs <dirs>.
- Dev server always on port 5181 (vite.config.ts, strictPort): phone http://192.168.1.111:5181. Never another port.
- A vitest worker started 2026-11-25 18:42 by an earlier session was still running at 04:00 (6.5 h CPU); not stopped.
## Waiting on others: nothing.
## Later
- LAUNCH BLOCKER: outcomes on a server before real money (plan: docs/SERVER-OUTCOMES.md).
- Owner idea (not now): rare bonus for a 147 maximum. Must keep RTP 97%; needs its own design + RTP calc.
- Measure the solver on a real phone. Revisit friction, 1.2x playback, jaw bounce, pocket generosity on real shots.
- Voice files for 14 announcer slots (owner, stage 9-10). History strip, turbo, landscape layout, DEMO label (stage 11).
## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Outcome first (seeded RNG), shot second; visuals never change odds. No Math.random in physics/rules/solver; all numbers in config.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md. Costs (if any ever) go in EXPENSES.md.
- npm test: tests/solver.test.ts (60 s limit) times out when the PC is busy; it passes alone (36 s).
