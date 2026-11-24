// Task 4.3 measurement: a red shot, then the black from where the cue ball stopped. Position play off vs on.
// Run: npx vitest run bench/pace/sequence.test.ts
import { it } from 'vitest';
import { createSim, runUntilStill, strike } from '../../src/core/physics/sim';
import { mulberry32 } from '../../src/core/rng';
import { applyShot, type FrameState } from '../../src/core/rules';
import { randomLayout, solveSuccess, type SolvedShot } from '../../src/core/solver';
import { buildTable } from '../../src/core/table/geometry';

const table = buildTable();
const now = () => performance.now();

/** Play a solved shot and return the state afterwards (rules applied), plus when the target dropped. */
function play(state: FrameState, target: 'red' | 'black', s: SolvedShot): { next: FrameState; potT: number } {
  const sim = createSim(state.balls, table);
  strike(sim, 'cue', s.dir, s.speed, s.spin);
  runUntilStill(sim);
  const first = sim.events.find((e) => e.type === 'ball');
  const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
  const pot = sim.events.find((e) => e.type === 'pot' && e.a === s.target);
  const next = applyShot(state, target, {
    firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
    after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })),
  }, table);
  return { next, potT: pot ? pot.t : NaN };
}

it('position play: red then black', () => {
  const lines: string[] = [];
  const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1]! : NaN; };
  const within = (a: number[]) => `${Math.round((a.filter((d) => d <= 1.5).length / Math.max(1, a.length)) * 100)}%`;
  for (const reds of [6, 15]) {
    for (const [position, weight] of (process.env.W ? process.env.W.split(',').map((w) => [true, Number(w)]) : [[false, 0], [true, 2]]) as [boolean, number][]) {
      const rng = mulberry32(reds * 77);
      const red: number[] = [];
      const black: number[] = [];
      const blackPot: number[] = [];
      let blackNone = 0;
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const L = randomLayout(rng, reds, 'red', table);
        const r = solveSuccess(L, 'red', table, now, undefined, undefined, undefined, { position, weight, overFrom: Number(process.env.OVER ?? 1.5) });
        if (!r) continue;
        n++;
        red.push(r.duration);
        const after = play(L, 'red', r).next;
        const b = solveSuccess(after, 'black', table, now);
        if (!b) { blackNone++; continue; }
        black.push(b.duration);
        blackPot.push(play(after, 'black', b).potT);
      }
      lines.push(`${reds} reds, position ${position ? `ON w=${weight}` : 'OFF'}: ${n} red shots: median ${med(red).toFixed(2)} s, within 1.5 s ${within(red)} | ` +
        `black next: found ${black.length}/${n}, median ${med(black).toFixed(2)} s, within 1.5 s ${within(black)}, ` +
        `black drops at ${med(blackPot).toFixed(2)} s, cue ball after ${med(black.map((d, k) => d - blackPot[k]!)).toFixed(2)} s`);
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}, 1_200_000);
