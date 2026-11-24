import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { ballEnergy, createSim, isMoving, naturalRollSpin, runUntilStill, stepSim, strike, type Sim } from '../src/core/physics/sim';
import { buildTable } from '../src/core/table/geometry';

const table = buildTable();
const P = CONFIG.physics;
const speed = (b: Sim['balls'][number]) => Math.hypot(b.vel.x, b.vel.y);
const rolling = (b: Sim['balls'][number]) => b.vel.x === b.roll.x && b.vel.y === b.roll.y;

/** Cue ball straight at a red `gap` metres away. Returns how far the cue ball travels after the hit (+ forward,
 *  - back), measured until it stops or touches something else. */
function straightShot(gap: number, v: number, spin: number): number {
  const sim = createSim([{ id: 'cue', kind: 'cue', pos: { x: 0, y: -1 } }, { id: 'red1', kind: 'red', pos: { x: 0, y: -1 + gap } }], table);
  strike(sim, 'cue', { x: 0, y: 1 }, v, spin);
  const cue = sim.balls[0]!;
  let contactY: number | null = null;
  while (isMoving(sim)) {
    stepSim(sim);
    const cueEvents = sim.events.filter((e) => e.a === 'cue' || (e.type === 'ball' && e.b === 'cue'));
    const hit = cueEvents.find((e) => e.type === 'ball');
    if (hit && contactY === null) contactY = hit.type === 'ball' ? hit.at.y : cue.pos.y;
    if (contactY !== null && (cueEvents.length > 1 || cue.potted || !isMoving({ ...sim, balls: [cue] }))) break;
  }
  return cue.pos.y - contactY!;
}

describe('spin: sliding and rolling', () => {
  it('a centre-ball hit slides first, then rolls at 5/7 of the speed (solid ball)', () => {
    const sim = createSim([{ id: 'cue', kind: 'cue', pos: { x: 0, y: -1 } }], table);
    strike(sim, 'cue', { x: 0, y: 1 }, 2, 0);
    const cue = sim.balls[0]!;
    expect(rolling(cue)).toBe(false);
    let steps = 0;
    while (!rolling(cue)) { stepSim(sim); steps++; }
    // exact physics: rolling speed = 5/7 v0, reached after 2 v0 / (7 mu g) seconds; one rolling-friction step allowed
    expect(speed(cue)).toBeCloseTo((5 / 7) * 2, 2);
    expect(steps * P.timestep).toBeCloseTo((2 * 2) / (7 * P.slidingFriction * P.gravity), 2);
  });

  it('natural-roll spin rolls from the very first step (no sliding)', () => {
    const sim = createSim([{ id: 'cue', kind: 'cue', pos: { x: 0, y: -1 } }], table);
    strike(sim, 'cue', { x: 0, y: 1 }, 2, naturalRollSpin());
    stepSim(sim);
    expect(rolling(sim.balls[0]!)).toBe(true);
  });

  it('full follow makes the ball speed up a little after the strike, but its energy only goes down', () => {
    const sim = createSim([{ id: 'cue', kind: 'cue', pos: { x: 0, y: -1 } }], table);
    strike(sim, 'cue', { x: 0, y: 1 }, 2, 1);
    const cue = sim.balls[0]!;
    let maxSpeed = 2;
    let e = ballEnergy(cue);
    while (!rolling(cue)) {
      stepSim(sim);
      maxSpeed = Math.max(maxSpeed, speed(cue));
      expect(ballEnergy(cue)).toBeLessThanOrEqual(e);
      e = ballEnergy(cue);
    }
    const u = 2.5 * P.maxTipOffset * 2; // spin at the strike, as rolling velocity
    expect(maxSpeed).toBeGreaterThan(2);
    expect(maxSpeed).toBeCloseTo(2 + (2 / 7) * (u - 2), 2);
  });

  it('strike refuses spin outside -1..+1', () => {
    const sim = createSim([{ id: 'cue', kind: 'cue', pos: { x: 0, y: -1 } }], table);
    expect(() => strike(sim, 'cue', { x: 0, y: 1 }, 2, 1.5)).toThrow();
  });
});

describe('spin: straight shot at a red', () => {
  it('3 m/s from 30 cm: screw comes back, stun stops dead, follow runs through', () => {
    expect(straightShot(0.3, 3, -1)).toBeLessThan(-0.3);
    expect(Math.abs(straightShot(0.3, 3, 0))).toBeLessThan(0.05);
    expect(straightShot(0.3, 3, 1)).toBeGreaterThan(0.4);
  });

  it('more spin = more effect (screw < half screw < stun < half follow < follow)', () => {
    const d = [-1, -0.5, 0, 0.5, 1].map((s) => straightShot(0.3, 3, s));
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1]!);
  });

  it('spin wears off over distance: a stun from 1 m has started rolling and follows through', () => {
    expect(straightShot(1.0, 3, 0)).toBeGreaterThan(0.1);
    expect(straightShot(1.0, 3, -1)).toBeGreaterThan(straightShot(0.3, 3, -1)); // less screw-back from further away
  });

  it('a soft screw barely comes back (screw needs power)', () => {
    expect(straightShot(0.3, 1.5, -1)).toBeGreaterThan(-0.1);
  });

  it('same shot with spin = same result, bit for bit', () => {
    const run = () => {
      const sim = createSim([{ id: 'cue', kind: 'cue', pos: { x: 0.1, y: -1 } }, { id: 'red1', kind: 'red', pos: { x: 0, y: -0.5 } }], table);
      strike(sim, 'cue', { x: -0.1, y: 0.5 }, 4, -0.7);
      runUntilStill(sim);
      return sim.balls;
    };
    expect(run()).toEqual(run());
  });
});
