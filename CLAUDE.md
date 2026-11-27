# 147 (snooker-147)
Read `docs/NOW.md` first. It holds the current task, the owner's turn and the working rules.
Rules of the game: `docs/RULES.md`. Build plan: `docs/PLAN.md`. Every tunable number: `src/config/game.config.ts`. Pure core (no rendering): `src/core/`.
Invoke the `project-discipline` skill at the start and end of every session.
Reply to the owner in simple English (the owner is a programming beginner).
Separate project from pingpong-crash: never touch files there.
Any job expected to take more than 30 minutes needs the owner's OK first, or goes into the night run.
End every task with the full report in `docs/REPORT.md` (overwrite; move the old one to `docs/reports/<date>-<hash>.md`) and a short version in chat.
Every task that changes the game: run `npm run build:test` (dist-test/: developer menu, no PC posting) and list its files with sizes in the report. `npm run build` stays production.
Backup push (standing approval): after each task the owner approved, push master to origin. Never push other branches. Never publish or share anything without the owner's word.
To check code run `npm test` (tests/ only). Never `npx vitest run` on the whole repo: it also starts the bench and soak runs.
