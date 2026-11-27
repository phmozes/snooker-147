# NOW (max 30 lines, no history)

## Owner's turn
- Nothing pushed: night-4 + night-5 commits wait on master for your word (`git log --oneline f534502..`).
- Phone check http://192.168.1.111:5181, in this order: START -> break -> the game WAITS, SHOOT plays step 1 (no CASH OUT
  before it); the cue (flat, on the shot line); the rail wood; "BREAK n" left under the ladder; the table size in your
  phone's in-app browser (bigger, not yet full width); failure shots (a few still run over 3 s).
- 4.11p is now the default (your decision 2026-11-27) although its paired soak failed: fallback % 6 reds 54.6->57.4,
  10 reds 53.0->57.0; shots over 3.5 s 50->52 / 37->47 / 21->28 (NIGHT-4). Marks: 2 fixed, 4 better. May be improved later.
- Decide: faster shot end ON? Cue time 0.25 s: keep? (both still open from night 4, docs/SLOW-SHOTS.md C)
- Decide: failure shots over 3.0 s only fell 73.9 -> 66.8 per 1,000 failures (longest 4.54 s; your 4.61 s in-off has no
  shorter in-off). A real 3.0 s cap needs faster playback of failure endings or other-looking failures (SLOW-SHOTS.md D).
- Decide (design): the table fills 80-89% of the width in an in-app browser, not 100%; more needs a lower camera angle
  or a smaller bottom area. Want one of those?
- Answer the 5 open decisions at the top of docs/SERVER-OUTCOMES.md (before any real money).
## Claude's turn (waiting for the owner's answers)
- 2026-11-27 night 5 done (see the owner's list above). Pace rule (owner 2026-11-24): docs/SPEED.md.
- Measure: soak bench/soak.test.ts (ROUNDS, SHOTS=1, POS410=1 for the old 4.10), summary node bench/soak-night4.mjs <dir>;
  replays bench/night4/fp.test.ts; marks bench/replay-shot.test.ts; browser checks scripts/*.mjs (puppeteer-core).
- Dev server always on port 5181 (vite.config.ts, strictPort): phone http://192.168.1.111:5181. Never another port.
  Page shows only BALANCE = stale Vite cache (504 Outdated Optimize Dep on three.js): restart with `npx vite --force`.
## Later (waiting on others: nothing)
- LAUNCH BLOCKER: outcomes on a server before real money (plan: docs/SERVER-OUTCOMES.md; v2 HMAC is ready for it).
- Not now: 147-maximum bonus (keep RTP 97%, own design); 14 announcer voice files; BACK -> casino lobby.
## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Outcome first (seeded RNG v2), shot second; visuals never change odds. No Math.random in physics/rules/solver.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md. Costs (if any ever) go in EXPENSES.md.
- npm test: tests/solver.test.ts runs alone after the others; it times out (60 s) when soaks run at the same time.
