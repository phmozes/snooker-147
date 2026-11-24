// Night 2026-11-24, soak test (task 5.5) findings: rounds that ended in a RE-RACK with solver 4.8c (docs/SOAK-FAILURES.md).
// Each is replayed with the real library, solver and physics up to the step that failed; it must now find a shot.
import { describe, expect, it } from 'vitest';
import reds6 from '../public/breaks/reds6.json';
import reds10 from '../public/breaks/reds10.json';
import { createPhysicsProvider, type BreakLibrary } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';

const table = buildTable();
const cases: [string, number][] = [['reds10-5000066', 17], ['reds6-5000294', 11], ['reds6-5000311', 13], ['reds6-5000614', 11], ['reds10-5001536', 18]];

describe('soak findings: no RE-RACK any more', () => {
  for (const [code, step] of cases) {
    it(`${code} up to step ${step}`, () => {
      const provider = createPhysicsProvider(table, { reds6, reds10 } as unknown as BreakLibrary);
      let r = start(setLevel(newRound(Number(code.split('-')[1])), code.split('-')[0] as LevelId), provider, table);
      while (r.phase === 'decide' && r.step < step) r = shoot(r, provider, table);
      expect(r.history.some((h) => h.outcome === 'reRack')).toBe(false);
    }, 300_000);
  }
});
