// Night 2026-11-24, phase 1: positional play around the black (owner's rules) and RE-RACK avoidance (locked reds).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { allRedsLocked, pocketPrefCost, zoneCost } from '../src/core/shotType';
import { nextShotCost, shotCaps } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';
import type { Ball } from '../src/core/types';

const table = buildTable();
const r = table.ballRadius;
const B = CONFIG.solver.natural.blackPlay;
const ball = (id: string, kind: Ball['kind'], x: number, y: number): Ball => ({ id, kind, pos: { x, y } });

describe('pocket choice (rule 2)', () => {
  it('a red from the black half pays for a baulk-end corner, a red in the baulk half does not', () => {
    expect(pocketPrefCost('red', { x: 0.3, y: 0.6 }, 'bottomLeft')).toBe(B.redBaulkCornerCost);
    expect(pocketPrefCost('red', { x: 0.3, y: -0.6 }, 'bottomLeft')).toBe(0);
    expect(pocketPrefCost('red', { x: 0.3, y: 0.6 }, 'topRight')).toBe(0);
    expect(pocketPrefCost('red', { x: 0.3, y: 0.6 }, 'middleRight')).toBe(B.redMiddleCost);
  });
  it('black only into the black-end corners; pink also into the middles', () => {
    expect(pocketPrefCost('black', table.spots.black, 'topLeft')).toBe(0);
    expect(pocketPrefCost('black', table.spots.black, 'middleLeft')).toBe(B.colourOffPocketCost);
    expect(pocketPrefCost('pink', table.spots.pink, 'middleLeft')).toBe(0);
    expect(pocketPrefCost('pink', table.spots.pink, 'bottomLeft')).toBe(B.colourOffPocketCost);
  });
});

describe('cue ball position (rules 1 and 5)', () => {
  const black = ball('black', 'black', table.spots.black.x, table.spots.black.y);
  const reds = [ball('red1', 'red', 0.4, 0.9), ball('red2', 'red', -0.4, 1.0)];
  it('behind the black (between the black and its cushion) costs more than in front of it', () => {
    const balls = [black, ...reds];
    const front = nextShotCost({ x: 0.25, y: black.pos.y - 0.5 }, balls, 'black', table);
    const behind = nextShotCost({ x: 0.25, y: black.pos.y + 0.2 }, balls, 'black', table);
    expect(behind).toBeGreaterThan(front);
  });
  it('the zone between black, pink and blue is free while reds are in the black half; outside it costs', () => {
    expect(zoneCost({ x: 0, y: 0.7 }, reds, table)).toBe(0);
    expect(zoneCost({ x: 0, y: table.spots.black.y + 0.2 }, reds, table)).toBeGreaterThan(0);
    expect(zoneCost({ x: 0, y: -1.0 }, reds, table)).toBeGreaterThan(0);
    expect(zoneCost({ x: 0, y: -1.0 }, [ball('red1', 'red', 0.4, -0.9)], table)).toBe(0); // no red in the black half
  });
});

describe('locked reds (RE-RACK avoidance)', () => {
  it('two reds glued behind the pink spot are locked (the layout of the RE-RACK in reds6-276 step 9)', () => {
    const after = [ball('cue', 'cue', -0.105, -0.772), ball('pink', 'pink', -0.001, 0.864), ball('red1', 'red', 0.021, 0.939),
      ball('red3', 'red', 0.029, 0.993), ball('black', 'black', 0, 1.46), ball('blue', 'blue', 0, 0)];
    expect(allRedsLocked(after, table)).toBe(1);
  });
  it('a loose red is not locked; no reds = 0', () => {
    expect(allRedsLocked([ball('red1', 'red', 0.3, 0.3), ball('black', 'black', 0, 1.46)], table)).toBe(0);
    expect(allRedsLocked([ball('black', 'black', 0, 1.46)], table)).toBe(0);
  });
  it('the rescue search is inside the fixed shot cap', () => {
    const c = shotCaps();
    expect(c.rescue).toBeGreaterThan(0);
    expect(c.success).toBe(c.normal + c.wide + c.rescue + c.exhibition + c.spray);
    expect(r).toBeGreaterThan(0);
  });
});
