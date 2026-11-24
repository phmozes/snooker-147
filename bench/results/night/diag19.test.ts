import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../../src/config/game.config';
import { createPhysicsProvider } from '../../../src/core/physicsProvider';
import { newRound, setLevel, shoot, start } from '../../../src/core/round';
import { solveSuccess, solveSpray, type SolveInfo } from '../../../src/core/solver';
import { buildTable } from '../../../src/core/table/geometry';
it('d', () => {
  const table = buildTable();
  const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files.reds10}`, 'utf8'));
  const out: string[] = [];
  for (const seed of [5001536, 5001744]) {
    const p = createPhysicsProvider(table, { reds10: lib });
    let r = start(setLevel(newRound(seed), 'reds10'), p, table);
    while (r.step + 1 < 18) r = shoot(r, p, table);
    const f = r.frame!;
    for (const k of ['black', 'pink', 'blue'] as const) {
      for (const b of [3000, 8000]) {
        const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
        const s = solveSuccess(f, k, table, () => 0, CONFIG.physics, b, i, { exhibition: true });
        out.push(`${seed} ${k} exh ${b}: tried ${i.tried} ${s ? s.type + ' ' + s.duration.toFixed(2) : 'none'}`);
      }
      const sp = CONFIG.solver.spray as any; const old = { o: sp.offsets, s: sp.speeds };
      sp.offsets = Array.from({ length: 21 }, (_, j) => -1 + j * 0.1); sp.speeds = [2, 2.5, 3, 3.5, 4.5, 6];
      const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
      const s = solveSpray(f, k, table, CONFIG.physics, 5000, i);
      out.push(`${seed} ${k} fine spray: tried ${i.tried} ${s ? s.type + ' ' + s.duration.toFixed(2) : 'none'}`);
      sp.offsets = old.o; sp.speeds = old.s;
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}, 1800000);
