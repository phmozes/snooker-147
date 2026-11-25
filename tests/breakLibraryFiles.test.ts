// Every break in the shipped library keeps the break rules (RULES B.1, owner 2026-11-24 and 2026-11-25).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { coloursMovedByBreak, topColoursMovedByBreak, type BreakEntry } from '../src/core/breakLibrary';
import { clusteredReds } from '../src/core/shotType';
import { buildTable } from '../src/core/table/geometry';
import reds6 from '../public/breaks/reds6.json?raw';
import reds10 from '../public/breaks/reds10.json?raw';
import reds15 from '../public/breaks/reds15.json?raw';

const table = buildTable();
const FILES: Record<string, string> = { reds6, reds10, reds15 };
const L = CONFIG.breakLibrary;

describe.each(CONFIG.levels.map((l) => [l.id, l] as const))('break library %s', (id, level) => {
  const lib = JSON.parse(FILES[id]!) as Record<string, BreakEntry[]>;
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
