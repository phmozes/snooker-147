# NOW (max 30 lines, no history)

## Owner's turn
- Phone check http://192.168.1.111:5181, in this order: the break-off (cue ball ON the baulk line, played WITH the cue);
  the game waits, SHOOT plays step 1; the baulk line, D and spots on the cloth (thin, subtle); any stutter while balls
  roll; the cue; the rail wood; "BREAK n"; the camera at 57° (option 1: in-app about 91% wide).
- Phone: pocket cam ~1 shot in 6 (force: menu > POCKET CAM ON NEXT SHOT); clearance replay: menu > Clearance: last ball.
- Hosted demo: dist/ rebuilt with camera 57°, not republished yet (publishing = your word).
- Server: decided 2026-11-27 (B2B, docs/SERVER-OUTCOMES.md top); next = your gambling-lawyer advice before any server work.
## Claude's turn (waiting for the owner's answers)
- Owner 2026-11-27: NO playback speed-up; failure shots over 3 s accepted for now (docs/SLOW-SHOTS.md D).
- Owner 2026-11-27: KEEP the cue's extra 0.25 s. Pocket cam AUTO ON: 1 in 6 (success = failure), P1b/P2 70/30, +0.32 s/shot.
- Next night run (not before): 6-red RE-RACK fix A (library rule: no 6-red break leaving a red against the pink, marker
  v4), THEN the big pocket-cut soak (SHOTS=1 PAIRED=1, bench/pocketcut-sum.test.ts) and new cutChance for v4.
- Measure: soak bench/soak.test.ts (ROUNDS, SHOTS=1, POS410=1 = old 4.10, RNG=2 = old break library), summary
  node bench/soak-night4.mjs <dir>; replays bench/night4/fp.test.ts; marks bench/replay-shot.test.ts; scripts/*.mjs.
- Dev server: port 5181 only, phone http://192.168.1.111:5181. Only BALANCE shows = stale .vite-cache: `npx vite --host --force`.
## Later (waiting on others: nothing)
- LAUNCH BLOCKER: outcomes on a server before real money (plan: docs/SERVER-OUTCOMES.md; v2/v3 HMAC is ready for it).
- The hosted demo is an artifact: rebuild (`npm run build`, dist/) and republish it after changes.
- Not now: 147 bonus (RTP 97%); 14 voice files; BACK -> lobby; the room behind the table (owner idea, big job).
## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Outcome first (seeded RNG, HMAC), shot second; visuals never change odds. No Math.random in physics/rules/solver.
- Free assets only (commercial licence, docs/ASSETS.md), costs in EXPENSES.md. npm test: solver.test.ts times out only on a busy PC.
- Any job expected to take more than 30 minutes needs the owner's OK first, or goes into the night run (owner 2026-11-27).
- Every task ends with the full report in docs/REPORT.md (old ones: docs/reports/<date>-<hash>.md) + a short chat version.
- Every task that changes the game: `npm run build:test` (dist-test/, dev menu, no PC posting); list its files in the report.
- Backup push: after each owner-approved task push master to origin without asking. Never other branches; never publish.
