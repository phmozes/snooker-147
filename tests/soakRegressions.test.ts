// Night 2026-11-24, soak test (task 5.5) findings: rounds that ended in a RE-RACK with solver 4.8c (docs/SOAK-FAILURES.md).
// Each is replayed with the real library, solver and physics up to the step that failed; it must now find a shot.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';

const table = buildTable();
const cases: [string, number][] = [['reds10-5000066', 17], ['reds6-5000294', 11], ['reds6-5000311', 13]];

describe('soak findings: no RE-RACK any more', () => {
  for (const [code, step] of cases) {
    it(`${code} up to step ${step}`, () => {
      const level = code.split('-')[0] as LevelId;
      const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
      const provider = createPhysicsProvider(table, { [level]: lib });
      let r = start(setLevel(newRound(Number(code.split('-')[1])), level), provider, table);
      while (r.phase === 'decide' && r.step < step) r = shoot(r, provider, table);
      expect(r.history.some((h) => h.outcome === 'reRack')).toBe(false);
    }, 300_000);
  }
});
