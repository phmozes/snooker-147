# NOW (max 30 lines, no history)

## Owner's turn
- Pushed to origin/master (github.com/phmozes/snooker-147, private) on 2026-11-27; push again only on your word.
- Phone check http://192.168.1.111:5181, in this order: the break-off (cue ball ON the baulk line, played WITH the cue);
  the game waits, SHOOT plays step 1; the baulk line, D and spots on the cloth (thin, subtle); any stutter while balls
  roll; the cue; the rail wood; "BREAK n"; the table size in your in-app browser (80-89% wide).
- Decide (design): table 80-89% wide in an in-app browser; more needs a lower camera angle or a smaller bottom area.
- Answer the 5 open decisions at the top of docs/SERVER-OUTCOMES.md (before any real money).
## Claude's turn (waiting for the owner's answers)
- Owner 2026-11-27: NO playback speed-up at all (faster shot end OFF, switch removed). Failure shots over 3 s are
  accepted as they are for now (66.8 per 1,000 failures, longest 4.54 s; docs/SLOW-SHOTS.md D).
- Owner 2026-11-27: KEEP the cue's extra 0.25 s per shot (docs/SLOW-SHOTS.md C).
- Next night run (not before): 6-red RE-RACK fix A = library rule dropping 6-red breaks that leave a red against the
  pink, new round marker v4 (v3 codes keep their library). Until then kept as is (owner 2026-11-27; night7/SUMMARY.txt).
- Night 6 done: break with the cue, table markings, break-off on the baulk line = round version v3 (v1/v2 codes keep the
  old library; proofs + soak in bench/results/night6). Frame time: markings +7% mean, no extra slow frames (FT_AB=1).
- Measure: soak bench/soak.test.ts (ROUNDS, SHOTS=1, POS410=1 = old 4.10, RNG=2 = old break library), summary
  node bench/soak-night4.mjs <dir>; replays bench/night4/fp.test.ts; marks bench/replay-shot.test.ts; scripts/*.mjs.
- Dev server: port 5181 only, phone http://192.168.1.111:5181. Only BALANCE shows = stale .vite-cache: `npx vite --host --force`.
## Later (waiting on others: nothing)
- LAUNCH BLOCKER: outcomes on a server before real money (plan: docs/SERVER-OUTCOMES.md; v2/v3 HMAC is ready for it).
- The hosted demo is an artifact: rebuild (`npm run build`, dist/) and republish it after changes.
- Not now: 147-maximum bonus (keep RTP 97%, own design); 14 announcer voice files; BACK -> casino lobby.
## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Outcome first (seeded RNG, HMAC), shot second; visuals never change odds. No Math.random in physics/rules/solver.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md. Costs (if any ever) go in EXPENSES.md.
- npm test: 294/294 on a quiet PC (2026-11-27); tests/solver.test.ts times out (60 s) only when the PC is busy.
