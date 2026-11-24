// Fixed test shots for the debug page and the physics tests (the real break-off library comes in task 4.6).

import { CONFIG } from '../../config/game.config';
import type { TableGeometry } from '../table/geometry';
import { sub, type Ball, type Vec2 } from '../types';

/**
 * Direction for a hard break from the cue ball's place in the D. It aims just outside the outer red of
 * one triangle row (config dev.breakAimRow / breakAimOffset), so it passes the pink and smashes into
 * the side of the pack. Those two numbers were picked by a scan: most reds move, for 6, 10 and 15 reds.
 */
export function breakAim(table: TableGeometry, balls: Ball[]): Vec2 {
  const cue = balls.find((b) => b.kind === 'cue')!;
  const reds = balls.filter((b) => b.kind === 'red');
  const rowYs = [...new Set(reds.map((b) => b.pos.y))].sort((a, b) => a - b);
  const rowY = rowYs[Math.min(CONFIG.dev.breakAimRow, rowYs.length - 1)]!;
  const side = Math.sign(cue.pos.x) || 1;
  const outer = reds
    .filter((b) => b.pos.y === rowY)
    .reduce((a, b) => (b.pos.x * side > a.pos.x * side ? b : a));
  return sub({ x: outer.pos.x + side * CONFIG.dev.breakAimOffset * table.ballRadius, y: rowY }, cue.pos);
}
