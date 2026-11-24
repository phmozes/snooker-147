// Table geometry: cushions, pocket mouths with angled jaws, capture circles, spots, baulk line and D.
// Pure module: numbers in, shapes out. Origin = table centre, +y toward the black end, +x right.

import { CONFIG } from '../../config/game.config';
import { add, normalize, scale, sub, vec, type Colour, type Vec2 } from '../types';

export interface PocketConfig {
  mouth: number;
  jawLength: number;
  jawNarrowingDeg: number;
  captureDepth: number;
  captureRadius: number;
}

export interface TableConfig {
  length: number;
  width: number;
  ballRadius: number;
  baulkLineFromBottom: number;
  dRadius: number;
  blackFromTop: number;
  corner: PocketConfig;
  middle: PocketConfig;
}

export type PocketId =
  | 'topLeft' | 'topRight' | 'middleLeft' | 'middleRight' | 'bottomLeft' | 'bottomRight';

export interface Pocket {
  id: PocketId;
  kind: 'corner' | 'middle';
  mouthA: Vec2; // jaw point 1 (where the cushion ends)
  mouthB: Vec2; // jaw point 2
  mouthMid: Vec2;
  inward: Vec2; // unit direction from the mouth into the pocket
  captureCentre: Vec2;
  captureRadius: number;
}

/** A straight cushion piece. Balls bounce off it (also off its two end points). */
export interface Segment {
  a: Vec2;
  b: Vec2;
  kind: 'cushion' | 'jaw';
  pocket?: PocketId; // for jaws: which pocket they belong to
}

export interface TableGeometry {
  halfWidth: number;
  halfLength: number;
  ballRadius: number;
  segments: Segment[];
  pockets: Pocket[];
  spots: Record<Colour, Vec2>;
  baulkY: number;
  dCentre: Vec2;
  dRadius: number;
}

const DEG = Math.PI / 180;

/** Jaws start at a jaw point, go into the pocket, and lean toward the pocket's centre line. */
function jaw(start: Vec2, pocket: Pocket, cfg: PocketConfig): Segment {
  const towardCentreLine = normalize(sub(pocket.mouthMid, start));
  const t = cfg.jawNarrowingDeg * DEG;
  const dir = normalize(add(scale(pocket.inward, Math.cos(t)), scale(towardCentreLine, Math.sin(t))));
  return { a: start, b: add(start, scale(dir, cfg.jawLength)), kind: 'jaw', pocket: pocket.id };
}

function makePocket(
  id: PocketId, kind: 'corner' | 'middle', mouthA: Vec2, mouthB: Vec2, inward: Vec2, cfg: PocketConfig,
): Pocket {
  const mouthMid = scale(add(mouthA, mouthB), 0.5);
  return {
    id, kind, mouthA, mouthB, mouthMid, inward,
    captureCentre: add(mouthMid, scale(inward, cfg.captureDepth)),
    captureRadius: cfg.captureRadius,
  };
}

export function buildTable(cfg: TableConfig = CONFIG.table): TableGeometry {
  const hw = cfg.width / 2;
  const hl = cfg.length / 2;
  const a = cfg.corner.mouth / Math.SQRT2; // how far the corner cut reaches along each cushion
  const m = cfg.middle.mouth / 2;

  const pockets: Pocket[] = [];
  const segments: Segment[] = [];

  // Corner pockets: (sx, sy) = which corner.
  const corners: [PocketId, number, number][] = [
    ['topLeft', -1, 1], ['topRight', 1, 1], ['bottomLeft', -1, -1], ['bottomRight', 1, -1],
  ];
  for (const [id, sx, sy] of corners) {
    const onSide = vec(sx * hw, sy * (hl - a)); // jaw point on the long (side) cushion
    const onEnd = vec(sx * (hw - a), sy * hl); // jaw point on the short (end) cushion
    const p = makePocket(id, 'corner', onSide, onEnd, normalize(vec(sx, sy)), cfg.corner);
    pockets.push(p);
    segments.push(jaw(onSide, p, cfg.corner), jaw(onEnd, p, cfg.corner));
  }

  // Middle pockets.
  for (const [id, sx] of [['middleLeft', -1], ['middleRight', 1]] as [PocketId, number][]) {
    const upper = vec(sx * hw, m);
    const lower = vec(sx * hw, -m);
    const p = makePocket(id, 'middle', upper, lower, vec(sx, 0), cfg.middle);
    pockets.push(p);
    segments.push(jaw(upper, p, cfg.middle), jaw(lower, p, cfg.middle));
  }

  // The six cushions between the pockets.
  for (const sx of [-1, 1]) {
    segments.push({ a: vec(sx * hw, -(hl - a)), b: vec(sx * hw, -m), kind: 'cushion' });
    segments.push({ a: vec(sx * hw, m), b: vec(sx * hw, hl - a), kind: 'cushion' });
  }
  for (const sy of [-1, 1]) {
    segments.push({ a: vec(-(hw - a), sy * hl), b: vec(hw - a, sy * hl), kind: 'cushion' });
  }

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
    segments, pockets, spots, baulkY, dCentre: vec(0, baulkY), dRadius: cfg.dRadius,
  };
}
