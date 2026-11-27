// Night 8 (6-red RE-RACK fix A): the v4 6-red library (public/breaks-v4/reds6.json, v4 round codes). Tagged version 4;
// every redPottable break keeps the old rules (checked as for v3 below) AND the two v4 rules: no red within 2 mm of
// the pink and no red that no pocket can take. The snookered list is the v3 one unchanged (the round ends at step 1).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { coloursMovedByBreak, topColoursMovedByBreak, v4Rejects, type BreakEntry } from '../src/core/breakLibrary';
import { clusteredReds } from '../src/core/shotType';
import { buildTable } from '../src/core/table/geometry';
import v4 from '../public/breaks-v4/reds6.json?raw';
import v3 from '../public/breaks-v3/reds6.json?raw';

const table = buildTable();
const L = CONFIG.breakLibrary;
const lib = JSON.parse(v4) as { version: number; redPottable: BreakEntry[]; snookered: BreakEntry[] };

describe('break library v4 reds6', () => {
  it('tagged version 4, 200 + 200 breaks, every break-off on the baulk line', () => {
    expect(lib.version).toBe(4);
    expect(lib.redPottable).toHaveLength(L.perLevelPerKind);
    expect(lib.snookered).toHaveLength(L.perLevelPerKind);
    for (const e of [...lib.redPottable, ...lib.snookered]) {
      expect(e.cueStart.y).toBe(table.baulkY);
      expect(Math.abs(e.cueStart.x)).toBeGreaterThanOrEqual(L.baulkStart.xMin);
      expect(Math.abs(e.cueStart.x)).toBeLessThanOrEqual(L.baulkStart.xMax);
    }
  });
  it('redPottable: the old rules and the two v4 rules (no red on the pink, no red no pocket can take)', () => {
    for (const [i, e] of lib.redPottable.entries()) {
      const where = `#${i} (seed ${e.seed})`;
      expect(e.kind, where).toBe('redPottable');
      expect(e.after, where).toHaveLength(6 + 7);
      expect(coloursMovedByBreak(e.after, table), where).toBeLessThanOrEqual(L.maxColourMove);
      expect(topColoursMovedByBreak(e.after, table), where).toBeLessThanOrEqual(L.maxTopColourMove);
      expect(clusteredReds(e.after, table.ballRadius).size, where).toBeLessThanOrEqual(L.maxPackedShare.reds6 * 6);
      expect(e.step1Success && e.step1Miss, where).toBeTruthy();
      expect(v4Rejects(e.after, table, L.v4Rules), where).toBeNull();
    }
  });
  it('snookered: the v3 list unchanged', () => {
    expect(JSON.stringify(lib.snookered)).toBe(JSON.stringify(JSON.parse(v3).snookered));
  });
});
