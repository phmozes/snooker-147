import { describe, expect, it } from 'vitest';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { judgeShot } from '../src/core/rules';
import { mulberry32 } from '../src/core/rng';
import { randomLayout, shotCaps, solveSuccessFlex } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';

const table = buildTable();
const now = () => performance.now();

describe('task 4.5: flex chain and fallback log (RULES D.3 / D.4)', () => {
  it('every result is a success shot judged by the rules code, or RE-RACK; every non-normal step is logged', () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 6; i++) {
      const L = randomLayout(rng, 15, i % 2 ? 'colour' : 'red', table);
      const target = i % 2 ? 'black' : 'red';
      const f = solveSuccessFlex(L, target, table, now, { roundCode: 'TEST', step: i + 1 });
      expect(f.tried).toBeGreaterThan(0);
      expect(f.tried).toBeLessThanOrEqual(shotCaps().success); // fixed cap per decision, the same on every device
      if (f.level === 'normal') expect(f.log).toBeNull();
      else {
        expect(f.log).toMatchObject({ roundCode: 'TEST', step: i + 1, target });
        expect([f.level, 'noLookahead']).toContain(f.log!.level); // noLookahead: the next step looked unsolvable
      }
      if (f.level === 'reRack') { expect(f.shot).toBeNull(); continue; }
      const s = f.shot!;
      const sim = createSim(L.balls, table);
      strike(sim, 'cue', s.dir, s.speed, s.spin);
      runUntilStill(sim);
      const first = sim.events.find((e) => e.type === 'ball');
      const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
      expect(judgeShot(L, target, { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id), after: [] }).result).toBe('success');
      if (f.level === 'normal') expect(s.duration).toBeLessThanOrEqual(1.5);
      if (f.level === 'longerDuration' || f.level === 'wideSearch') expect(s.duration).toBeLessThanOrEqual(2.2);
      if (f.level === 'overLong') expect(s.duration).toBeGreaterThan(2.2);
    }
  }, 120_000);
});
