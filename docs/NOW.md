# NOW (max 30 lines, no history)

## Owner's turn
- Read docs/NIGHT-4.md (summary table at the top). Nothing pushed; 10 commits on master wait for your word.
- Phone check http://192.168.1.111:5181: new table look, cue, phone layout, free replay. ≡ menu = dev switches
  (TABLE LOOK club/gray, CUE on/off, FASTER SHOT END off/on, POSITION PLAY 4.10/4.11p). Watch for stutter.
- Decide: faster shot end ON? (removes every non-last-resort success shot over 3.5 s; docs/SLOW-SHOTS.md C).
- Decide: the cue adds 0.25 s per shot (median 1.55 -> 1.80 s) — keep, shorten, or pair with the faster end?
- Decide: 4.11p failed its paired soak (more fallback and long shots) but fixed/improved 6 of 12 marks. Drop or retune?
- Decide: cap the length of failure shots (newest mark: a 4.61 s in-off, cause in NIGHT-4 "Extra").
- Answer the 5 open decisions at the top of docs/SERVER-OUTCOMES.md (before any real money).
## Claude's turn (waiting for the owner's answers)
- 2026-11-27 night 4 done: look + cue + layout in the game, generator v2 (200M PASS), free replay, 3b/3c behind switches.
- Soak baseline v2 (bench/results/soak-n4base): stuck 0, RE-RACK 2/0/0, off table 0, success vs p within 3 sd.
- Pace (owner 2026-11-24): median <= 1.8 s, 90% <= 2.5 s, none over 3.5 s except the last resort. docs/SPEED.md.
- Measure: soak bench/soak.test.ts (ROUNDS, SHOTS=1 per-shot log, POS411P=1), summary node bench/soak-night4.mjs <dir>;
  replays bench/night4/fp.test.ts; marks bench/replay-shot.test.ts; browser checks scripts/*.mjs (puppeteer-core).
- Dev server always on port 5181 (vite.config.ts, strictPort): phone http://192.168.1.111:5181. Never another port.
  Page shows only BALANCE = stale Vite cache (504 Outdated Optimize Dep on three.js): restart with `npx vite --force`.
## Waiting on others: nothing.
## Later
- LAUNCH BLOCKER: outcomes on a server before real money (plan: docs/SERVER-OUTCOMES.md; v2 HMAC is ready for it).
- Owner idea (not now): rare bonus for a 147 maximum. Must keep RTP 97%; needs its own design + RTP calc.
- Voice files for 14 announcer slots (stage 9-10; the mute switch exists). BACK button -> casino lobby (TODO).
## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Outcome first (seeded RNG v2), shot second; visuals never change odds. No Math.random in physics/rules/solver.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md. Costs (if any ever) go in EXPENSES.md.
- npm test: tests/solver.test.ts runs in its own group after the others (vitest.config.ts), so it does not time out.
