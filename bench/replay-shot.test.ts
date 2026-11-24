// Task 4.7: replay shots from the owner's "weird shot" list and print everything about them.
// Run: SHOTS="reds6-12345:4,reds15-777:9" npx vitest run bench/replay-shot.test.ts
// (round code : step; the same solver version is needed, see config solver.version). The round is replayed from its
// seed with the real provider; the player's cash-out choices do not matter (shots depend only on seed and step).
import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';

it('replay marked shots', () => {
  const table = buildTable();
  const out: string[] = [`solver ${CONFIG.solver.version}`];
  for (const item of (process.env.SHOTS ?? '').split(',').filter(Boolean)) {
    const m = /^(reds\d+)-(\d+):(\d+)$/.exec(item.trim());
    if (!m) { out.push(`? ${item}`); continue; }
    const level = m[1] as LevelId;
    const step = Number(m[3]);
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const provider = createPhysicsProvider(table, { [level]: lib });
    let r = start({ ...setLevel(newRound(Number(m[2])), level) }, provider, table);
    while (r.phase === 'decide' && r.step + 1 < step) r = shoot(r, provider, table);
    if (step === 1) { out.push(`${item}: step 1 comes from the break-off library`); continue; }
    if (r.phase !== 'decide') { out.push(`${item}: the round ended at step ${r.history.length}`); continue; }
    const before = r.frame!;
    const logFrom = provider.log.length;
    r = shoot(r, provider, table);
    const h = r.history[r.history.length - 1]!;
    out.push(`${item}: ${h.target} ${h.outcome}; ${JSON.stringify(h.shot)}`);
    out.push(`  flex log: ${JSON.stringify(provider.log.slice(logFrom))}`);
    out.push(`  before: ${before.balls.map((b) => `${b.id}(${b.pos.x.toFixed(3)},${b.pos.y.toFixed(3)})`).join(' ')}`);
  }
  process.stdout.write(out.join('\n') + '\n');
}, 3_600_000);
