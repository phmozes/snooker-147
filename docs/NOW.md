# NOW (max 30 lines, no history)

## Owner's turn
- Review task 1.2 (balls moving): `npm run dev`, open the printed address + `/debug.html`; click to shoot, Break, Reset. Approve before 1.3.

## Claude's turn
- Wait for approval of task 1.2. Do not start 1.3 until told.
- Task 1.2 pot rule is temporary (capture circle or past the narrowest gap = potted); 1.3 replaces it with rattles.
- Task 1.3: corner jaw radius 35 mm looks too tight; owner sees 2-3 ball widths in reference/pocket4. Compare to that photo first; add a to-scale ball to the zoomed pocket view.
- Always give the owner the dev address printed in the terminal (port 5173 is used by another project).

## Waiting on others
- Nothing.

## Later
- Voice files for the 14 announcer slots (owner supplies, stage 9-10).
- History strip, turbo mode, landscape/desktop layout, DEMO label (stage 11).

## Working rules
- Owner decides: design, money (odds, bets, RTP), publishing. Claude decides: code details, tests, commits.
- Rules are locked in docs/RULES.md. Concept changes only after asking the owner.
- Gray-box first. No visual polish until the game loop is approved.
- Tasks of about 2 hours. Stop for review after every task. Show one thing at a time.
- Outcome first (seeded RNG), shot second. Visual choices never change odds.
- No Math.random in physics, rules or solver. All numbers live in the config file.
- Free assets only, commercial-use licence, every source in docs/ASSETS.md.
- Costs (if any ever) go in EXPENSES.md.
