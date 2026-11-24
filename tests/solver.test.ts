import { describe, expect, it } from 'vitest';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { judgeShot } from '../src/core/rules';
import { mulberry32 } from '../src/core/rng';
import { randomLayout, solveSuccess } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';

const table = buildTable();
const now = () => performance.now();

describe('task 4.1: solver, success shots', () => {
  it('the same seed gives the same random layout', () => {
    expect(randomLayout(mulberry32(5), 15, 'red', table)).toEqual(randomLayout(mulberry32(5), 15, 'red', table));
  });
  it('every shot the solver returns is judged a success by the rules code when simulated again (20 layouts each)', () => {
    let solved = 0;
    for (const [reds, due] of [[6, 'red'], [15, 'red'], [6, 'colour']] as const) {
      const rng = mulberry32(reds + (due === 'red' ? 0 : 50));
      for (let i = 0; i < 20; i++) {
        const L = randomLayout(rng, reds, due, table);
        const target = due === 'red' ? 'red' : 'black';
        const s = solveSuccess(L, target, table, now);
        if (!s) continue;
        solved++;
        const sim = createSim(L.balls, table);
        strike(sim, 'cue', s.dir, s.speed, s.spin);
        runUntilStill(sim);
        const first = sim.events.find((e) => e.type === 'ball');
        const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
        const v = judgeShot(L, target, { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id), after: [] });
        expect(v).toEqual({ result: 'success', potted: s.target });
        expect(sim.time).toBeCloseTo(s.duration, 6);
      }
    }
    expect(solved).toBeGreaterThan(40); // most layouts are solved (the flex chain for the rest comes in task 4.5)
  }, 60_000);
});
