// Task 4.9 (owner 2026-11-25): position on the next red after a colour (solver redPlayCost, config solver.natural.redPlay).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { nextShotCost } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';
import type { Ball } from '../src/core/types';

const table = buildTable();
const RP = CONFIG.solver.natural.redPlay;
const ball = (id: string, kind: Ball['kind'], x: number, y: number): Ball => ({ id, kind, pos: { x, y } });
const black = ball('black', 'black', table.spots.black.x, table.spots.black.y);
// extra cost of the red rules alone: with them minus without them (the base angle cost is the same)
const extra = (cue: { x: number; y: number }, balls: Ball[]) =>
  nextShotCost(cue, balls, 'red', table, true) - nextShotCost(cue, balls, 'red', table, false);

describe('position on the next red (task 4.9)', () => {
  it('the base angle range matches the old next-ball angle cost, so only the extras change', () => {
    expect(RP.cutDeg).toEqual(CONFIG.solver.natural.idealNextCutDeg);
    expect(RP.cutDegPerPoint).toBe(CONFIG.solver.natural.cutDegPerPoint);
  });
  it('a comfortable angle into a near pocket, close to the pink side of the black, costs nothing extra', () => {
    const balls = [black, ball('red1', 'red', 0.25, 1.1)];
    expect(extra({ x: 0.05, y: 0.75 }, balls)).toBeCloseTo(0, 6);
  });
  it('the cue ball on a side cushion costs extra', () => {
    const balls = [black, ball('red1', 'red', 0.25, 1.1)];
    const side = { x: table.halfWidth - 0.05, y: 0.75 };
    expect(extra(side, balls)).toBeGreaterThan(0);
  });
  it('the extras never exceed maxCost (a nicer red never outweighs a natural colour pot)', () => {
    const balls = [black, ball('red1', 'red', -0.6, 0.4), ball('red2', 'red', 0.7, 0.2)];
    for (const cue of [{ x: table.halfWidth - 0.05, y: -0.5 }, { x: -(table.halfWidth - 0.1), y: 1.2 }, { x: 0, y: -1.2 }]) {
      expect(extra(cue, balls)).toBeLessThanOrEqual(RP.maxCost + 1e-9);
    }
  });
});
