// Owner check 2026-11-25 (report only): how far the pink and the black move early in a round.
// 1) every break in the library: distance of pink and black from their spots after the break-off.
// 2) the 60-round benchmark (seeds as natural.test.ts, old p = the run before RTP option 3c): steps 1-3, how far each
//    shot moves the pink or the black (a potted target is re-spotted and not counted), and the distance from the spot.
// Run: npx vitest run bench/pink-black.test.ts  -> bench/results/pink-black.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import type { BreakEntry } from '../src/core/breakLibrary';
import { linearLadderForLevel } from '../src/core/ladder';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';
import type { Ball } from '../src/core/types';

const LIMIT = 0.3;
const cm = (m: number) => (m * 100).toFixed(0);

it('pink and black movement', () => {
  const table = buildTable();
  const out: string[] = [];
  const fromSpot = (balls: Ball[], c: 'pink' | 'black') => {
    const b = balls.find((x) => x.id === c);
    return b ? Math.hypot(b.pos.x - table.spots[c].x, b.pos.y - table.spots[c].y) : NaN;
  };
  const moved = (a: Ball[], b: Ball[], c: 'pink' | 'black') => {
    const p = a.find((x) => x.id === c); const q = b.find((x) => x.id === c);
    return p && q ? Math.hypot(p.pos.x - q.pos.x, p.pos.y - q.pos.y) : NaN;
  };

  // 1) the break library
  const all: { name: string; pink: number; black: number }[] = [];
  for (const level of CONFIG.levels) {
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level.id]}`, 'utf8')) as Record<string, BreakEntry[]>;
    for (const kind of Object.keys(lib).filter((k) => Array.isArray(lib[k]))) {
      const list = lib[kind]!;
      const rows = list.map((e, i) => ({ name: `${level.id} ${kind} #${i} (seed ${e.seed})`, pink: fromSpot(e.after, 'pink'), black: fromSpot(e.after, 'black') }));
      all.push(...rows);
      const over = rows.filter((r) => Math.max(r.pink, r.black) > LIMIT).length;
      const overP = rows.filter((r) => r.pink > LIMIT).length; const overB = rows.filter((r) => r.black > LIMIT).length;
      out.push(`library ${level.id} ${kind}: ${over} of ${rows.length} move pink or black > 30 cm (pink ${overP}, black ${overB})`);
    }
  }
  all.sort((a, b) => Math.max(b.pink, b.black) - Math.max(a.pink, a.black));
  out.push('worst 10 breaks: ' + all.slice(0, 10).map((r) => `${r.name}: pink ${cm(r.pink)} cm, black ${cm(r.black)} cm`).join(' | '));
  out.push(`all breaks: ${all.filter((r) => Math.max(r.pink, r.black) > LIMIT).length} of ${all.length} move pink or black > 30 cm`);

  // 2) the 60-round benchmark, steps 1-3
  const n = Number(process.env.N ?? 60);
  for (const level of CONFIG.levels.map((l) => l.id as LevelId)) {
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const provider = createPhysicsProvider(table, { [level]: lib });
    const hits: string[] = [];
    let shots = 0;
    for (let seed = 1; seed <= n; seed++) {
      const r0 = setLevel(newRound(seed * 7 + 3), level);
      let r = start({ ...r0, ladder: linearLadderForLevel(level) }, provider, table);
      const code = r.roundCode;
      // step 1 (break-off + our first red): distance from the spots
      const s1 = r.frame!.balls;
      shots++;
      for (const c of ['pink', 'black'] as const) if (fromSpot(s1, c) > LIMIT) hits.push(`${code} step 1 (break+red): ${c} ${cm(fromSpot(s1, c))} cm from spot`);
      while (r.phase === 'decide' && r.history.length < 3) {
        const before = r.frame!.balls;
        r = shoot(r, provider, table);
        const h = r.history[r.history.length - 1]!;
        if (!r.frame) break;
        shots++;
        for (const c of ['pink', 'black'] as const) {
          if (h.target === c && h.outcome === 'success') continue; // potted and re-spotted
          const d = moved(before, r.frame.balls, c);
          if (d > LIMIT) hits.push(`${code} step ${r.history.length} (${h.target} ${h.outcome}): ${c} moved ${cm(d)} cm, now ${cm(fromSpot(r.frame.balls, c))} cm from spot`);
        }
      }
    }
    out.push(`bench ${level}: ${hits.length} hits in ${shots} early shots${hits.length ? ': ' + hits.join(' | ') : ''}`);
  }
  writeFileSync('bench/results/pink-black.txt', out.join('\n') + '\n');
});
