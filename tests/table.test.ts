import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { arcContainsAngle, arcPoint, ballTouchesJaw, buildTable, closestPointOnArc } from '../src/core/table/geometry';
import { checkRack, rackBalls, triangleRows } from '../src/core/table/rack';
import { add, dist, normalize, scale, sub } from '../src/core/types';

const table = buildTable();
const r = table.ballRadius;
const same = (a: { x: number; y: number }, b: { x: number; y: number }) => dist(a, b) < 1e-12;
const pocketCfg = (kind: 'corner' | 'middle') => (kind === 'corner' ? CONFIG.table.corner : CONFIG.table.middle);

describe('table geometry', () => {
  it('has 6 pockets, 6 straight cushions and 12 rounded jaws', () => {
    expect(table.pockets).toHaveLength(6);
    expect(table.cushions).toHaveLength(6);
    expect(table.jaws).toHaveLength(12);
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

  it('mouth = narrowest gap between the two jaw arcs = configured width (89 / 102 mm)', () => {
    for (const p of table.pockets) {
      expect(dist(p.mouthA, p.mouthB)).toBeCloseTo(pocketCfg(p.kind).mouth, 9);
      const [j1, j2] = table.jaws.filter((j) => j.pocket === p.id);
      expect(dist(j1!.centre, j2!.centre) - j1!.radius - j2!.radius).toBeCloseTo(pocketCfg(p.kind).mouth, 9);
    }
  });

  it('corner and middle jaws have their own radius', () => {
    for (const p of table.pockets) {
      for (const j of table.jaws.filter((q) => q.pocket === p.id)) {
        expect(j.radius).toBe(pocketCfg(p.kind).jawRadius);
      }
    }
    expect(CONFIG.table.corner.jawRadius).not.toBe(CONFIG.table.middle.jawRadius);
  });

  it('each jaw starts tangent to its cushion face, curving away from the cloth', () => {
    for (const j of table.jaws) {
      const cushion = table.cushions.find((c) => same(c.a, j.tangentPoint) || same(c.b, j.tangentPoint))!;
      expect(cushion).toBeDefined();
      const along = normalize(sub(cushion.b, cushion.a));
      const toCentre = sub(j.centre, j.tangentPoint);
      expect(Math.hypot(toCentre.x, toCentre.y)).toBeCloseTo(j.radius, 12);
      expect(toCentre.x * along.x + toCentre.y * along.y).toBeCloseTo(0, 12); // perpendicular = tangent
      // circle centre is behind the cushion (off the cloth)
      expect(Math.abs(j.centre.x) > table.halfWidth || Math.abs(j.centre.y) > table.halfLength).toBe(true);
      // arc starts at the tangent point
      expect(same(arcPoint(j, j.start), j.tangentPoint)).toBe(true);
    }
  });

  it('every straight cushion ends exactly where a jaw begins (no gaps, no corners)', () => {
    const starts = table.jaws.map((j) => j.tangentPoint);
    for (const c of table.cushions) {
      expect(starts.some((s) => same(s, c.a))).toBe(true);
      expect(starts.some((s) => same(s, c.b))).toBe(true);
    }
  });

  it('a ball sliding along a cushion touches the jaw at the join (smooth hand-over)', () => {
    for (const j of table.jaws) {
      const intoCloth = normalize(sub(j.tangentPoint, j.centre));
      const ball = add(j.tangentPoint, scale(intoCloth, r));
      expect(dist(ball, closestPointOnArc(j, ball))).toBeCloseTo(r, 12);
    }
  });

  it('the rounded part turns 45 degrees at a corner and 90 at a middle pocket, ending at the narrowest point', () => {
    for (const j of table.jaws) {
      const kind = table.pockets.find((p) => p.id === j.pocket)!.kind;
      expect(Math.abs(j.sweep) * (180 / Math.PI)).toBeCloseTo(kind === 'corner' ? 45 : 90, 9);
      expect(same(arcPoint(j, j.start + j.sweep), j.narrowestPoint)).toBe(true);
    }
  });

  it('after the rounded part, each jaw runs straight, the two straight parts parallel and one mouth apart', () => {
    for (const p of table.pockets) {
      const [w1, w2] = p.throat;
      const cfg = pocketCfg(p.kind);
      for (const w of [w1, w2]) {
        const along = normalize(sub(w.b, w.a));
        expect(along.x * p.inward.x + along.y * p.inward.y).toBeCloseTo(1, 12); // straight into the pocket
        expect(dist(w.a, w.b)).toBeCloseTo(cfg.throatLength, 12);
        expect(w.normal.x * along.x + w.normal.y * along.y).toBeCloseTo(0, 12);
      }
      expect(same(w1.a, p.mouthA) && same(w2.a, p.mouthB)).toBe(true);
      // constant width: the far ends are as far apart as the start
      expect(dist(w1.b, w2.b)).toBeCloseTo(cfg.mouth, 12);
      // smooth join: at the narrowest point the arc runs in the throat direction
      for (const j of table.jaws.filter((q) => q.pocket === p.id)) {
        const radial = normalize(sub(j.narrowestPoint, j.centre));
        expect(radial.x * p.inward.x + radial.y * p.inward.y).toBeCloseTo(0, 12);
      }
    }
    expect(table.throatWalls).toHaveLength(12);
  });

  it('the ball drops over the slate cut: radius 89 mm, front edge 51 mm into the throat', () => {
    for (const p of table.pockets) {
      const cfg = pocketCfg(p.kind);
      expect(p.captureRadius).toBe(cfg.slateCutRadius);
      const frontEdge = dist(p.mouthMid, p.captureCentre) - p.captureRadius;
      expect(frontEdge).toBeCloseTo(cfg.fallSetback, 12);
      const c = sub(p.captureCentre, p.mouthMid);
      expect(Math.abs(c.x * p.inward.y - c.y * p.inward.x)).toBeLessThan(1e-12); // on the throat's centre line
    }
  });

  it('the "effective width" setting widens every mouth by exactly that much, nothing else', () => {
    const wider = buildTable({ ...CONFIG.table, mouthExtra: 0.004 });
    wider.pockets.forEach((p, i) => {
      expect(dist(p.mouthA, p.mouthB) - dist(table.pockets[i]!.mouthA, table.pockets[i]!.mouthB)).toBeCloseTo(0.004, 12);
    });
    expect(wider.spots).toEqual(table.spots);
    expect(CONFIG.table.mouthExtra).toBe(0); // real dimensions by default
  });

  it('collisions use the arc: touch near the arc, no touch where the arc does not exist', () => {
    const j = table.jaws.find((q) => q.pocket === 'middleRight')!;
    const out = normalize(sub(j.narrowestPoint, j.centre));
    expect(ballTouchesJaw(j, add(j.narrowestPoint, scale(out, r - 0.001)), r)).toBe(true);
    expect(ballTouchesJaw(j, add(j.narrowestPoint, scale(out, r + 0.001)), r)).toBe(false);
    // same distance from the circle, but 40 degrees beyond the end of the arc: no jaw there
    const beyond = j.start + j.sweep + Math.sign(j.sweep) * 40 * (Math.PI / 180);
    const p = add(j.centre, scale({ x: Math.cos(beyond), y: Math.sin(beyond) }, j.radius + r / 2));
    expect(ballTouchesJaw(j, p, r)).toBe(false);
  });

  it('is left-right and top-bottom symmetric', () => {
    for (const j of table.jaws) {
      expect(table.jaws.some((k) => same(k.centre, { x: -j.centre.x, y: j.centre.y }))).toBe(true);
      expect(table.jaws.some((k) => same(k.centre, { x: j.centre.x, y: -j.centre.y }))).toBe(true);
    }
  });

  it('a ball fits through every mouth; the slate cut lies beyond the mouth, inside the pocket', () => {
    for (const p of table.pockets) {
      expect(dist(p.mouthA, p.mouthB)).toBeGreaterThan(2 * r);
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
