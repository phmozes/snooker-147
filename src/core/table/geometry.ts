// Table geometry: cushions, pockets, spots, baulk line, D. Pure module: numbers in, shapes out.
// Origin = table centre, +y toward the black end, +x right.
//
// One pocket = two jaws. Each jaw = a ROUNDED part (circular arc, tangent to the cushion face, turning until it points
// straight into the pocket: 45 degrees at a corner, 90 at a middle pocket) + a STRAIGHT part (the throat). The two
// straight parts are parallel, `mouth` apart. The ball drops when its centre passes over the edge of the slate cut:
// a circle (radius slateCutRadius) on the pocket's centre line. Its front edge is `fallSetback` behind either the
// start of the throat (corners) or the cushion line (middle pockets) - see `fallFrom`.

import { CONFIG } from '../../config/game.config';
import { add, dist, normalize, scale, sub, vec, type Colour, type Vec2 } from '../types';

export interface PocketConfig {
  mouth: number; // width of the throat (between the two straight parallel parts)
  jawRadius: number; // radius of the rounded part
  throatLength: number; // length of the straight parallel parts
  fallSetback: number; // front edge of the slate cut, measured into the pocket from `fallFrom`
  fallFrom: 'throat' | 'cushionLine'; // throat = start of the straight parts; cushionLine = where the jaws begin
  slateCutRadius: number; // radius of the slate cut (the hole the ball drops into)
}

export interface TableConfig {
  length: number;
  width: number;
  ballRadius: number;
  baulkLineFromBottom: number;
  dRadius: number;
  blackFromTop: number;
  mouthExtra: number; // "effective width": added to every mouth for play (undercut cushion rubber); 0 = as measured
  corner: PocketConfig;
  middle: PocketConfig;
}

export type PocketId =
  | 'topLeft' | 'topRight' | 'middleLeft' | 'middleRight' | 'bottomLeft' | 'bottomRight';

/** A straight face: a cushion between two pockets, or the straight (throat) part of a jaw. */
export interface Segment {
  a: Vec2;
  b: Vec2;
  normal: Vec2; // unit, pointing to the side where balls are (the cloth, or the middle of the throat)
  pocket?: PocketId; // set for the straight part of a jaw
}

/**
 * A rounded cushion end (jaw). It is part of a circle: the ball bounces off the OUTSIDE of that circle,
 * but only where the arc exists (from `start`, turning by `sweep` radians; sweep sign = direction).
 */
export interface JawArc {
  pocket: PocketId;
  centre: Vec2;
  radius: number;
  start: number; // angle (radians) of the tangent point, where the straight cushion ends
  sweep: number; // signed angle the arc turns through, toward the pocket
  tangentPoint: Vec2; // where the straight cushion face meets the arc
  narrowestPoint: Vec2; // point of the arc closest to the opposite jaw
}

export interface Pocket {
  id: PocketId;
  kind: 'corner' | 'middle';
  mouthA: Vec2; // start of the throat on jaw 1 (end of its rounded part)
  mouthB: Vec2; // start of the throat on jaw 2
  mouthMid: Vec2;
  inward: Vec2; // unit direction from the mouth into the pocket (along the throat)
  throat: [Segment, Segment]; // the two straight parallel parts
  cushionLineDepth: number; // line through both jaw tangent points, measured from mouthMid along inward (negative)
  fallFront: number; // front edge of the slate cut, measured from mouthMid along inward
  captureCentre: Vec2; // centre of the slate cut: ball centre inside this circle = dropped
  captureRadius: number;
}

export interface TableGeometry {
  halfWidth: number;
  halfLength: number;
  ballRadius: number;
  cushions: Segment[]; // the six straight cushions between pockets
  throatWalls: Segment[]; // the twelve straight jaw parts (two per pocket)
  jaws: JawArc[]; // the twelve rounded jaw parts
  pockets: Pocket[];
  spots: Record<Colour, Vec2>;
  baulkY: number;
  dCentre: Vec2;
  dRadius: number;
}

const DEG = Math.PI / 180;
const angleOf = (v: Vec2) => Math.atan2(v.y, v.x);
/** Smallest signed difference b - a, in (-PI, PI]. */
const angleDiff = (a: number, b: number) => {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
};

export const arcPoint = (arc: JawArc, angle: number): Vec2 =>
  add(arc.centre, vec(arc.radius * Math.cos(angle), arc.radius * Math.sin(angle)));

/** Is this direction (angle from the arc centre) inside the arc? */
export function arcContainsAngle(arc: JawArc, angle: number): boolean {
  const d = angleDiff(arc.start, angle) * Math.sign(arc.sweep);
  return d >= -1e-12 && d <= Math.abs(arc.sweep) + 1e-12;
}

/** Closest point on the jaw arc to point p. Physics uses this for ball-vs-jaw contact. */
export function closestPointOnArc(arc: JawArc, p: Vec2): Vec2 {
  const ang = angleOf(sub(p, arc.centre));
  if (arcContainsAngle(arc, ang)) return arcPoint(arc, ang);
  const a = arcPoint(arc, arc.start);
  const b = arcPoint(arc, arc.start + arc.sweep);
  return dist(p, a) <= dist(p, b) ? a : b;
}

/** True if a ball with centre p and radius r touches or overlaps the jaw arc. */
export function ballTouchesJaw(arc: JawArc, p: Vec2, r: number): boolean {
  return dist(p, closestPointOnArc(arc, p)) <= r;
}

/** Points along the arc, for drawing. */
export function arcPoints(arc: JawArc, fromAngle: number, toAngle: number, n = 24): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) out.push(arcPoint(arc, fromAngle + ((toAngle - fromAngle) * i) / n));
  return out;
}

/**
 * One rounded jaw: circle tangent to the cushion face at `tangentPoint`. The arc turns until it faces the opposite
 * jaw's circle; there its direction is parallel to the throat and the straight part takes over.
 */
function makeJaw(pocket: PocketId, centre: Vec2, tangentPoint: Vec2, otherCentre: Vec2, radius: number): JawArc {
  const start = angleOf(sub(tangentPoint, centre));
  const sweep = angleDiff(start, angleOf(sub(otherCentre, centre)));
  return {
    pocket, centre, radius, start, sweep, tangentPoint,
    narrowestPoint: add(centre, scale(normalize(sub(otherCentre, centre)), radius)),
  };
}

function makePocket(id: PocketId, kind: 'corner' | 'middle', j1: JawArc, j2: JawArc, inward: Vec2, cfg: PocketConfig): Pocket {
  const mouthMid = scale(add(j1.narrowestPoint, j2.narrowestPoint), 0.5);
  const wall = (j: JawArc): Segment => ({
    pocket: id,
    a: j.narrowestPoint,
    b: add(j.narrowestPoint, scale(inward, cfg.throatLength)),
    normal: normalize(sub(mouthMid, j.narrowestPoint)), // toward the middle of the throat
  });
  const cushionLineDepth = (j1.tangentPoint.x - mouthMid.x) * inward.x + (j1.tangentPoint.y - mouthMid.y) * inward.y;
  const fallFront = (cfg.fallFrom === 'cushionLine' ? cushionLineDepth : 0) + cfg.fallSetback;
  return {
    id, kind, mouthA: j1.narrowestPoint, mouthB: j2.narrowestPoint, mouthMid, inward,
    throat: [wall(j1), wall(j2)],
    cushionLineDepth, fallFront,
    captureCentre: add(mouthMid, scale(inward, fallFront + cfg.slateCutRadius)),
    captureRadius: cfg.slateCutRadius,
  };
}

export function buildTable(cfg: TableConfig = CONFIG.table): TableGeometry {
  const hw = cfg.width / 2;
  const hl = cfg.length / 2;
  const rc = cfg.corner.jawRadius;
  const rm = cfg.middle.jawRadius;
  const mouthC = cfg.corner.mouth + cfg.mouthExtra;
  const mouthM = cfg.middle.mouth + cfg.mouthExtra;
  // Corner: the two jaw circles sit symmetric about the diagonal. Gap between them = mouth:
  //   sqrt(2) * (rc + t) - 2 rc = mouth  ->  t = (mouth + 2 rc) / sqrt(2) - rc
  // t = distance from the table corner to where each straight cushion ends.
  const t = (mouthC + 2 * rc) / Math.SQRT2 - rc;
  // Middle: jaw circles face each other across the pocket; gap = 2 ym - 2 rm = mouth.
  const ym = mouthM / 2 + rm;

  const pockets: Pocket[] = [];
  const jaws: JawArc[] = [];

  const corners: [PocketId, number, number][] = [
    ['topLeft', -1, 1], ['topRight', 1, 1], ['bottomLeft', -1, -1], ['bottomRight', 1, -1],
  ];
  for (const [id, sx, sy] of corners) {
    const sideCentre = vec(sx * (hw + rc), sy * (hl - t)); // behind the long (side) cushion
    const endCentre = vec(sx * (hw - t), sy * (hl + rc)); // behind the short (end) cushion
    const j1 = makeJaw(id, sideCentre, vec(sx * hw, sy * (hl - t)), endCentre, rc);
    const j2 = makeJaw(id, endCentre, vec(sx * (hw - t), sy * hl), sideCentre, rc);
    jaws.push(j1, j2);
    pockets.push(makePocket(id, 'corner', j1, j2, normalize(vec(sx, sy)), cfg.corner));
  }

  for (const [id, sx] of [['middleLeft', -1], ['middleRight', 1]] as [PocketId, number][]) {
    const upperCentre = vec(sx * (hw + rm), ym);
    const lowerCentre = vec(sx * (hw + rm), -ym);
    const j1 = makeJaw(id, upperCentre, vec(sx * hw, ym), lowerCentre, rm);
    const j2 = makeJaw(id, lowerCentre, vec(sx * hw, -ym), upperCentre, rm);
    jaws.push(j1, j2);
    pockets.push(makePocket(id, 'middle', j1, j2, vec(sx, 0), cfg.middle));
  }

  // The six straight cushions, each ending exactly at a jaw's tangent point.
  const cushions: Segment[] = [];
  for (const sx of [-1, 1]) {
    cushions.push({ a: vec(sx * hw, -(hl - t)), b: vec(sx * hw, -ym), normal: vec(-sx, 0) });
    cushions.push({ a: vec(sx * hw, ym), b: vec(sx * hw, hl - t), normal: vec(-sx, 0) });
  }
  for (const sy of [-1, 1]) cushions.push({ a: vec(-(hw - t), sy * hl), b: vec(hw - t, sy * hl), normal: vec(0, -sy) });

  const baulkY = -hl + cfg.baulkLineFromBottom;
  const spots: Record<Colour, Vec2> = {
    yellow: vec(cfg.dRadius, baulkY), // right of the D, seen from the baulk end
    green: vec(-cfg.dRadius, baulkY),
    brown: vec(0, baulkY),
    blue: vec(0, 0),
    pink: vec(0, hl / 2), // midway between centre and top cushion
    black: vec(0, hl - cfg.blackFromTop),
  };

  return {
    halfWidth: hw, halfLength: hl, ballRadius: cfg.ballRadius,
    cushions, throatWalls: pockets.flatMap((p) => p.throat), jaws, pockets, spots, baulkY, dCentre: vec(0, baulkY), dRadius: cfg.dRadius,
  };
}
