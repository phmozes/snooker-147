# NOW (max 30 lines, no history)
## Owner's turn
- 2026-11-28 player cams round 2 (docs/REPORT.md, RULES B.7): TODAY 75 / V2 15 / V1 10, V3 out, middle-pocket view, no glide >3.1 s: phone-check dose + middle view
- 2026-11-28 (docs/reports/2026-11-28-433ab97.md, waiting): strip frame fix + % under the chips (option C). Phone-check both, the
  captions (dev menu CAPTIONS) and the Rules box table. Speed idea 3 (hosting) open.
- Phone check http://192.168.1.111:5181, in this order: the break-off (cue ball ON the baulk line, played WITH the cue);
  the game waits, SHOOT plays step 1; the baulk line, D and spots on the cloth (thin, subtle); any stutter while balls
  roll; the cue; the rail wood; "BREAK n"; the camera at 57° (option 1: in-app about 91% wide).
- Phone: pocket cam ~1 shot in 6 (force: menu > POCKET CAM ON NEXT SHOT); clearance replay: menu > Clearance: last ball.
- Sounds: pocket x0.4 (heard as the ball is SEEN dropping); applause 1-6; miss sound B in the game (vol 0.7, dev: MISS button).
- Hosted demo: dist/ rebuilt with camera 57°, not republished yet (publishing = your word).
- Server: decided 2026-11-27 (B2B, docs/SERVER-OUTCOMES.md top); next = your gambling-lawyer advice before any server work.
## Claude's turn (waiting for the owner's answers)
- Owner 2026-11-27: NO playback speed-up (failure shots over 3 s OK, SLOW-SHOTS.md D); KEEP the cue's extra 0.25 s;
  pocket cam AUTO ON 1 in 6 (success = failure), P1b/P2 70/30, +0.32 s/shot.
- 6 reds v4: about 10 RE-RACKs per 100,000 shots, accepted for now (owner 2026-11-28); the remaining ones are the last red at step 11, to be fixed in shot choice later.
- Measure: soak bench/soak.test.ts (ROUNDS, SHOTS=1, POS410=1, RNG=2), sum bench/soak-night4.mjs; replays bench/night4/fp.test.ts.
- Dev server: port 5181 only, phone http://192.168.1.111:5181. Only BALANCE shows = stale .vite-cache: `npx vite --host --force`.
## Later (waiting on others: nothing)
- LAUNCH BLOCKER: outcomes on a server before real money (plan: docs/SERVER-OUTCOMES.md; v2/v3 HMAC is ready for it).
- The hosted demo is an artifact: rebuild (`npm run build`, dist/) and republish it after changes.
- Not now: 147 bonus (RTP 97%); 14 voice files; BACK -> lobby; the room behind the table (owner idea, big job).
## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Outcome first (seeded RNG, HMAC), shot second; visuals never change odds. No Math.random in physics/rules/solver.
- Free assets only (commercial licence, docs/ASSETS.md), costs in EXPENSES.md. Check code with `npm test` (tests/ only; solver.test.ts times out only on a busy PC). Never `npx vitest run` on the whole repo.
- Any job expected to take more than 30 minutes needs the owner's OK first, or goes into the night run (owner 2026-11-27).
- Every task ends with the full report in docs/REPORT.md (old ones: docs/reports/<date>-<hash>.md) + a short chat version.
- Every task that changes the game: `npm run build:test` (dist-test/, dev menu, no PC posting); list its files in the report.
- Backup push: after each owner-approved task push master to origin without asking. Never other branches; never publish.
