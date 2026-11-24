// Diagnosis tool (task 4.7): what the searches see for one shot of a real round (why no natural pot?). SHOTS="reds6-45:3" npx vitest run bench/diag-shot.test.ts
import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, nextTarget, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { cutAngle } from '../src/core/shotType';
import { chooseAutoColour, nextShotCost, pathClear, solveSuccess, type SolveInfo } from '../src/core/solver';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { buildTable } from '../src/core/table/geometry';

it('diag', () => {
  const table = buildTable();
  const r = table.ballRadius;
  const out: string[] = [];
  for (const item of (process.env.SHOTS ?? '').split(',').filter(Boolean)) {
    const [code, st] = item.split(':');
    const level = code!.split('-')[0] as LevelId;
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const provider = createPhysicsProvider(table, { [level]: lib });
    let rd = start(setLevel(newRound(Number(code!.split('-')[1])), level), provider, table);
    while (rd.phase === 'decide' && rd.step + 1 < Number(st)) rd = shoot(rd, provider, table);
    const f = rd.frame!;
    const target = f.phase === 'colour' ? chooseAutoColour(f, table, () => 0).colour : nextTarget(rd);
    const cue = f.balls.find((b) => b.kind === 'cue')!.pos;
    out.push(`${item}: phase ${f.phase}, target ${target}, cue (${cue.x.toFixed(2)},${cue.y.toFixed(2)})`);
    for (const b of f.balls.filter((x) => x.kind === target)) {
      const cuts = table.pockets.map((p) => `${p.id}:${cutAngle(cue, b.pos, p.mouthMid, r).toFixed(0)}`).join(' ');
      out.push(`  ${b.id} (${b.pos.x.toFixed(2)},${b.pos.y.toFixed(2)}) cuts ${cuts}`);
    }
    out.push(`  others: ${f.balls.filter((x) => x.kind !== target && x.kind !== 'cue').map((b) => `${b.id}(${b.pos.x.toFixed(2)},${b.pos.y.toFixed(2)})`).join(' ')}`);
    for (const [name, opts, budget] of [['normal', {}, CONFIG.solver.shotBudget], ['wide', { wide: true }, CONFIG.solver.wide.shotBudget],
      ['normal, no position', { position: false, lookahead: false }, 2000]] as const) {
      const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
      const s = solveSuccess(f, target, table, () => 0, CONFIG.physics, budget, i, opts);
      if (s && name === 'normal') {
        const sim = createSim(f.balls, table); strike(sim, 'cue', s.dir, s.speed, s.spin); runUntilStill(sim);
        const after = sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } }));
        after.push({ id: 'black', kind: 'black', pos: { ...table.spots.black } });
        const ce = after.find((b) => b.kind === 'cue')!.pos;
        for (const b of after.filter((x) => x.kind === 'red')) {
          const others = after.filter((x) => x.kind !== 'cue');
          const ps = table.pockets.map((p) => { const c = cutAngle(ce, b.pos, p.mouthMid, r);
            const ok = pathClear(b.pos, p.mouthMid, others, [b.id], r, 0.02); return c <= 75 && ok ? `${p.id}:${c.toFixed(0)}` : ''; }).filter(Boolean).join(' ');
          out.push(`    after: ${b.id} (${b.pos.x.toFixed(2)},${b.pos.y.toFixed(2)}) open: ${ps} | cost alone ${nextShotCost(ce, after.filter((x) => x.kind !== 'red' || x.id === b.id), 'red', table).toFixed(2)}`);
        }
      }
      out.push(`  ${name}: pairs ${i.pairs}, tried ${i.tried}, timedOut ${i.timedOut} -> ${s ? `${s.type} ${s.target}->${s.pocket} ${s.duration.toFixed(2)} s, speed ${s.speed.toFixed(1)}, lookahead ${s.lookahead}, nextCost ${s.nextCost?.toFixed(2)}, cueEnd (${s.cueEnd.x.toFixed(2)},${s.cueEnd.y.toFixed(2)}), spin ${s.spin}` : 'none'}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}, 3_600_000);
