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
import { classifySuccess, cutAngle, naturalCheck, playFacts } from '../src/core/shotType';

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
    if (h.outcome === 'success') {
      const pf = playFacts(before.balls, h.shot as { dir: { x: number; y: number }; speed: number; spin: number }, table);
      const facts = { state: before.balls, target: h.target, potted: pf.potted[0]!, aimedPocket: null, events: pf.events, table };
      const t = classifySuccess(facts);
      { // positional facts (owner, night 2026-11-24): pocket, cut angle, distances, cue ball behind the black
        const cueB = before.balls.find((b) => b.kind === 'cue')!.pos; const ball = before.balls.find((b) => b.id === pf.potted[0])!;
        const pe = pf.events.find((e) => e.type === 'pot' && e.a === ball.id); const pk = pe && pe.type === 'pot' ? table.pockets.find((q) => q.id === pe.pocket)! : null;
        const blk = before.balls.find((b) => b.kind === 'black')?.pos; const cueEnd = pf.after.find((b) => b.kind === 'cue')!.pos;
        out.push(`  position: pocket ${pk?.id} cut ${pk ? cutAngle(cueB, ball.pos, pk.mouthMid, table.ballRadius).toFixed(0) : '?'} deg, cue->ball ${Math.hypot(ball.pos.x - cueB.x, ball.pos.y - cueB.y).toFixed(2)} m, ball->pocket ${pk ? Math.hypot(pk.mouthMid.x - ball.pos.x, pk.mouthMid.y - ball.pos.y).toFixed(2) : '?'} m; cue ${blk && cueB.y > blk.y ? 'BEHIND' : 'not behind'} the black; cue ends (${cueEnd.x.toFixed(2)},${cueEnd.y.toFixed(2)})${blk && cueEnd.y > blk.y ? ' BEHIND the black' : ''}`);
      }
      out.push(`  strict check: ${t} -> ${naturalCheck(t, { ...facts, duration: pf.duration, cueTravel: pf.cueTravel, after: pf.after }) ?? 'NATURAL'} (cue ball rolls ${pf.cueTravel.toFixed(2)} m after contact, ${pf.events.filter((e) => e.type === 'cushion' && e.a === 'cue').length} cushions)`);
    }
    out.push(`  before: ${before.balls.map((b) => `${b.id}(${b.pos.x.toFixed(3)},${b.pos.y.toFixed(3)})`).join(' ')}`);
  }
  process.stdout.write(out.join('\n') + '\n');
}, 3_600_000);
