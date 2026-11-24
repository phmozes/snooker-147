import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { paceLayouts, paceStudy, speedBenchmark, withFriction } from '../src/core/physics/bench';
import { buildTable } from '../src/core/table/geometry';

const table = buildTable();
const now = () => performance.now();

describe('task 1.4: speed benchmark and pace study', () => {
  // Only a guard against a big slow-down: other test files run at the same time, so timings here are noisy.
  // The real numbers come from npm run bench (docs/SPEED.md).
  it('a full-rack shot at the config friction stays within 5x the 1 ms guide', () => {
    speedBenchmark(table, CONFIG.physics, now, 15, 10); // warm-up
    const r = speedBenchmark(table, CONFIG.physics, now, 15, 50);
    expect(r.msPerShot).toBeLessThan(5 * CONFIG.dev.bench.targetMsPerShot);
    expect(r.simSecondsPerShot).toBeGreaterThan(0.5);
  });

  it('the same seed gives the same layouts and the same pace result (no Math.random)', () => {
    const a = paceLayouts(table, 4);
    expect(paceLayouts(table, 4)).toEqual(a);
    const p1 = paceStudy(table, withFriction(CONFIG.physics.frictionMarks.game), now, a);
    const p2 = paceStudy(table, withFriction(CONFIG.physics.frictionMarks.game), now, a);
    expect({ ...p1, msTotal: 0 }).toEqual({ ...p2, msTotal: 0 });
  });

  it('lower friction makes the quickest pots take longer', () => {
    const l = paceLayouts(table, 6);
    const real = paceStudy(table, withFriction(CONFIG.physics.frictionMarks.realisticCloth), now, l);
    const game = paceStudy(table, withFriction(CONFIG.physics.frictionMarks.game), now, l);
    expect(real.medianSettle).toBeGreaterThan(game.medianSettle);
  });
});
