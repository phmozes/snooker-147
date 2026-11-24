// Deterministic 2D ball physics: rolling friction, straight cushions, rounded jaws, ball-ball collisions.
// Pure module, no rendering, no Math.random.
//
// How one fixed time step works:
//   1. Velocities are constant during the step. We look for the EARLIEST contact (ball-ball, ball-cushion,
//      ball-jaw) inside the step, move every ball exactly to that moment, bounce, and repeat.
//      Because we stop at the exact moment of contact, balls never overlap or pass through anything.
//   2. A ball whose centre is over the hole (capture circle) drops. The jaws keep going past the
//      narrowest gap, so a ball that comes in at a bad angle bounces between them (rattle) and may come out.
//   3. Friction lowers every speed a little. Friction can only slow a ball, never speed it up.

import { CONFIG } from '../../config/game.config';
import { arcContainsAngle, type JawArc, type PocketId, type Segment, type TableGeometry } from '../table/geometry';
import { dist, type Ball, type BallKind, type Vec2 } from '../types';

export interface PhysicsConfig {
  timestep: number;
  maxSimSeconds: number;
  gravity: number;
  rollingFriction: number;
  ballBallRestitution: number;
  cushionRestitution: number;
  jawRestitution: number;
  stopSpeed: number;
  maxEventsPerStep: number;
}

export interface SimBall {
  id: string;
  kind: BallKind;
  pos: Vec2;
  vel: Vec2;
  potted: PocketId | null;
}

export type SimEvent =
  | { t: number; type: 'ball'; a: string; b: string; speed: number }
  | { t: number; type: 'cushion'; a: string; speed: number }
  | { t: number; type: 'jaw'; a: string; pocket: PocketId; speed: number; contact: Vec2 } // contact = point on the jaw
  | { t: number; type: 'pot'; a: string; pocket: PocketId; fallback: boolean };

export interface Sim {
  table: TableGeometry;
  cfg: PhysicsConfig;
  balls: SimBall[];
  time: number;
  events: SimEvent[];
  /** Indices of balls that touched something during the last step (used by the "no free speed" check). */
  hitLastStep: Set<number>;
  /** Steps where the event limit was reached (should stay 0). */
  eventLimitHits: number;
}

interface Wall {
  seg: Segment;
  normal: Vec2; // unit, pointing into the table
  dir: Vec2; // unit, a -> b
  len: number;
}

const walls = new WeakMap<TableGeometry, Wall[]>();
function wallsOf(table: TableGeometry): Wall[] {
  let w = walls.get(table);
  if (!w) {
    w = table.cushions.map((seg) => {
      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const len = Math.hypot(dx, dy);
      const dir = { x: dx / len, y: dy / len };
      let normal = { x: -dir.y, y: dir.x };
      // flip so the normal points toward the table centre
      if (normal.x * -seg.a.x + normal.y * -seg.a.y < 0) normal = { x: -normal.x, y: -normal.y };
      return { seg, normal, dir, len };
    });
    walls.set(table, w);
  }
  return w;
}

export function createSim(balls: Ball[], table: TableGeometry, cfg: PhysicsConfig = CONFIG.physics): Sim {
  return {
    table, cfg, time: 0, events: [], hitLastStep: new Set(), eventLimitHits: 0,
    balls: balls.map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos }, vel: { x: 0, y: 0 }, potted: null })),
  };
}

/** Hit a ball: direction (any length) and speed in m/s. */
export function strike(sim: Sim, ballId: string, direction: Vec2, speed: number): void {
  const b = sim.balls.find((x) => x.id === ballId);
  if (!b || b.potted) throw new Error(`ball ${ballId} is not on the table`);
  const l = Math.hypot(direction.x, direction.y);
  if (!(l > 0) || !(speed >= 0)) throw new Error('bad strike');
  b.vel = { x: (direction.x / l) * speed, y: (direction.y / l) * speed };
}

const speedOf = (b: SimBall) => Math.hypot(b.vel.x, b.vel.y);
const isMovingBall = (b: SimBall) => !b.potted && (b.vel.x !== 0 || b.vel.y !== 0);
export const isMoving = (sim: Sim) => sim.balls.some(isMovingBall);

const APPROACH_EPS = 1e-12;

/** Earliest time t >= 0 at which |d + v t| = R while closing. Infinity if never. */
function timeToCircleContact(dx: number, dy: number, vx: number, vy: number, R: number): number {
  const b = dx * vx + dy * vy; // half of the quadratic's b
  if (b >= -APPROACH_EPS) return Infinity; // not closing
  const c = dx * dx + dy * dy - R * R;
  if (c <= 0) return 0; // touching (or a hair inside because of rounding): bounce now
  const a = vx * vx + vy * vy;
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  return Math.max(0, (-b - Math.sqrt(disc)) / a);
}

type Hit =
  | { t: number; kind: 'ball'; i: number; j: number }
  | { t: number; kind: 'wall'; i: number; wall: Wall }
  | { t: number; kind: 'jaw'; i: number; jaw: JawArc };

function earliestHit(sim: Sim, horizon: number): Hit | null {
  const { balls } = sim;
  const r = sim.table.ballRadius;
  let best: Hit | null = null;
  for (let i = 0; i < balls.length; i++) {
    const bi = balls[i]!;
    if (bi.potted) continue;
    const mi = bi.vel.x !== 0 || bi.vel.y !== 0;
    // ball-ball (only pairs where at least one is moving)
    for (let j = i + 1; j < balls.length; j++) {
      const bj = balls[j]!;
      if (bj.potted || (!mi && bj.vel.x === 0 && bj.vel.y === 0)) continue;
      const t = timeToCircleContact(bj.pos.x - bi.pos.x, bj.pos.y - bi.pos.y,
        bj.vel.x - bi.vel.x, bj.vel.y - bi.vel.y, 2 * r);
      if (t <= horizon && (!best || t < best.t)) best = { t, kind: 'ball', i, j };
    }
    if (!mi) continue;
    // straight cushions
    for (const w of wallsOf(sim.table)) {
      const vn = bi.vel.x * w.normal.x + bi.vel.y * w.normal.y;
      if (vn >= -APPROACH_EPS) continue;
      const gap = (bi.pos.x - w.seg.a.x) * w.normal.x + (bi.pos.y - w.seg.a.y) * w.normal.y - r;
      const t = Math.max(0, gap / -vn);
      if (t > horizon || (best && t >= best.t)) continue;
      const cx = bi.pos.x + bi.vel.x * t - w.seg.a.x;
      const cy = bi.pos.y + bi.vel.y * t - w.seg.a.y;
      const u = cx * w.dir.x + cy * w.dir.y;
      if (u < 0 || u > w.len) continue; // past the end: the jaw arc takes over there
      best = { t, kind: 'wall', i, wall: w };
    }
    // rounded jaws (ball bounces off the outside of the arc)
    for (const jaw of sim.table.jaws) {
      const dx = bi.pos.x - jaw.centre.x;
      const dy = bi.pos.y - jaw.centre.y;
      const t = timeToCircleContact(dx, dy, bi.vel.x, bi.vel.y, jaw.radius + r);
      if (t > horizon || (best && t >= best.t)) continue;
      const ang = Math.atan2(dy + bi.vel.y * t, dx + bi.vel.x * t);
      if (!arcContainsAngle(jaw, ang)) continue;
      best = { t, kind: 'jaw', i, jaw };
    }
  }
  return best;
}

function advance(sim: Sim, t: number) {
  if (t <= 0) return;
  for (const b of sim.balls) {
    if (b.potted) continue;
    b.pos.x += b.vel.x * t;
    b.pos.y += b.vel.y * t;
  }
}

/** Bounce off a fixed surface with unit normal n (pointing toward the ball). */
function bounceOff(b: SimBall, nx: number, ny: number, e: number): number {
  const vn = b.vel.x * nx + b.vel.y * ny;
  b.vel.x -= (1 + e) * vn * nx;
  b.vel.y -= (1 + e) * vn * ny;
  return -vn;
}

function resolve(sim: Sim, hit: Hit, at: number) {
  const b = sim.balls[hit.i]!;
  sim.hitLastStep.add(hit.i);
  if (hit.kind === 'ball') {
    const o = sim.balls[hit.j]!;
    sim.hitLastStep.add(hit.j);
    const d = Math.hypot(o.pos.x - b.pos.x, o.pos.y - b.pos.y);
    const nx = (o.pos.x - b.pos.x) / d;
    const ny = (o.pos.y - b.pos.y) / d;
    const closing = (b.vel.x - o.vel.x) * nx + (b.vel.y - o.vel.y) * ny; // > 0
    const k = ((1 + sim.cfg.ballBallRestitution) / 2) * closing; // equal masses
    b.vel.x -= k * nx; b.vel.y -= k * ny;
    o.vel.x += k * nx; o.vel.y += k * ny;
    sim.events.push({ t: at, type: 'ball', a: b.id, b: o.id, speed: closing });
  } else if (hit.kind === 'wall') {
    const speed = bounceOff(b, hit.wall.normal.x, hit.wall.normal.y, sim.cfg.cushionRestitution);
    sim.events.push({ t: at, type: 'cushion', a: b.id, speed });
  } else {
    const d = dist(b.pos, hit.jaw.centre);
    const speed = bounceOff(b, (b.pos.x - hit.jaw.centre.x) / d, (b.pos.y - hit.jaw.centre.y) / d, sim.cfg.jawRestitution);
    const k = hit.jaw.radius / d;
    const contact = { x: hit.jaw.centre.x + (b.pos.x - hit.jaw.centre.x) * k, y: hit.jaw.centre.y + (b.pos.y - hit.jaw.centre.y) * k };
    sim.events.push({ t: at, type: 'jaw', a: b.id, pocket: hit.jaw.pocket, speed, contact });
  }
}

/**
 * Pockets. A ball drops when its centre is over the hole (capture circle). Safety net (`fallback`):
 * a ball that is deeper in the pocket than the far edge of the hole, or far outside the table, also
 * drops. The tests check that the safety net is never needed.
 */
function checkPots(sim: Sim) {
  const { halfWidth: hw, halfLength: hl } = sim.table;
  for (const b of sim.balls) {
    if (b.potted) continue;
    for (const p of sim.table.pockets) {
      const depth = (b.pos.x - p.mouthMid.x) * p.inward.x + (b.pos.y - p.mouthMid.y) * p.inward.y;
      const inHole = dist(b.pos, p.captureCentre) < p.captureRadius;
      const tooDeep = depth > dist(p.mouthMid, p.captureCentre) + p.captureRadius && dist(b.pos, p.mouthMid) < 0.3;
      if (inHole || tooDeep) { pot(sim, b, p.id, !inHole); break; }
    }
    if (!b.potted && (Math.abs(b.pos.x) > hw + 0.3 || Math.abs(b.pos.y) > hl + 0.3)) {
      const near = sim.table.pockets.reduce((a, p) => (dist(b.pos, p.mouthMid) < dist(b.pos, a.mouthMid) ? p : a));
      pot(sim, b, near.id, true);
    }
  }
}
function pot(sim: Sim, b: SimBall, pocket: PocketId, fallback: boolean) {
  b.potted = pocket;
  b.vel = { x: 0, y: 0 };
  sim.events.push({ t: sim.time, type: 'pot', a: b.id, pocket, fallback });
}

function applyFriction(sim: Sim) {
  const dv = sim.cfg.rollingFriction * sim.cfg.gravity * sim.cfg.timestep;
  for (const b of sim.balls) {
    if (!isMovingBall(b)) continue;
    const s = speedOf(b);
    const next = s - dv;
    if (next <= sim.cfg.stopSpeed) b.vel = { x: 0, y: 0 };
    else { b.vel.x *= next / s; b.vel.y *= next / s; }
  }
}

/** Advance the simulation by one fixed time step. */
export function stepSim(sim: Sim): void {
  const dt = sim.cfg.timestep;
  sim.hitLastStep = new Set();
  let remaining = dt;
  let events = 0;
  for (;;) {
    const hit = events < sim.cfg.maxEventsPerStep ? earliestHit(sim, remaining) : null;
    if (!hit) {
      if (events >= sim.cfg.maxEventsPerStep) sim.eventLimitHits++;
      advance(sim, remaining);
      break;
    }
    advance(sim, hit.t);
    remaining -= hit.t;
    resolve(sim, hit, sim.time + (dt - remaining));
    events++;
  }
  sim.time += dt;
  checkPots(sim);
  applyFriction(sim);
}

/** Step until every ball has stopped, or the safety limit. Returns the time it took (seconds). */
export function runUntilStill(sim: Sim, onStep?: (sim: Sim) => void): number {
  const start = sim.time;
  const maxSteps = Math.ceil(sim.cfg.maxSimSeconds / sim.cfg.timestep);
  for (let n = 0; n < maxSteps && isMoving(sim); n++) {
    stepSim(sim);
    onStep?.(sim);
  }
  return sim.time - start;
}

export interface SimCheck {
  overlaps: number; // pairs of balls closer than one ball diameter
  insideCushion: number; // balls pushed into a cushion or jaw
  minGap: number; // smallest gap between two balls (m)
}

/** Safety checks used by the tests and shown on the debug page. Tolerance: a micrometre. */
export function checkSim(sim: Sim, tol = 1e-6): SimCheck {
  const r = sim.table.ballRadius;
  const on = sim.balls.filter((b) => !b.potted);
  let overlaps = 0;
  let insideCushion = 0;
  let minGap = Infinity;
  for (let i = 0; i < on.length; i++) {
    for (let j = i + 1; j < on.length; j++) {
      const gap = dist(on[i]!.pos, on[j]!.pos) - 2 * r;
      minGap = Math.min(minGap, gap);
      if (gap < -tol) overlaps++;
    }
    const b = on[i]!;
    for (const w of wallsOf(sim.table)) {
      const u = (b.pos.x - w.seg.a.x) * w.dir.x + (b.pos.y - w.seg.a.y) * w.dir.y;
      const d = (b.pos.x - w.seg.a.x) * w.normal.x + (b.pos.y - w.seg.a.y) * w.normal.y;
      if (u >= 0 && u <= w.len && d < r - tol) insideCushion++;
    }
    for (const jaw of sim.table.jaws) {
      const ang = Math.atan2(b.pos.y - jaw.centre.y, b.pos.x - jaw.centre.x);
      if (arcContainsAngle(jaw, ang) && dist(b.pos, jaw.centre) < jaw.radius + r - tol) insideCushion++;
    }
  }
  return { overlaps, insideCushion, minGap };
}

// ---------------- recording (for playback, replays and the pocket camera later) ----------------

export interface Recording {
  frameDt: number; // seconds between frames
  ids: string[];
  /** frames[f][2*i], frames[f][2*i+1] = x, y of ball i; NaN once the ball is potted */
  frames: number[][];
  events: SimEvent[];
  duration: number;
}

const snapshot = (sim: Sim) => sim.balls.flatMap((b) => (b.potted ? [NaN, NaN] : [b.pos.x, b.pos.y]));

/** Run a shot to the end and keep a frame every `stepsPerFrame` physics steps (8 -> 60 frames per second). */
export function recordShot(sim: Sim, stepsPerFrame = 8): Recording {
  const frames = [snapshot(sim)];
  const firstEvent = sim.events.length;
  let n = 0;
  const duration = runUntilStill(sim, (s) => { if (++n % stepsPerFrame === 0 || !isMoving(s)) frames.push(snapshot(s)); });
  return {
    frameDt: stepsPerFrame * sim.cfg.timestep, ids: sim.balls.map((b) => b.id), frames,
    events: sim.events.slice(firstEvent), duration,
  };
}
