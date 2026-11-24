// Task 4.7: shot labels and naturalness. Labels come from the physics events of a real simulated shot.
import { describe, expect, it } from 'vitest';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { mulberry32 } from '../src/core/rng';
import { judgeShot } from '../src/core/rules';
import { angleCost, classifySuccess, clusteredReds, isExhibition, potCost, powerCost } from '../src/core/shotType';
import { chooseAutoColour, randomLayout, solveSuccess } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';
import type { Ball } from '../src/core/types';

const table = buildTable();
const r = table.ballRadius;
const now = () => 0;

/** Shoot from `balls` straight at `aim` and label the result (null if it is not a success at `target`). */
function label(balls: Ball[], aim: { x: number; y: number }, speed: number, target: 'red' | 'black', pocket: string | null = null) {
  const cue = balls.find((b) => b.kind === 'cue')!.pos;
  const sim = createSim(balls, table);
  strike(sim, 'cue', { x: aim.x - cue.x, y: aim.y - cue.y }, speed, 0);
  runUntilStill(sim);
  const first = sim.events.find((e) => e.type === 'ball');
  const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
  const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
  const state = { phase: target === 'red' ? 'red' : 'colour', redsLeft: 1, nextColour: null, balls, lastFailure: null, failedIn: null,
    score: 0, opponentScore: 0, blackAfterEveryRed: true } as const;
  const v = judgeShot(state, target, { firstHit, potted, after: [] });
  if (v.result !== 'success') return null;
  return classifySuccess({ state: balls, target, potted: v.potted, aimedPocket: pocket as never, events: sim.events, table });
}
/** The ghost-ball point to pot `ball` into the pocket mouth `m`. */
const ghost = (ball: { x: number; y: number }, m: { x: number; y: number }) => {
  const d = Math.hypot(m.x - ball.x, m.y - ball.y);
  return { x: ball.x - ((m.x - ball.x) / d) * 2 * r, y: ball.y - ((m.y - ball.y) / d) * 2 * r };
};

describe('task 4.7: shot labels', () => {
  const corner = table.pockets.find((p) => p.id === 'topRight')!.mouthMid;
  it('a short straight pot into a corner is a plain pot', () => {
    const red = { x: corner.x - 0.25, y: corner.y - 0.25 };
    const cue = { x: red.x - 0.3, y: red.y - 0.3 };
    const balls: Ball[] = [{ id: 'cue', kind: 'cue', pos: cue }, { id: 'red1', kind: 'red', pos: red }];
    expect(label(balls, ghost(red, corner), 2.0, 'red', 'topRight')).toBe('plain');
  });
  it('the cue ball hitting one red that pots another red is a plant', () => {
    // cue ball, red1 and red2 on one line to the pocket: the cue ball hits red1, red1 pots red2
    const red2 = { x: corner.x - 0.25, y: corner.y - 0.25 };
    const d = Math.hypot(corner.x - red2.x, corner.y - red2.y);
    const u = { x: (corner.x - red2.x) / d, y: (corner.y - red2.y) / d };
    const red1 = { x: red2.x - u.x * (2 * r + 0.1), y: red2.y - u.y * (2 * r + 0.1) };
    const cue = { x: red1.x - u.x * 0.4, y: red1.y - u.y * 0.4 };
    const balls: Ball[] = [{ id: 'cue', kind: 'cue', pos: cue }, { id: 'red1', kind: 'red', pos: red1 }, { id: 'red2', kind: 'red', pos: red2 }];
    expect(label(balls, red1, 3.0, 'red')).toBe('plant');
  });
  it('exhibition labels are the exhibition ones', () => {
    for (const t of ['cushionFirst', 'plant', 'double', 'kiss', 'farPocket', 'fluke'] as const) expect(isExhibition(t)).toBe(true);
    for (const t of ['plain', 'packCannon', 'cannon', 'long'] as const) expect(isExhibition(t)).toBe(false);
  });
});

describe('task 4.7: naturalness costs', () => {
  it('thinner cuts and longer distances cost more; medium power is free, full power is not', () => {
    const m = table.pockets.find((p) => p.id === 'topRight')!.mouthMid;
    const ball: Ball = { id: 'red1', kind: 'red', pos: { x: m.x - 0.3, y: m.y - 0.3 } };
    const straight = potCost({ x: ball.pos.x - 0.3, y: ball.pos.y - 0.3 }, ball, m, [ball], r);
    const thin = potCost({ x: ball.pos.x - 0.42, y: ball.pos.y + 0.1 }, ball, m, [ball], r);
    const far = potCost({ x: ball.pos.x - 1.2, y: ball.pos.y - 1.2 }, ball, m, [ball], r);
    expect(thin).toBeGreaterThan(straight);
    expect(far).toBeGreaterThan(straight);
    expect(powerCost(3)).toBe(0);
    expect(powerCost(6)).toBeGreaterThan(1);
  });
  it('a red out of the pack costs more while a loose red exists', () => {
    const tri = [[0, 0], [2 * r, 0], [r, Math.sqrt(3) * r]]; // three touching reds: each touches the other two
    const pack: Ball[] = tri.map(([x, y], i) => ({ id: `red${i}`, kind: 'red', pos: { x: x!, y: 0.8 + y! } }));
    const loose: Ball = { id: 'red9', kind: 'red', pos: { x: -0.4, y: 0 } };
    expect(clusteredReds([...pack, loose], r)).toEqual(new Set(['red0', 'red1', 'red2']));
    const m = table.pockets.find((p) => p.id === 'topRight')!.mouthMid;
    const cue = { x: 0.1, y: 0.4 };
    expect(potCost(cue, pack[2]!, m, [...pack, loose], r)).toBeGreaterThan(potCost(cue, pack[2]!, m, pack, r));
  });
  it('position: leaving an angle is better than dead straight or a thin cut', () => {
    expect(angleCost(20)).toBe(0);
    expect(angleCost(0)).toBeGreaterThan(0);
    expect(angleCost(60)).toBeGreaterThan(angleCost(0));
  });
});

describe('task 4.7: the solver prefers natural shots', () => {
  it('normal searches never return an exhibition shot; every shot carries its type', () => {
    const rng = mulberry32(77);
    let found = 0;
    for (let i = 0; i < 6; i++) {
      const L = randomLayout(rng, 6, i % 2 ? 'colour' : 'red', table);
      const s = solveSuccess(L, i % 2 ? 'black' : 'red', table, now);
      if (!s) continue;
      found++;
      expect(isExhibition(s.type)).toBe(false);
      expect(s.natural).toBeGreaterThanOrEqual(0);
    }
    expect(found).toBeGreaterThan(0);
  }, 120_000);
  it('RULES B.3: the automatic colour is black, pink or blue; black whenever black has a natural shot', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 4; i++) {
      const L = randomLayout(rng, 6, 'colour', table);
      const pick = chooseAutoColour(L, table, now);
      expect(['black', 'pink', 'blue']).toContain(pick.colour);
      if (pick.colour !== 'black') {
        const black = solveSuccess(L, 'black', table, now);
        expect(!!black && black.lookahead !== 'failed' && black.duration <= 2.2 && ['plain', 'packCannon'].includes(black.type)).toBe(false);
      }
    }
  }, 120_000);
});
