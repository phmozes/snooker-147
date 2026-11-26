# NOW (max 30 lines, no history)

## Owner's turn
- RTP 50M check FAILED the |z|<3 rule on reds6 steps 13, 14, 18 (all BELOW 97%): decide next step (docs/NIGHT-3.md, bench/results/rtp-rng-50M.txt).
- Read docs/SLOW-SHOTS.md: pick a fix (or none) for the 327 shots over 3.5 s and for the 4 RE-RACKs.
- Pick a look A-D on the phone: http://192.168.1.111:5181/docs/look-options.html. Try "Replay this round" (≡ menu).
- Pick pocket drawing R1 half-moon + thin rim / R2 half-moon + leather cap (look A; Q2 kept to compare): http://192.168.1.111:5181/docs/pocket-options.html (mockup only).
- Decide: may position play be tuned (7 of 11 night-3 marks need it)?
- Answer the 5 open decisions at the top of docs/SERVER-OUTCOMES.md (before any real money).
## Claude's turn (waiting for the owner's answers)
- 2026-11-26 done: old vitest stopped (a hung debug script), RTP 50M run, npm test green 3x, SLOW-SHOTS.md. Solver is 4.10.
- Soak baseline 4.10 (bench/results/soak-n3base, rerun with shot log in soak-n3slow): stuck 0, RE-RACK 4/0/0, off table 0.
- Pace (owner 2026-11-24): median <= 1.8 s, 90% <= 2.5 s, none over 3.5 s except the last resort. docs/SPEED.md.
- Measure: bench/results/night/run.sh <tag>; big soak: bench/soak.test.ts with ROUNDS (START_I to continue, SHOTLOG=1
  for slow shots), summary node bench/soak-night3.mjs <dirs>; RTP: bench/rtp/rng50m.test.ts + rng50m-sum.mjs.
- Dev server always on port 5181 (vite.config.ts, strictPort): phone http://192.168.1.111:5181. Never another port.
  Page shows only BALANCE = stale Vite cache (504 Outdated Optimize Dep on three.js): restart with `npx vite --force`.
## Waiting on others: nothing.
## Later
- LAUNCH BLOCKER: outcomes on a server before real money (plan: docs/SERVER-OUTCOMES.md).
- Seeds above 2^32 wrap round in streamValue (seed used as 32 bits); the server note's HMAC seed plan covers it.
- Owner idea (not now): rare bonus for a 147 maximum. Must keep RTP 97%; needs its own design + RTP calc.
- Measure the solver on a real phone. Revisit friction, 1.2x playback, jaw bounce, pocket generosity on real shots.
- Voice files for 14 announcer slots (owner, stage 9-10). History strip, turbo, landscape layout, DEMO label (stage 11).
## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Outcome first (seeded RNG), shot second; visuals never change odds. No Math.random in physics/rules/solver; all numbers in config.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md. Costs (if any ever) go in EXPENSES.md.
- npm test: tests/solver.test.ts runs in its own group after the others (vitest.config.ts), so it does not time out.
