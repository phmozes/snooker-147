import { describe, expect, it } from 'vitest';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { judgeShot } from '../src/core/rules';
import { mulberry32 } from '../src/core/rng';
import { randomLayout, solveFailure, solveSuccess } from '../src/core/solver';
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

describe('task 4.5 (done early): the solver stops after a number of shots, not milliseconds', () => {
  it('a fast clock and a 50x slower clock pick exactly the same success and failure shots', () => {
    let fake = 0;
    const slow = () => (fake += 50); // every clock reading jumps 50 ms: a very slow device
    const rng = mulberry32(99);
    for (let i = 0; i < 4; i++) {
      const L = randomLayout(rng, 15, 'red', table);
      const a = solveSuccess(L, 'red', table, now);
      const b = solveSuccess(L, 'red', table, slow);
      expect(b && { ...b, computeMs: 0 }).toEqual(a && { ...a, computeMs: 0 });
      const f = solveFailure(L, 'red', 'plainMiss', table, now);
      const g = solveFailure(L, 'red', 'plainMiss', table, slow);
      expect(g && { ...g, computeMs: 0 }).toEqual(f && { ...f, computeMs: 0 });
    }
  }, 60_000);
});
