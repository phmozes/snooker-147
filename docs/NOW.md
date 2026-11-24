# NOW (max 30 lines, no history)

## Owner's turn
- Play rounds on the phone; tap the flag (top-left of the table) on weird shots: they land in docs/WEIRD-SHOTS.md.
- Read docs/REVIEW.md 4. Natural 85 / 89 / 83% (6 / 10 / 15 reds), exhibition 4 / 1.7 / 7%. Decide: go on with 4.7?

## Claude's turn (after the owner's review)
- 4.7 left: 15 reds (cushion-first when the pack stays tight late; 2 RE-RACKs in 177), long pots 6-7%, 6 reds 85%/4%.
  Idea: plan two shots ahead for colours (which colour shot opens the pack AND keeps a natural red). docs/SOLVER.md.
- Replay owner's marks: SHOTS="code:step" npx vitest run bench/replay-shot.test.ts (same solver version only).
- Owner 2026-11-24: realism first; B.3 auto colour; breaks keep baulk colours + blue within 2 cm; caps fixed (shotCaps).
- Owner 2026-11-24: quickest valid shot, friction 0.05 (provisional), shot ends when all balls stop; camera C (A/B kept).
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
