// Run with: npx vitest run bench/failure.test.ts  (failure-shot report; not part of npm test)
import { it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { randomLayout, solveFailure, type FailureKind } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';
it('failure report', () => {
  const table = buildTable(); const now = () => performance.now(); const lines: string[] = [];
  for (const [reds, due] of [[6, 'red'], [15, 'red'], [15, 'colour']] as const) {
    for (const kind of ['plainMiss', 'jawRattle', 'inOff', 'wrongBallFirst'] as FailureKind[]) {
      const rng = mulberry32(reds * 10 + (due === 'red' ? 1 : 2));
      let found = 0, none = 0; const fb = { plainMiss: 0, softFoul: 0, tap: 0 }; const ms: number[] = []; const dur: number[] = [];
      for (let i = 0; i < 20; i++) {
        const s = solveFailure(randomLayout(rng, reds, due, table), due === 'red' ? 'red' : 'black', kind, table, now);
        if (!s) none++; else if (s.fallback) fb[s.fallback]++; else { found++; dur.push(s.duration); }
        if (s) ms.push(s.computeMs);
      }
      dur.sort((a, b) => a - b);
      lines.push(`${reds} reds ${due} ${kind}: found ${found}/20, fallback miss ${fb.plainMiss} soft ${fb.softFoul} tap ${fb.tap}, none ${none}, shot median ${dur[dur.length >> 1]?.toFixed(2)} s, compute max ${Math.max(...ms).toFixed(0)} ms`);
    }
  }
  process.stdout.write(lines.join('\n') + '\n');
}, 600000);
