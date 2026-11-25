// Task 5.4: replay by round code. Random rounds per level are played (random cash-out step, now and then a colour that
// is not the automatic pick), the round code is taken, the round is replayed from the code alone, and every recorded
// trajectory (the break-off, step 1, every later shot, frame by frame) must be identical, as well as the end, the
// balance and the code itself. Run: N=100 npx vitest run bench/roundCode.test.ts (writes bench/results/roundcode.txt).
// tests/roundCode.test.ts runs the same check on a few rounds in npm test.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { type LevelId } from '../src/core/round';
import { parseRoundCode, replayRound, roundCodeOf } from '../src/core/roundCode';
import { buildTable } from '../src/core/table/geometry';
import { playRandomRound, recording } from '../tests/roundCodeLib';

it('round code replays the whole round', () => {
  const table = buildTable();
  const n = Number(process.env.N ?? 100);
  const levels = (process.env.LEVELS ?? 'reds6,reds10,reds15').split(',') as LevelId[];
  const out: string[] = [`solver ${CONFIG.solver.version}, ${n} rounds per level`];
  for (const level of levels) {
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    let same = 0; let shots = 0; let lettered = 0; let picked = 0; const ends: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const seed = 7_000_000 + i * 7919;
      const pa = recording(createPhysicsProvider(table, { [level]: lib }), table, level);
      const a = playRandomRound(level, seed, pa, table, i);
      const code = roundCodeOf(a.round);
      const pb = recording(createPhysicsProvider(table, { [level]: lib }), table, level);
      const b = replayRound(parseRoundCode(code)!, pb, table);
      const ok = pa.tracks.join('|') === pb.tracks.join('|') && JSON.stringify(a.round.end) === JSON.stringify(b.end)
        && a.round.balance === b.balance && roundCodeOf(b) === code;
      if (ok) same++; else out.push(`${level} MISMATCH ${code}`);
      shots += pa.tracks.length;
      if (/-[YGNBPK]+/.test(code)) lettered++;
      if (a.notAuto) picked++;
      ends[a.round.end!.type] = (ends[a.round.end!.type] ?? 0) + 1;
    }
    out.push(`${level}: ${same}/${n} rounds identical (${shots} trajectories); ends ${JSON.stringify(ends)}; codes with colour letters ${lettered}; rounds with a non-automatic colour ${picked}`);
    writeFileSync(process.env.OUT ?? 'bench/results/roundcode.txt', out.join('\n') + '\n');
    expect(same).toBe(n);
  }
}, 24 * 3_600_000);
