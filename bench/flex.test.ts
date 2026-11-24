// Run with: npx vitest run bench/flex.test.ts  (how often each flex step and RE-RACK happen; random layouts)
import { it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { randomLayout, solveSuccessFlex, type FlexLevel } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';

it('flex report', () => {
  const table = buildTable(); const now = () => performance.now(); const lines: string[] = [];
  const n = Number(process.env.N ?? 60);
  for (const [reds, due] of [[6, 'red'], [15, 'red'], [6, 'colour'], [15, 'colour']] as const) {
    const rng = mulberry32(reds * 31 + (due === 'red' ? 1 : 2));
    const count: Record<FlexLevel, number> = { normal: 0, longerDuration: 0, wideSearch: 0, rescue: 0, overLong: 0, exhibition: 0, spray: 0, reRack: 0 };
    let ms = 0; let maxMs = 0; const over: number[] = [];
    for (let i = 0; i < n; i++) {
      const L = randomLayout(rng, reds, due, table);
      const target = due === 'red' ? 'red' : 'black';
      const t0 = performance.now();
      const f = solveSuccessFlex(L, target, table, now, { roundCode: 'bench', step: i });
      const dt = performance.now() - t0; ms += dt; maxMs = Math.max(maxMs, dt);
      count[f.level]++;
      if (f.level === 'overLong') over.push(f.shot!.duration);
    }
    lines.push(`${reds} reds ${due}: normal ${count.normal}, longer time ${count.longerDuration}, wide search ${count.wideSearch}, over 2.2 s ${count.overLong} (median ${over.sort((a, b) => a - b)[over.length >> 1]?.toFixed(2) ?? '-'} s), RE-RACK ${count.reRack} of ${n}` +
      `; compute mean ${(ms / n).toFixed(0)} ms, longest ${maxMs.toFixed(0)} ms`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}, 1_800_000);
