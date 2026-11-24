// Real rounds with the real provider (library + solver + physics): how often each flex step, RE-RACK and each D.2
// fallback happen per shot, and how long shots are. Run: N=30 npx vitest run bench/rounds.test.ts
import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';

it('real rounds', () => {
  const table = buildTable();
  const lines: string[] = [];
  const n = Number(process.env.N ?? 30);
  for (const level of (process.env.LEVELS ?? 'reds6,reds15').split(',') as LevelId[]) {
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const provider = createPhysicsProvider(table, { [level]: lib });
    let shots = 0; let success = 0; const ends: Record<string, number> = {}; const durs: number[] = []; const blackDurs: number[] = [];
    const t0 = performance.now();
    for (let seed = 1; seed <= n; seed++) {
      let r = start(setLevel(newRound(seed * 7 + 3), level), provider, table);
      while (r.phase === 'decide') {
        r = shoot(r, provider, table);
        shots++;
        const h = r.history[r.history.length - 1]!;
        const s = h.shot as { duration?: number } | undefined;
        if (h.outcome === 'success') { success++; if (s?.duration) { durs.push(s.duration); if (h.target === 'black') blackDurs.push(s.duration); } }
      }
      ends[r.end!.type] = (ends[r.end!.type] ?? 0) + 1;
    }
    const levels: Record<string, number> = {};
    for (const e of provider.log) { levels[e.level] = (levels[e.level] ?? 0) + 1; if (e.level === 'reRack' && process.env.DETAIL) lines.push(`  re-rack: ${e.roundCode} step ${e.step} target ${e.target}`); }
    const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] ?? NaN; };
    const within = (a: number[]) => Math.round((a.filter((d) => d <= 1.5).length / Math.max(1, a.length)) * 100);
    lines.push(`${level}: ${n} rounds, ${shots} shots after step 1 (${success} successes); ends ${JSON.stringify(ends)}; ` +
      `success flex steps ${JSON.stringify(levels)} (normal = the rest); success shot median ${med(durs).toFixed(2)} s, within 1.5 s ${within(durs)}%; ` +
      `black median ${med(blackDurs).toFixed(2)} s, within 1.5 s ${within(blackDurs)}%; ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}, 3_600_000);
