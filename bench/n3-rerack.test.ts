// Diagnosis only (2026-11-26): the 4 RE-RACKs of the night-3 soak (all 6 reds, step 11, a red). Replays each round
// from its seed up to the RE-RACK step, prints the layout (cue, last red, nearby balls, cushion distances, blocked
// lines) and checks whether ANY shot exists with a search 10x larger than the game's (exhibition + wide).
// Run: npx vitest run bench/n3-rerack.test.ts -> bench/results/n3-rerack.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { solveSuccess, solveSuccessFlex, type SolveInfo } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';

const CODES = (process.env.CODES ?? 'reds6-5000265,reds6-5000787,reds6-5002489,reds6-5002931').split(',');
type V = { x: number; y: number };
const segDist = (p: V, a: V, b: V) => {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const f = (v: V) => `(${v.x.toFixed(3)}, ${v.y.toFixed(3)})`;

it('RE-RACK diagnosis', () => {
  const table = buildTable();
  const r = table.ballRadius;
  const now = () => performance.now();
  const out: string[] = [`solver ${CONFIG.solver.version}; table half width ${table.halfWidth}, half length ${table.halfLength}, ball r ${r}`];
  for (const code of CODES) {
    const [level, seed] = code.split('-') as [LevelId, string];
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const provider = createPhysicsProvider(table, { [level]: lib });
    let rd = start(setLevel(newRound(Number(seed)), level), provider, table);
    let before = rd.frame!;
    while (rd.phase === 'decide') { before = rd.frame!; rd = shoot(rd, provider, table); }
    const h = rd.history[rd.history.length - 1]!;
    out.push('', `== ${code} step ${h.step}: end ${rd.end!.type}, target ${h.target}`);
    if (rd.end!.type !== 'reRack') { out.push('  (not a RE-RACK with this solver)'); continue; }
    const balls = before.balls;
    const cue = balls.find((b) => b.kind === 'cue')!;
    const reds = balls.filter((b) => b.kind === 'red');
    out.push(`  cue ${f(cue.pos)}; reds on the table: ${reds.length}`);
    for (const red of reds) {
      const toCush = Math.min(table.halfWidth - Math.abs(red.pos.x), table.halfLength - Math.abs(red.pos.y)) - r;
      const touching = balls.filter((b) => b.id !== red.id && Math.hypot(b.pos.x - red.pos.x, b.pos.y - red.pos.y) < 2 * r + 0.005).map((b) => b.id);
      const blockers = balls.filter((b) => b.id !== red.id && b.id !== cue.id && segDist(b.pos, cue.pos, red.pos) < 2 * r).map((b) => b.id);
      out.push(`  ${red.id} ${f(red.pos)}: ${(toCush * 1000).toFixed(0)} mm from the nearest cushion; touching ${touching.join(' ') || 'none'};` +
        ` straight line cue->red blocked by ${blockers.join(' ') || 'nothing'}`);
      const open = table.pockets.filter((p) => !balls.some((b) => b.id !== red.id && segDist(b.pos, red.pos, p.mouthMid) < 2 * r)).map((p) => p.id);
      out.push(`    pockets with a clear red->pocket line: ${open.join(' ') || 'none'}`);
    }
    const near = balls.filter((b) => b.kind !== 'red' && b.kind !== 'cue').map((b) => `${b.id} ${f(b.pos)}`);
    out.push(`  colours: ${near.join(', ')}`);
    // the game's own decision again (same shot cap), then a 10x larger search
    const flex = solveSuccessFlex(before, 'red', table, now, { roundCode: code, step: h.step });
    out.push(`  game solver again: level ${flex.level}, ${flex.tried} shots simulated`);
    for (const [name, opts] of [['wide 10x', { wide: true }], ['exhibition 10x', { exhibition: true }],
      ['exhibition 10x, no lookahead, no position', { exhibition: true, lookahead: false, position: false }]] as const) {
      const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
      const s = solveSuccess(before, 'red', table, now, CONFIG.physics, (opts.wide ? CONFIG.solver.wide.shotBudget : CONFIG.solver.exhibition.shotBudget) * 10, i, opts);
      out.push(`  ${name}: ${s ? `FOUND (${s.duration.toFixed(2)} s, speed ${s.speed.toFixed(2)}, lookahead ${s.lookahead ?? '-'})` : 'nothing'}, ${i.tried} shots`);
    }
  }
  writeFileSync(process.env.OUT ?? 'bench/results/n3-rerack.txt', out.join('\n') + '\n');
}, 3 * 3_600_000);

// Second check: which break-off library entry each RE-RACK round used, and in how many library entries (and soak
// rounds, seeds 5,000,000..5,002,999) the apex red is still frozen to the pink after the break-off.
it('break-off entries with the apex red frozen to the pink', () => {
  const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files.reds6}`, 'utf8'));
  const table = buildTable();
  const r = table.ballRadius;
  const frozen = (balls: { kind: string; id: string; pos: V }[]) => {
    const pink = balls.find((b) => b.id === 'pink')!;
    return balls.some((b) => b.kind === 'red' && Math.hypot(b.pos.x - pink.pos.x, b.pos.y - pink.pos.y) < 2 * r + 0.002);
  };
  const out: string[] = [''];
  for (const key of ['redPottable', 'snookered'] as const) {
    const list = lib[key] as { after: { kind: string; id: string; pos: V }[] }[];
    const idx = list.map((e, i) => (frozen(e.after) ? i : -1)).filter((i) => i >= 0);
    out.push(`library reds6 ${key}: ${list.length} entries, red frozen to the pink after the break-off in ${idx.length}: [${idx.join(', ')}]`);
  }
  const provider = createPhysicsProvider(table, { reds6: lib });
  let n = 0, fz = 0, step1ok = 0;
  const used: Record<string, number> = {};
  for (let seed = 5_000_000; seed < 5_003_000; seed++) {
    const rd = start(setLevel(newRound(seed), 'reds6'), provider, table);
    n++;
    if (rd.frame && frozen(rd.frame.balls)) {
      fz++;
      if (rd.phase === 'decide') step1ok++;
      if (CODES.includes(`reds6-${seed}`) || fz <= 3) used[`reds6-${seed}`] = 1;
    }
  }
  out.push(`soak seeds 5,000,000..5,002,999 (reds6): after step 1 a red is frozen to the pink in ${fz} of ${n} rounds (${step1ok} of them went on past step 1)`);
  out.push(`examples: ${Object.keys(used).join(', ')}`);
  writeFileSync(process.env.OUT2 ?? 'bench/results/n3-rerack.txt', out.join('\n') + '\n', { flag: 'a' });
}, 3_600_000);
