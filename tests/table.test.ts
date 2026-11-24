import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { buildTable } from '../src/core/table/geometry';
import { checkRack, rackBalls, triangleRows } from '../src/core/table/rack';
import { dist } from '../src/core/types';

const table = buildTable();
const same = (a: { x: number; y: number }, b: { x: number; y: number }) => dist(a, b) < 1e-12;

describe('table geometry', () => {
  it('has 6 pockets, 6 cushions and 12 jaws', () => {
    expect(table.pockets).toHaveLength(6);
    expect(table.segments.filter((s) => s.kind === 'cushion')).toHaveLength(6);
    expect(table.segments.filter((s) => s.kind === 'jaw')).toHaveLength(12);
  });

  it('puts the spots where the real snooker rules put them', () => {
    const s = table.spots;
    expect(s.blue).toEqual({ x: 0, y: 0 });
    expect(s.brown.y).toBeCloseTo(-1.0475, 6);
    expect(s.yellow).toEqual({ x: 0.292, y: s.brown.y });
    expect(s.green).toEqual({ x: -0.292, y: s.brown.y });
    expect(s.pink.y).toBeCloseTo(0.89225, 6);
    expect(s.black.y).toBeCloseTo(1.4605, 6);
  });

  it('pocket mouths have the configured width', () => {
    for (const p of table.pockets) {
      const want = p.kind === 'corner' ? CONFIG.table.corner.mouth : CONFIG.table.middle.mouth;
      expect(dist(p.mouthA, p.mouthB)).toBeCloseTo(want, 9);
    }
  });

  it('every cushion end meets the start of a jaw (no gaps in the rail)', () => {
    const jawStarts = table.segments.filter((s) => s.kind === 'jaw').map((s) => s.a);
    for (const c of table.segments.filter((s) => s.kind === 'cushion')) {
      expect(jawStarts.some((j) => same(j, c.a))).toBe(true);
      expect(jawStarts.some((j) => same(j, c.b))).toBe(true);
    }
  });

  it('is left-right and top-bottom symmetric', () => {
    const has = (x1: number, y1: number, x2: number, y2: number) =>
      table.segments.some(
        (s) => (same(s.a, { x: x1, y: y1 }) && same(s.b, { x: x2, y: y2 })) ||
               (same(s.b, { x: x1, y: y1 }) && same(s.a, { x: x2, y: y2 })),
      );
    for (const s of table.segments) {
      expect(has(-s.a.x, s.a.y, -s.b.x, s.b.y)).toBe(true);
      expect(has(s.a.x, -s.a.y, s.b.x, -s.b.y)).toBe(true);
    }
  });

  it('jaws narrow the pocket but a ball still fits through', () => {
    for (const p of table.pockets) {
      const [j1, j2] = table.segments.filter((s) => s.pocket === p.id);
      const mouth = dist(p.mouthA, p.mouthB);
      const throat = dist(j1!.b, j2!.b);
      expect(throat).toBeLessThan(mouth);
      expect(throat).toBeGreaterThan(2 * table.ballRadius);
    }
  });

  it('capture circles lie beyond the mouth line, inside the pocket', () => {
    for (const p of table.pockets) {
      const depth = (p.captureCentre.x - p.mouthMid.x) * p.inward.x + (p.captureCentre.y - p.mouthMid.y) * p.inward.y;
      expect(depth).toBeGreaterThan(0);
    }
  });
});

describe('rack', () => {
  it('knows the triangle sizes', () => {
    expect(triangleRows(6)).toBe(3);
    expect(triangleRows(10)).toBe(4);
    expect(triangleRows(15)).toBe(5);
    expect(() => triangleRows(7)).toThrow();
  });

  for (const level of CONFIG.levels) {
    describe(`${level.reds} reds`, () => {
      const balls = rackBalls(level.reds, table);
      const reds = balls.filter((b) => b.kind === 'red');

      it('has cue + 6 colours + the reds', () => {
        expect(balls).toHaveLength(1 + 6 + level.reds);
        expect(reds).toHaveLength(level.reds);
        expect(new Set(balls.map((b) => b.id)).size).toBe(balls.length);
      });

      it('no overlaps, all on the cloth, cue ball in the D', () => {
        const c = checkRack(balls, table);
        expect(c.overlaps).toBe(0);
        expect(c.outside).toBe(0);
        expect(c.cueInD).toBe(true);
      });

      it('reds sit between pink and black, not touching either', () => {
        const r = table.ballRadius;
        for (const red of reds) {
          expect(dist(red.pos, table.spots.pink)).toBeGreaterThan(2 * r);
          expect(dist(red.pos, table.spots.black)).toBeGreaterThan(2 * r);
          expect(red.pos.y).toBeGreaterThan(table.spots.pink.y);
          expect(red.pos.y).toBeLessThan(table.spots.black.y);
        }
      });

      it('the front red points at pink, on the centre line', () => {
        const front = reds.reduce((a, b) => (b.pos.y < a.pos.y ? b : a));
        expect(front.pos.x).toBeCloseTo(0, 12);
      });
    });
  }
});
