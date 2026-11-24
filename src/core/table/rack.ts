// Starting layout (rack) for 6, 10 or 15 reds: colours on their spots, reds in a triangle behind pink,
// cue ball in the D. Pure module.

import { CONFIG } from '../../config/game.config';
import { COLOURS, dist, vec, type Ball, type Vec2 } from '../types';
import type { TableGeometry } from './geometry';

export interface RackConfig {
  redGap: number;
  pinkToApexGap: number;
  cueStart: readonly [number, number];
}

/** Number of triangle rows for a red count (6 -> 3, 10 -> 4, 15 -> 5). Throws for non-triangle counts. */
export function triangleRows(reds: number): number {
  const rows = Math.round((Math.sqrt(8 * reds + 1) - 1) / 2);
  if (rows < 1 || (rows * (rows + 1)) / 2 !== reds) throw new Error(`${reds} reds do not form a triangle`);
  return rows;
}

export function rackBalls(reds: number, table: TableGeometry, cfg: RackConfig = CONFIG.rack): Ball[] {
  const r = table.ballRadius;
  const balls: Ball[] = [{ id: 'cue', kind: 'cue', pos: vec(cfg.cueStart[0], cfg.cueStart[1]) }];
  for (const c of COLOURS) balls.push({ id: c, kind: c, pos: { ...table.spots[c] } });

  // Front red (apex) points at pink; each next row is further up the table.
  const step = 2 * r + cfg.redGap; // centre-to-centre distance of touching reds
  const rowHeight = (step * Math.sqrt(3)) / 2;
  const apexY = table.spots.pink.y + 2 * r + cfg.pinkToApexGap;
  let n = 0;
  for (let row = 0; row < triangleRows(reds); row++) {
    for (let i = 0; i <= row; i++) {
      n++;
      balls.push({ id: `red${n}`, kind: 'red', pos: vec((i - row / 2) * step, apexY + row * rowHeight) });
    }
  }
  return balls;
}

export interface RackCheck {
  overlaps: number; // pairs of balls closer than one diameter
  minGap: number; // smallest surface-to-surface gap between two balls (m)
  outside: number; // balls not fully on the cloth
  cueInD: boolean;
}

/** Sanity check used by tests and by the debug page. */
export function checkRack(balls: Ball[], table: TableGeometry): RackCheck {
  const r = table.ballRadius;
  let overlaps = 0;
  let minGap = Infinity;
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const gap = dist(balls[i]!.pos, balls[j]!.pos) - 2 * r;
      minGap = Math.min(minGap, gap);
      if (gap < -1e-9) overlaps++;
    }
  }
  const inside = (p: Vec2) =>
    Math.abs(p.x) <= table.halfWidth - r && Math.abs(p.y) <= table.halfLength - r;
  const cue = balls.find((b) => b.kind === 'cue')!.pos;
  return {
    overlaps,
    minGap,
    outside: balls.filter((b) => !inside(b.pos)).length,
    cueInD: cue.y <= table.baulkY && dist(cue, table.dCentre) <= table.dRadius,
  };
}
