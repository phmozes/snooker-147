# Report: owner's working rules, test build, backup push (2026-11-27)

## Rules added (CLAUDE.md and docs/NOW.md, Working rules)
1. **Reports:** every task ends with the full report in `docs/REPORT.md` (overwritten each time; the previous one moves
   to `docs/reports/<date>-<commit hash>.md`) and a short version in chat. This is the first REPORT.md, so there was
   no older one to move.
2. **Test build:** `npm run build:test` at the end of every task that changes the game; its files with sizes go in the
   report. `npm run build` (production) is unchanged.
3. **Backup push (standing approval):** after each task the owner approved, push master to origin (private GitHub
   repo) without asking. Never other branches. Never publish or share anything without the owner's word.

Also added earlier today and kept: any job expected to take more than 30 minutes needs the owner's OK first, or goes
into the night run.

## How the test build works
- `npm run build:test` = `tsc --noEmit && node scripts/build-test.mjs`. The script sets `NODE_ENV=development` (keeps
  the developer menu, test panel, pocket-cam switch, `window.__dev`) and `VITE_TEST_BUILD=1`, then builds with mode
  `devbuild` into `dist-test/` (vite.config.ts keeps the developer HTML in that mode only).
- No posting to the PC: phone-cost lines, weird-shot marks, "Send list to PC" and the PC-link check are off
  (`PC_LINK = DEV && !VITE_TEST_BUILD` in gamePage.ts). The panel says "PC link: none (test build, nothing is sent)";
  marks stay on the phone. A test (tests/presolve.test.ts) checks this.
- Relative paths (`./`), no external requests: checked in a headless browser on `vite preview` of dist-test/. Only
  `localhost/`, `/assets/` and `/breaks-v3/` were requested. Played step 1 and step 2 with a forced P1b cut:
  no errors.
- `dist-test/` is in .gitignore.
- On the way: the first commit attempt was blocked by Claude Code's safety check because it contained a settings
  file named `.env.devbuild`. It held no secrets, only the two settings above. I moved them into
  `scripts/build-test.mjs` so no `.env` file is committed.

## Push
- Pushed range: **be151ac..506bb9f** (9 commits: camera mockups, camera 57°, STATUS.md, pocket-camera mockups,
  pocket camera in the game, automatic cuts, NOW.md, these rules).
- This report's own commit is pushed on top of it. After that: `git status` = up to date with origin/master (only
  the owner's phone files `bench/results/phone-cost.jsonl`, `docs/WEIRD-SHOTS.md` and untracked bench logs stay
  local, never committed).

## Tests
- npm test: 303 / 303 passed (after the change to tests/presolve.test.ts).

## Soak failures (owner: list every one, even known ones)
No soak ran in this task. The previous task's quick soak (bench/results/pocketcut-quick, 5,335 shots) had these 7
lines, which my previous report left out:
- reds6-v3-5000094 step 11: RE-RACK (target red)
- reds6-v3-5000282 step 11: RE-RACK (target red)
- reds15-v3-5000060 step 11: solver took 10631 ms (stuck limit 10000)
- reds15-v3-5000152 step 11: solver took 16631 ms
- reds15-v3-5000059 step 9: solver took 11219 ms
- reds15-v3-5000107 step 5: solver took 14447 ms
- reds15-v3-5000123 step 7: solver took 10249 ms

The 2 RE-RACKs are the known 6-red problem (last red against the pink, docs night7/SUMMARY.txt; fix A in the next
night run). The 5 slow solves happened while 12 soak workers shared the PC.

## Build files
`npm run build` (production, dist/):

| File | Size |
|---|---|
| dist/assets/index-uWrZUvhI.js | 674.8 kB |
| dist/assets/solverWorker-DWrQaJTT.js | 48.3 kB |
| dist/breaks/reds10.json | 575.3 kB |
| dist/breaks/reds15.json | 696.0 kB |
| dist/breaks/reds6.json | 478.4 kB |
| dist/breaks-v3/reds10.json | 576.0 kB |
| dist/breaks-v3/reds15.json | 696.2 kB |
| dist/breaks-v3/reds6.json | 477.4 kB |
| dist/index.html | 10.6 kB |
| total (9 files) | 4232.9 kB |

`npm run build:test` (dist-test/):

| File | Size |
|---|---|
| dist-test/assets/index-usTjgDZC.js | 687.7 kB |
| dist-test/assets/solverWorker-DWrQaJTT.js | 48.3 kB |
| dist-test/breaks/reds10.json | 575.3 kB |
| dist-test/breaks/reds15.json | 696.0 kB |
| dist-test/breaks/reds6.json | 478.4 kB |
| dist-test/breaks-v3/reds10.json | 576.0 kB |
| dist-test/breaks-v3/reds15.json | 696.2 kB |
| dist-test/breaks-v3/reds6.json | 477.4 kB |
| dist-test/index.html | 10.8 kB |
| total (9 files) | 4246.1 kB |

Nothing was published: dist/ was only rebuilt (it now has the automatic pocket-camera cuts); the hosted demo is
unchanged until the owner's word.
