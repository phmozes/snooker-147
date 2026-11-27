// Every break in the shipped libraries keeps the break rules (RULES B.1, owner 2026-11-24 and 2026-11-25): the old
// library (public/breaks, v1 / v2 round codes) and the night-6 v3 library (public/breaks-v3, every new round), whose
// cue ball starts ON the baulk line between the brown and the yellow or green (owner, night 6).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { coloursMovedByBreak, topColoursMovedByBreak, type BreakEntry } from '../src/core/breakLibrary';
import { clusteredReds } from '../src/core/shotType';
import { buildTable } from '../src/core/table/geometry';
import reds6 from '../public/breaks/reds6.json?raw';
import reds10 from '../public/breaks/reds10.json?raw';
import reds15 from '../public/breaks/reds15.json?raw';
import v3reds6 from '../public/breaks-v3/reds6.json?raw';
import v3reds10 from '../public/breaks-v3/reds10.json?raw';
import v3reds15 from '../public/breaks-v3/reds15.json?raw';

const table = buildTable();
const FILES: Record<string, Record<string, string>> = { old: { reds6, reds10, reds15 }, v3: { reds6: v3reds6, reds10: v3reds10, reds15: v3reds15 } };
const L = CONFIG.breakLibrary;
const CASES = (['old', 'v3'] as const).flatMap((v) => CONFIG.levels.map((l) => [v, l.id, l] as const));

describe.each(CASES)('break library %s %s', (v, id, level) => {
  const lib = JSON.parse(FILES[v]![id]!) as Record<string, BreakEntry[]> & { version?: number };
  if (v === 'v3') {
    it('v3: tagged version 3; every break-off starts on the baulk line, between the brown and the yellow or green', () => {
      expect(lib.version).toBe(3);
      const r = table.ballRadius;
      for (const e of [...lib.redPottable!, ...lib.snookered!]) {
        expect(e.cueStart.y).toBe(table.baulkY);
        const x = Math.abs(e.cueStart.x);
        expect(x).toBeGreaterThanOrEqual(L.baulkStart.xMin);
        expect(x).toBeLessThanOrEqual(L.baulkStart.xMax);
        // a clear gap of cloth from the brown (x = 0) and the yellow / green (|x| = D radius)
        expect(x - 2 * r).toBeGreaterThan(0.04);
        expect(table.dRadius - x - 2 * r).toBeGreaterThan(0.04);
      }
    });
  } else {
    it('old: untagged, the cue ball anywhere in the D (kept for v1 / v2 round codes)', () => {
      expect(lib.version).toBeUndefined();
      expect(lib.redPottable!.some((e) => e.cueStart.y < table.baulkY - 0.05)).toBe(true);
    });
  }
  for (const kind of ['redPottable', 'snookered'] as const) {
    it(`${kind}: ${L.perLevelPerKind} breaks, all within the break rules`, () => {
      const list = lib[kind]!;
      expect(list).toHaveLength(L.perLevelPerKind);
      for (const [i, e] of list.entries()) {
        const where = `${kind} #${i} (seed ${e.seed})`;
        expect(e.kind, where).toBe(kind);
        expect(e.after, `${where}: no ball potted`).toHaveLength(level.reds + 7);
        expect(coloursMovedByBreak(e.after, table), `${where}: yellow/green/brown/blue`).toBeLessThanOrEqual(L.maxColourMove);
        expect(topColoursMovedByBreak(e.after, table), `${where}: pink/black`).toBeLessThanOrEqual(L.maxTopColourMove);
        if (kind === 'redPottable') {
          const packed = clusteredReds(e.after, table.ballRadius).size;
          expect(packed, `${where}: pack opened`).toBeLessThanOrEqual(L.maxPackedShare[id as keyof typeof L.maxPackedShare] * level.reds);
          expect(e.step1Success, where).not.toBeNull();
        } else {
          expect(e.step1Escape, where).not.toBeNull();
        }
      }
    });
  }
});
