// Task 5.1 with the REAL provider: break-off library + solver + physics. Every planned shot must agree with the decided
// outcome (the state machine checks it with the rules code and throws otherwise).
import { describe, expect, it } from 'vitest';
import { buildBreaks } from '../src/core/breakLibrary';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { cashOut, newRound, shoot, start } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';

const table = buildTable();

describe('round with real physics (6 reds)', () => {
  it('a few seeded rounds play through: every shot matches its decided outcome; fallbacks are logged', () => {
    const library = {
      reds6: { redPottable: buildBreaks(6, 'redPottable', 3, table, 11).entries, snookered: buildBreaks(6, 'snookered', 2, table, 12).entries },
    };
    const provider = createPhysicsProvider(table, library);
    const ends: string[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      let r = start(newRound(seed), provider, table);
      while (r.phase === 'decide') r = r.step >= 4 ? cashOut(r) : shoot(r, provider, table);
      ends.push(r.end!.type);
      expect(r.history.length).toBeGreaterThan(0);
      for (const h of r.history) expect(['success', 'reRack', 'plainMiss', 'jawRattle', 'inOff', 'wrongBallFirst', 'snookered']).toContain(h.outcome);
    }
    expect(ends.length).toBe(6);
    for (const e of provider.log) expect(e.roundCode).toMatch(/^reds6-\d+$/);
  }, 300_000);
});
