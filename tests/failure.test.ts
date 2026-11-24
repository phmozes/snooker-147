import { describe, expect, it } from 'vitest';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { judgeShot } from '../src/core/rules';
import { mulberry32 } from '../src/core/rng';
import { randomLayout, solveFailure, type FailureKind } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';

const table = buildTable();
const now = () => performance.now();
const expected: Record<FailureKind, string> = { plainMiss: 'noPot', jawRattle: 'noPot', inOff: 'inOff', wrongBallFirst: 'wrongBallFirst' };

describe('task 4.2: failure shots', () => {
  for (const kind of ['plainMiss', 'jawRattle', 'inOff', 'wrongBallFirst'] as const) {
    it(`${kind}: every shot found is judged a failure of that type (or a plain-miss fallback) and pots no object ball`, () => {
      const rng = mulberry32(42);
      let found = 0;
      for (let i = 0; i < 8; i++) {
        const L = randomLayout(rng, 15, 'red', table);
        const s = solveFailure(L, 'red', kind, table, now);
        if (!s) continue;
        found++;
        const sim = createSim(L.balls, table);
        strike(sim, 'cue', s.dir, s.speed, s.spin);
        runUntilStill(sim);
        const first = sim.events.find((e) => e.type === 'ball');
        const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
        const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
        const v = judgeShot(L, 'red', { firstHit, potted, after: [] });
        expect(v.result).toBe('failure');
        expect(potted.filter((id) => id !== 'cue')).toEqual([]);
        if (v.result === 'failure') expect(v.type).toBe(s.fallback ? 'noPot' : expected[kind]);
      }
      expect(found).toBeGreaterThan(0);
    }, 60_000);
  }
});
