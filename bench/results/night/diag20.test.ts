import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../../src/config/game.config';
import { createPhysicsProvider } from '../../../src/core/physicsProvider';
import { newRound, setLevel, shoot, start } from '../../../src/core/round';
import { solveDoubles, solveSpray, solveSuccess, type SolvedShot } from '../../../src/core/solver';
import { playFacts } from '../../../src/core/shotType';
import { buildTable } from '../../../src/core/table/geometry';
it('d', () => {
  const table = buildTable();
  const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files.reds10}`, 'utf8'));
  const out: string[] = [];
  const p = createPhysicsProvider(table, { reds10: lib });
  let r = start(setLevel(newRound(5001536), 'reds10'), p, table);
  while (r.step + 1 < 17) r = shoot(r, p, table);
  const f = r.frame!;
  const check = (name: string, s: SolvedShot | null) => {
    if (!s) { out.push(`${name}: none`); return; }
    const pf = playFacts(f.balls, s, table);
    const nf = { ...f, phase: 'colour' as const, redsLeft: f.redsLeft - 1, balls: pf.after };
    const res = (['black', 'pink', 'blue'] as const).map((c) => {
      const x = solveSuccess(nf, c, table, () => 0, CONFIG.physics, 1000, undefined, { position: false, lookahead: false, firstFound: true, exhibition: true });
      return `${c}:${x ? x.type : '-'}`;
    });
    out.push(`${name}: ${s.type} ${s.duration.toFixed(2)}s cueEnd (${pf.after.find((b) => b.kind === 'cue')!.pos.x.toFixed(2)},${pf.after.find((b) => b.kind === 'cue')!.pos.y.toFixed(2)}) next ${res.join(' ')}`);
  };
  check('exh', solveSuccess(f, 'red', table, () => 0, CONFIG.physics, 1000, undefined, { exhibition: true }));
  check('doubles', solveDoubles(f, 'red', table));
  check('spray', solveSpray(f, 'red', table));
  process.stdout.write(out.join('\n') + '\n');
}, 1800000);
