import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../../src/config/game.config';
import { createPhysicsProvider } from '../../../src/core/physicsProvider';
import { newRound, setLevel, shoot, start } from '../../../src/core/round';
import { chooseAutoColour, solveSuccessFlex } from '../../../src/core/solver';
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
    const c = chooseAutoColour(f, table, () => 0);
    out.push(`${seed} pick ${c.colour} tried ${c.tried} normal ${!!c.normal}`);
    for (const k of ['black', 'pink', 'blue'] as const) {
      const x = solveSuccessFlex(f, k, table, () => 0, { roundCode: 'x', step: 18 });
      out.push(`  ${k}: ${x.level} tried ${x.tried} ${x.shot ? x.shot.duration.toFixed(2) + 's ' + x.shot.type : ''}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}, 600000);
