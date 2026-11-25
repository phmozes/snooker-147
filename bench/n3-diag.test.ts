// Night 3 task 3: facts about a failure shot (where the aimed ball and the cue ball went). SHOTS="code:step,..."
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { playFacts } from '../src/core/shotType';
import { buildTable } from '../src/core/table/geometry';

it('n3 diag', () => {
  const table = buildTable();
  const out: string[] = [];
  for (const item of (process.env.SHOTS ?? '').split(',').filter(Boolean)) {
    const [code, st] = item.split(':'); const level = code!.split('-')[0] as LevelId; const step = Number(st);
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const provider = createPhysicsProvider(table, { [level]: lib });
    let r = start(setLevel(newRound(Number(code!.split('-')[1])), level), provider, table);
    const pos: string[] = [];
    while (r.phase === 'decide' && r.step + 1 < step) {
      r = shoot(r, provider, table);
      const h = r.history[r.history.length - 1]!; const s = h.shot as { type?: string; pocket?: string; duration: number; cueEnd?: { x: number; y: number } };
      pos.push(`${h.step}:${h.target}/${s?.type}/${s?.pocket}/${s?.duration?.toFixed(2)}s`);
    }
    out.push(`${item}: steps before: ${pos.join(' ')}`);
    const before = r.frame!;
    r = shoot(r, provider, table);
    const h = r.history[r.history.length - 1]!;
    const s = h.shot as { dir: { x: number; y: number }; speed: number; spin: number; target: string; pocket: string };
    const pf = playFacts(before.balls, s, table);
    const b0 = before.balls.find((b) => b.id === s.target)!.pos; const b1 = pf.after.find((b) => b.id === s.target)?.pos;
    const pk = table.pockets.find((p) => p.id === s.pocket)!.mouthMid;
    const c0 = before.balls.find((b) => b.kind === 'cue')!.pos; const c1 = pf.after.find((b) => b.kind === 'cue')!.pos;
    out.push(`  ${h.target} ${h.outcome}: ball ${s.target} (${b0.x.toFixed(2)},${b0.y.toFixed(2)}) -> ${b1 ? `(${b1.x.toFixed(2)},${b1.y.toFixed(2)})` : 'potted'}, ` +
      `pocket ${s.pocket} mouth (${pk.x.toFixed(2)},${pk.y.toFixed(2)}), ends ${b1 ? Math.hypot(b1.x - pk.x, b1.y - pk.y).toFixed(2) : '-'} m from it; cue (${c0.x.toFixed(2)},${c0.y.toFixed(2)}) -> (${c1.x.toFixed(2)},${c1.y.toFixed(2)}), ` +
      `speed ${s.speed.toFixed(2)} spin ${s.spin}, cushions: ${pf.events.filter((e) => e.type === 'cushion').map((e) => (e as { a: string }).a).join(',')}`);
  }
  writeFileSync('bench/results/n3-diag.txt', out.join('\n') + '\n');
}, 3_600_000);
