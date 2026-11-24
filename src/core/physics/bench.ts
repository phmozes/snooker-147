// Task 1.4: speed benchmark and pace study. Pure module (no rendering); the clock is passed in.
//
// Speed benchmark: full racks, the cue ball hit from a random place at a random red with random power and spin,
//   run until every ball stops. Result: milliseconds of computer time per simulated shot.
// Pace study: one red, one cue ball, one pocket. For each layout we try every power and spin the solver will try
//   and keep the QUICKEST shot that pots the red and keeps the cue ball on the table. This shows how short shots
//   can be at a given cloth friction when the solver is allowed to choose quick shots.

import { CONFIG } from '../../config/game.config';
import { mulberry32, type Rng } from '../rng';
import type { TableGeometry } from '../table/geometry';
import { rackBalls } from '../table/rack';
import { dist, type Ball, type Vec2 } from '../types';
import { createSim, isMoving, runUntilStill, stepSim, strike, type PhysicsConfig } from './sim';

const B = CONFIG.dev.bench;

/** A free spot on the cloth for a ball (not touching other balls, away from the cushions). */
function freeSpot(rng: Rng, table: TableGeometry, others: Vec2[], margin: number): Vec2 {
  const r = table.ballRadius;
  for (;;) {
    const p = { x: (rng() * 2 - 1) * (table.halfWidth - margin), y: (rng() * 2 - 1) * (table.halfLength - margin) };
    if (others.every((o) => dist(o, p) > 2 * r + 0.002)) return p;
  }
}

export interface SpeedResult {
  shots: number;
  msPerShot: number;
  simSecondsPerShot: number; // average length of a shot in game time
  stepsPerShot: number;
}

/** Run `shots` random full-rack shots. `now()` returns milliseconds (performance.now in the browser and in tests). */
export function speedBenchmark(table: TableGeometry, cfg: PhysicsConfig, now: () => number,
  reds: number = B.reds, shots: number = B.shots, seed: number = B.seed): SpeedResult {
  const rng = mulberry32(seed);
  const rack = rackBalls(reds, table);
  // build every layout first so only the physics is timed
  const layouts = Array.from({ length: shots }, () => {
    const balls: Ball[] = rack.map((b) => ({ ...b, pos: { ...b.pos } }));
    const cue = balls.find((b) => b.kind === 'cue')!;
    cue.pos = freeSpot(rng, table, balls.filter((b) => b !== cue).map((b) => b.pos), 2 * table.ballRadius);
    const reds = balls.filter((b) => b.kind === 'red');
    const target = reds[Math.floor(rng() * reds.length)]!;
    return { balls, dir: { x: target.pos.x - cue.pos.x, y: target.pos.y - cue.pos.y },
      speed: B.minSpeed + rng() * (B.maxSpeed - B.minSpeed), spin: rng() * 1.6 - 0.8 };
  });
  let simSeconds = 0;
  let steps = 0;
  const t0 = now();
  for (const l of layouts) {
    const sim = createSim(l.balls, table, cfg);
    strike(sim, 'cue', l.dir, l.speed, l.spin);
    const t = runUntilStill(sim);
    simSeconds += t;
    steps += Math.round(t / cfg.timestep);
  }
  const ms = now() - t0;
  return { shots, msPerShot: ms / shots, simSecondsPerShot: simSeconds / shots, stepsPerShot: steps / shots };
}

export interface PaceResult {
  rollingFriction: number;
  layouts: number;
  potted: number; // layouts where at least one tried shot pots the red
  medianSettle: number; // seconds until every ball stopped, quickest shot per layout (median over layouts)
  medianPot: number; // seconds until the red dropped, in that same quickest shot
  withinMax: number; // share of potted layouts whose quickest shot settles within shot.maxDuration
  msTotal: number; // computer time for the whole study at this friction
}

interface PaceLayout { cue: Vec2; red: Vec2; aim: Vec2 }

/** Random cue ball + red layouts, each with the pocket that gives the smallest cut, aimed at the ghost ball. */
export function paceLayouts(table: TableGeometry, n: number = B.paceLayouts, seed: number = B.seed): PaceLayout[] {
  const rng = mulberry32(seed + 1);
  const out: PaceLayout[] = [];
  const r = table.ballRadius;
  while (out.length < n) {
    const red = freeSpot(rng, table, [], 4 * r);
    const cue = freeSpot(rng, table, [red], 4 * r);
    let best: { cut: number; ghost: Vec2 } | null = null;
    for (const p of table.pockets) {
      const toP = { x: p.mouthMid.x - red.x, y: p.mouthMid.y - red.y };
      const l = Math.hypot(toP.x, toP.y);
      const ghost = { x: red.x - (toP.x / l) * 2 * r, y: red.y - (toP.y / l) * 2 * r };
      const aim = { x: ghost.x - cue.x, y: ghost.y - cue.y };
      const cut = Math.acos((aim.x * toP.x + aim.y * toP.y) / (Math.hypot(aim.x, aim.y) * l));
      if (!best || cut < best.cut) best = { cut, ghost };
    }
    if ((best!.cut * 180) / Math.PI > B.paceMaxCutDeg) continue;
    out.push({ cue, red, aim: { x: best!.ghost.x - cue.x, y: best!.ghost.y - cue.y } });
  }
  return out;
}

/** Quickest potting shot per layout at this friction. Powers and spins come from the solver settings. */
export function paceStudy(table: TableGeometry, cfg: PhysicsConfig, now: () => number,
  layouts: PaceLayout[] = paceLayouts(table)): PaceResult {
  const t0 = now();
  const settles: number[] = [];
  const pots: number[] = [];
  const maxSteps = Math.ceil(cfg.maxSimSeconds / cfg.timestep);
  for (const l of layouts) {
    let best: { settle: number; pot: number } | null = null;
    for (let v = B.paceMinSpeed; v <= CONFIG.physics.maxCueSpeed + 1e-9; v += B.paceSpeedStep) {
      for (const spin of CONFIG.solver.spinSamples) {
        const sim = createSim([{ id: 'cue', kind: 'cue', pos: l.cue }, { id: 'red1', kind: 'red', pos: l.red }], table, cfg);
        strike(sim, 'cue', l.aim, v, spin);
        // stop early once this shot is already slower than the best one found
        const limit = best ? Math.min(maxSteps, Math.floor(best.settle / cfg.timestep)) : maxSteps;
        for (let s = 0; s < limit && isMoving(sim); s++) stepSim(sim);
        if (isMoving(sim)) continue;
        const [cue, red] = sim.balls;
        if (cue!.potted || !red!.potted) continue;
        const pot = sim.events.find((e) => e.type === 'pot' && e.a === 'red1')!.t;
        if (!best || sim.time < best.settle) best = { settle: sim.time, pot };
      }
    }
    if (best) { settles.push(best.settle); pots.push(best.pot); }
  }
  const median = (a: number[]) => {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y);
    return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
  };
  return {
    rollingFriction: cfg.rollingFriction, layouts: layouts.length, potted: settles.length,
    medianSettle: median(settles), medianPot: median(pots),
    withinMax: settles.length ? settles.filter((s) => s <= CONFIG.shot.maxDuration).length / settles.length : 0,
    msTotal: now() - t0,
  };
}

/** Physics settings with a different rolling friction (everything else unchanged). */
export const withFriction = (rollingFriction: number, cfg: PhysicsConfig = CONFIG.physics): PhysicsConfig =>
  ({ ...cfg, rollingFriction });
