// Run with: npx vitest run bench/solver.test.ts  (solver report: many random layouts; not part of npm test)
import { it } from 'vitest';
import { judgeShot } from '../src/core/rules';
import { mulberry32 } from '../src/core/rng';
import { randomLayout, solveSuccess, type SolveInfo } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';

it('solver report', () => {
  const table = buildTable(); const now = () => performance.now();
  const lines: string[] = [];
  for (const reds of [6, 15]) for (const due of ['red', 'colour'] as const) {
    const rng = mulberry32(reds * 100 + (due === 'red' ? 1 : 2));
    const kinds: Record<string, number> = { 'no open pocket': 0, 'budget used up': 0, 'all tried, none pots': 0 };
    let solved = 0; const ms: number[] = []; const dur: number[] = []; const fails: string[] = [];
    const n = 100;
    for (let i = 0; i < n; i++) {
      const s = randomLayout(rng, reds, due, table);
      const target = due === 'red' ? 'red' : 'black';
      const info: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
      const t = solveSuccess(s, target, table, now, undefined, undefined, info);
      if (t) { solved++; ms.push(t.computeMs); dur.push(t.duration); }
      else {
        const cue = s.balls[0]!.pos; const blk = s.balls.find((b) => b.id === 'black')!.pos;
        kinds[info.pairs === 0 ? 'no open pocket' : info.timedOut ? 'budget used up' : 'all tried, none pots'] += 1;
        fails.push(`#${i} pairs=${info.pairs} tried=${info.tried} ${info.timedOut ? 'TIMEOUT' : ''} reds=${s.redsLeft} cue(${cue.x.toFixed(2)},${cue.y.toFixed(2)})${due === 'colour' ? ` cue-black ${Math.hypot(cue.x - blk.x, cue.y - blk.y).toFixed(2)}m` : ''}`);
      }
    }
    ms.sort((a, b) => a - b); dur.sort((a, b) => a - b);
    lines.push(`${reds} reds, ${due} due: solved ${solved}/${n}; shot median ${dur[dur.length >> 1]?.toFixed(2)} s, max ${dur.at(-1)?.toFixed(2)} s, <=1.5 s ${Math.round(dur.filter((d) => d <= 1.5).length / dur.length * 100)}%; compute median ${ms[ms.length >> 1]?.toFixed(0)} ms, max ${ms.at(-1)?.toFixed(0)} ms`);
    lines.push(`   failures by kind: ${JSON.stringify(kinds)}`);
    lines.push(...fails.slice(0, 3).map((f) => `   fail ${f}`));
  }
  process.stdout.write(lines.join('\n') + '\n');
}, 600000);
