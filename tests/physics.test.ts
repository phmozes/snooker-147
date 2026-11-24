import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { ballEnergy, checkSim, createSim, isMoving, naturalRollSpin, runUntilStill, stepSim, strike, type Sim } from '../src/core/physics/sim';
import { breakAim } from '../src/core/physics/testShots';
import { mulberry32 } from '../src/core/rng';
import { buildTable } from '../src/core/table/geometry';
import { rackBalls } from '../src/core/table/rack';
import { vec, type Ball } from '../src/core/types';

const table = buildTable();
const r = table.ballRadius;
const P = CONFIG.physics;
const decel = P.rollingFriction * P.gravity;
const one = (id: string, x: number, y: number): Ball => ({ id, kind: id === 'cue' ? 'cue' : 'red', pos: vec(x, y) });
const ball = (sim: Sim, id: string) => sim.balls.find((b) => b.id === id)!;
const speed = (sim: Sim, id: string) => Math.hypot(ball(sim, id).vel.x, ball(sim, id).vel.y);
const totalEnergy = (sim: Sim) => sim.balls.reduce((e, b) => e + ballEnergy(b), 0);

/**
 * Run a shot to the end, checking the owner's rules after EVERY time step.
 * freeEnergy: a ball's energy (moving + spinning) grew without it touching anything. (With spin a ball may
 * gain SPEED after a hit - follow - but never energy.) energyGain: the whole table's energy grew.
 */
function runChecked(sim: Sim) {
  const problems = { overlaps: 0, insideCushion: 0, freeEnergy: 0, energyGain: 0 };
  let before = sim.balls.map(ballEnergy);
  let energy = totalEnergy(sim);
  const time = runUntilStill(sim, (s) => {
    const c = checkSim(s);
    problems.overlaps += c.overlaps;
    problems.insideCushion += c.insideCushion;
    s.balls.forEach((b, i) => {
      if (ballEnergy(b) > before[i]! * (1 + 1e-12) + 1e-15 && !s.hitLastStep.has(i)) problems.freeEnergy++;
    });
    const e = totalEnergy(s);
    if (e > energy * (1 + 1e-12) + 1e-15) problems.energyGain++;
    energy = e;
    before = s.balls.map(ballEnergy);
  });
  return { problems, time };
}
const NO_PROBLEMS = { overlaps: 0, insideCushion: 0, freeEnergy: 0, energyGain: 0 };

describe('single ball', () => {
  it('rolls in a straight line, only slows down, and stops where friction says', () => {
    const sim = createSim([one('cue', 0, -1)], table);
    const v0 = 1.5;
    strike(sim, 'cue', vec(0, 1), v0, naturalRollSpin()); // rolling from the start: no sliding
    let last = v0;
    while (isMoving(sim)) {
      stepSim(sim);
      const v = speed(sim, 'cue');
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
    const cue = ball(sim, 'cue');
    expect(cue.pos.x).toBe(0);
    expect(cue.pos.y + 1).toBeCloseTo((v0 * v0) / (2 * decel), 2); // distance = v^2 / 2a
    expect(sim.time).toBeCloseTo(v0 / decel, 1); // time = v / a
  });

  it('bounces off a straight cushion, losing speed by the cushion restitution', () => {
    const sim = createSim([one('cue', 0.5, 0.3)], table);
    strike(sim, 'cue', vec(1, 0), 2);
    let vBefore = 0;
    while (!sim.events.some((e) => e.type === 'cushion')) { vBefore = speed(sim, 'cue'); stepSim(sim); }
    const cue = ball(sim, 'cue');
    expect(cue.vel.x).toBeLessThan(0);
    expect(-cue.vel.x).toBeCloseTo(vBefore * P.cushionRestitution, 1);
    expect(cue.pos.x).toBeLessThanOrEqual(table.halfWidth - r + 1e-9);
  });

  it('bounces off a rounded middle-pocket jaw instead of passing through it', () => {
    const jaw = table.jaws.find((j) => j.pocket === 'middleRight' && j.centre.y > 0)!;
    // start on the cloth, a little below the jaw centre, and roll straight at the jaw circle
    const start = vec(table.halfWidth - 0.2, jaw.centre.y - 0.06);
    const sim = createSim([one('cue', start.x, start.y)], table);
    strike(sim, 'cue', vec(jaw.centre.x - start.x, jaw.centre.y - start.y), 2);
    const { problems } = runChecked(sim);
    expect(sim.events[0]?.type).toBe('jaw');
    expect(ball(sim, 'cue').potted).toBe(null);
    expect(ball(sim, 'cue').pos.x).toBeLessThan(start.x); // came back toward the table
    expect(problems.insideCushion).toBe(0);
  });
});

describe('two balls', () => {
  it('straight hit: the cue ball almost stops and the object ball takes the speed', () => {
    const sim = createSim([one('cue', 0, -0.5), one('red1', 0, 0)], table);
    strike(sim, 'cue', vec(0, 1), 2, naturalRollSpin());
    while (!sim.events.some((e) => e.type === 'ball')) stepSim(sim);
    const e = P.ballBallRestitution;
    const closing = (sim.events.find((x) => x.type === 'ball') as { speed: number }).speed;
    // right after the hit both balls slide for one step: the red (no spin) is slowed by sliding friction,
    // the cue ball (still spinning forward) is pulled forward by it
    const dv = P.slidingFriction * P.gravity * P.timestep;
    expect(speed(sim, 'red1')).toBeCloseTo(((1 + e) / 2) * closing - dv, 9);
    expect(speed(sim, 'cue')).toBeCloseTo(((1 - e) / 2) * closing + dv, 9);
    expect(checkSim(sim).overlaps).toBe(0);
  });

  it('half-ball hit: the two balls leave at a right angle (equal masses)', () => {
    const sim = createSim([one('cue', 0, -0.5), one('red1', r, 0)], table);
    strike(sim, 'cue', vec(0, 1), 2);
    while (!sim.events.some((e) => e.type === 'ball')) stepSim(sim);
    const a = ball(sim, 'cue').vel;
    const b = ball(sim, 'red1').vel;
    const cos = (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
    expect(Math.acos(cos) * (180 / Math.PI)).toBeGreaterThan(80); // 90 for perfectly elastic, a bit less with e < 1
  });
});

describe('full rack', () => {
  it.each(CONFIG.levels.map((l) => [l.reds] as const))('full-power break with %i reds: no overlap, nothing through a cushion, settles in time', (reds) => {
    const balls = rackBalls(reds, table);
    const sim = createSim(balls, table);
    strike(sim, 'cue', breakAim(table, balls), P.maxCueSpeed);
    const { problems, time } = runChecked(sim);
    expect(problems).toEqual(NO_PROBLEMS);
    expect(isMoving(sim)).toBe(false); // stopped before the safety limit
    expect(time).toBeLessThan(P.maxSimSeconds);
    expect(sim.eventLimitHits).toBe(0);
    // the pack really was broken: a good share of the reds moved (scan: 40-50% at this aim)
    const moved = sim.balls.filter((b, i) => b.kind === 'red' && (b.potted || Math.hypot(b.pos.x - balls[i]!.pos.x, b.pos.y - balls[i]!.pos.y) > 0.05));
    expect(moved.length).toBeGreaterThanOrEqual(reds / 4);
  });

  it('100 random shots with random spin (seeded): no overlap, no free energy, energy never grows', () => {
    const rand = mulberry32(147);
    const totals = { ...NO_PROBLEMS };
    let maxTime = 0;
    for (let n = 0; n < 100; n++) {
      const reds = CONFIG.levels[n % 3]!.reds;
      const sim = createSim(rackBalls(reds, table), table);
      const ang = rand() * 2 * Math.PI;
      strike(sim, 'cue', vec(Math.cos(ang), Math.sin(ang)), (0.2 + 0.8 * rand()) * P.maxCueSpeed, 2 * rand() - 1);
      const { problems, time } = runChecked(sim);
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += problems[k];
      maxTime = Math.max(maxTime, time);
      expect(sim.eventLimitHits).toBe(0);
    }
    expect(totals).toEqual(NO_PROBLEMS);
    expect(maxTime).toBeLessThan(P.maxSimSeconds);
  });

  it('same input = same output (bit for bit)', () => {
    const run = () => {
      const balls = rackBalls(15, table);
      const sim = createSim(balls, table);
      strike(sim, 'cue', breakAim(table, balls), P.maxCueSpeed);
      runUntilStill(sim);
      return { balls: sim.balls, events: sim.events, time: sim.time };
    };
    expect(run()).toEqual(run());
  });
});
