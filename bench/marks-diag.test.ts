// Owner marks (Part 4, 2026-11-25): for each marked shot, what each colour (or the red search) offered in the layout
// before it. Marks made before RTP option 3c replay on the old p (OLDP=1).
// Run: OLDP=1 SHOTS="reds15-3634511757:10,..." npx vitest run bench/marks-diag.test.ts -> bench/results/marks-diag.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { linearLadderForLevel } from '../src/core/ladder';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { pottableReds, type BreakEntry } from '../src/core/breakLibrary';
import { solveSuccess, type SolveInfo } from '../src/core/solver';
import { cutAngle } from '../src/core/shotType';
import { buildTable } from '../src/core/table/geometry';

it('marks diag', () => {
  const table = buildTable();
  const out: string[] = [];
  for (const item of (process.env.SHOTS ?? '').split(',').filter(Boolean)) {
    const [code, st] = item.split(':');
    const level = code!.split('-')[0] as LevelId;
    const step = Number(st);
    const lib = JSON.parse(readFileSync(`${process.env.LIB_DIR ?? 'public'}/${CONFIG.breakLibrary.files[level]}`, 'utf8')) as Record<string, BreakEntry[]>;
    const provider = createPhysicsProvider(table, { [level]: lib });
    const r0 = setLevel(newRound(Number(code!.split('-')[1])), level);
    let r = start(process.env.OLDP ? { ...r0, ladder: linearLadderForLevel(level) } : r0, provider, table);
    while (r.phase === 'decide' && r.step + 1 < step) r = shoot(r, provider, table);
    const state = r.frame!;
    const cue = state.balls.find((b) => b.kind === 'cue')!.pos;
    out.push(`${item}: phase ${state.phase}, cue (${cue.x.toFixed(2)},${cue.y.toFixed(2)}), reds with an open pot ${pottableReds(state, table)}`);
    const targets = state.phase === 'colour' ? CONFIG.solver.natural.autoColours : ['red'];
    for (const c of targets) {
      const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
      const s = solveSuccess(state, c as never, table, () => performance.now(), CONFIG.physics, CONFIG.solver.shotBudget, i);
      if (!s) { out.push(`  ${c}: no shot (${i.pairs} pairs, ${i.tried} tried)`); continue; }
      const ball = state.balls.find((b) => b.id === s.target)!; const pk = table.pockets.find((p) => p.id === s.pocket);
      const cut = pk ? cutAngle(cue, ball.pos, pk.mouthMid, table.ballRadius).toFixed(0) : '?';
      out.push(`  ${c}: ${s.type} into ${s.pocket}, cut ${cut} deg, ${s.duration.toFixed(2)} s, whyNot ${s.whyNot ?? 'none'}, ` +
        `next red: lookahead ${s.lookahead}, natural ${s.nextNatural}, locked ${!!s.lockedReds}; cue ends (${s.cueEnd.x.toFixed(2)},${s.cueEnd.y.toFixed(2)}) (${i.pairs} pairs)`);
    }
  }
  writeFileSync('bench/results/marks-diag.txt', out.join('\n') + '\n');
}, 3_600_000);
