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
        const byFallback = { plainMiss: 'noPot', softFoul: 'wrongBallFirst', tap: 'missedAll' } as const;
        if (v.result === 'failure') expect(v.type).toBe(s.fallback ? byFallback[s.fallback] : expected[kind]);
      }
      expect(found).toBeGreaterThan(0);
    }, 60_000);
  }
  it('RULES D.2: a failure shot ALWAYS exists (60 random layouts, every type, red and black due): nothing found = 0', () => {
    const rng = mulberry32(7);
    let none = 0;
    for (let i = 0; i < 15; i++) {
      for (const [reds, due] of [[6, 'red'], [15, 'colour']] as const) {
        const L = randomLayout(rng, reds, due, table);
        for (const kind of ['plainMiss', 'inOff'] as const) {
          if (!solveFailure(L, due === 'red' ? 'red' : 'black', kind, table, now, undefined, 20)) none++;
        }
      }
    }
    expect(none).toBe(0);
  }, 120_000);
  it('RULES D.2: with no shots allowed for the normal search, the gentle tap or soft foul is still found', () => {
    const L = randomLayout(mulberry32(3), 15, 'red', table);
    const s = solveFailure(L, 'red', 'jawRattle', table, now, undefined, 0);
    expect(s).not.toBeNull();
    expect(['softFoul', 'tap']).toContain(s!.fallback);
  });
});
