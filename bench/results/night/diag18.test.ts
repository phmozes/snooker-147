import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../../src/config/game.config';
import { createPhysicsProvider } from '../../../src/core/physicsProvider';
import { newRound, setLevel, shoot, start } from '../../../src/core/round';
import { solveSuccess, type SolveInfo } from '../../../src/core/solver';
import { buildTable } from '../../../src/core/table/geometry';
it('d', () => {
  const table = buildTable();
  const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files.reds10}`, 'utf8'));
  const out: string[] = [`halfLength ${table.halfLength} halfWidth ${table.halfWidth} r ${table.ballRadius}`];
  const p = createPhysicsProvider(table, { reds10: lib });
  let r = start(setLevel(newRound(5001536), 'reds10'), p, table);
  while (r.step + 1 < 17) r = shoot(r, p, table);
  const f = r.frame!;
  out.push(`phase ${f.phase} redsLeft ${f.redsLeft} next ${f.nextColour} balls ${f.balls.map((b) => b.id).join(',')}`);
  for (const k of ['red'] as const) for (const o of [{}, { position: false, lookahead: false }, { wide: true }, { position: false, lookahead: false, firstFound: true, exhibition: true }]) {
    const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
    const s = solveSuccess(f, k, table, () => 0, CONFIG.physics, 6000, i, o);
    out.push(`${k} ${JSON.stringify(o)}: pairs ${i.pairs} tried ${i.tried} shot ${s ? s.type + ' look ' + s.lookahead + ' next ' + s.nextCost : 'none'}`);
  }
  process.stdout.write(out.join('\n') + '\n');
}, 600000);
