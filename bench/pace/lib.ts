// Pace investigation (owner, after task 4.1): quickest success shot with the 150 ms budget vs a long search.
import { writeFileSync } from 'node:fs';
import { createSim, runUntilStill, strike } from '../../src/core/physics/sim';
import { mulberry32 } from '../../src/core/rng';
import { randomLayout, solveSuccess } from '../../src/core/solver';
import { buildTable } from '../../src/core/table/geometry';

export const LONG_SHOTS = 3000; // about 12x the normal shot budget
export function run(reds: number, due: 'red' | 'colour', n: number, outFile: string) {
  const table = buildTable();
  const now = () => performance.now();
  const rng = mulberry32(reds * 1000 + (due === 'red' ? 11 : 22));
  const rows = [];
  for (let i = 0; i < n; i++) {
    const L = randomLayout(rng, reds, due, table);
    const target = due === 'red' ? 'red' : 'black';
    const short = solveSuccess(L, target, table, now);
    const long = solveSuccess(L, target, table, now, undefined, LONG_SHOTS);
    let potT = null;
    if (long) {
      const sim = createSim(L.balls, table);
      strike(sim, 'cue', long.dir, long.speed, long.spin);
      runUntilStill(sim);
      const e = sim.events.find((x) => x.type === 'pot' && x.a === long.target);
      potT = e ? e.t : null;
    }
    const cue = L.balls.find((b) => b.kind === 'cue')!.pos; const blk = L.balls.find((b) => b.id === 'black')!.pos;
    rows.push({ cueToBlack: Math.hypot(cue.x - blk.x, cue.y - blk.y), short: short?.duration ?? null, long: long?.duration ?? null, potT, longTried: long?.tried ?? 0, speed: long?.speed, spin: long?.spin });
  }
  writeFileSync(outFile, JSON.stringify(rows));
}
