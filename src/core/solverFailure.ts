// Shot solver, failure shots (task 4.2), split out of solver.ts (night 2026-11-24, file size). solver.ts re-exports
// everything here, so callers keep importing from './solver'.

import { CONFIG } from '../config/game.config';
import { createSim, isMoving, runUntilStill, stepSim, strike, type PhysicsConfig } from './physics/sim';
import { judgeShot, type FrameState } from './rules';
import type { PocketId, TableGeometry } from './table/geometry';
import { cutAngle, potCost } from './shotType';
import type { Ball, BallKind, Vec2 } from './types';
import { pathClear, type SolvedShot } from './solver';

const Sv = CONFIG.solver;

// ---------------- failure shots (task 4.2) ----------------
// A failure must look like a real attempt at the pot: the cue ball is always aimed along the ghost-ball line at the
// target ball for one pocket, with only a small aim error at the pocket (a few cm), using the same powers and spins as
// potting shots. For a miss or a rattle the target ball must actually travel to the pocket (within
// failure.mustReach of the mouth). Wrong ball first: the attempt is aimed at the target, another ball is in the way.
// Search order: easiest (ball, pocket) pairs first, medium powers first; the first shot that is not too long is taken.
// RULES D.2 when the chosen type is not found: plain miss, then a soft shot into a wrong ball (FOUL), then a gentle
// tap that hits nothing (FOUL). The tap can always be played, so a failure shot always exists.

export type FailureKind = 'plainMiss' | 'jawRattle' | 'inOff' | 'wrongBallFirst';
/** null = the chosen type was found; otherwise which RULES D.2 fallback was used. */
export type FailureFallback = null | 'plainMiss' | 'softFoul' | 'tap';
export interface SolvedFailure extends SolvedShot {
  kind: FailureKind; fallback: FailureFallback;
  inOffDist?: number; // in-off only: m from the cue ball's pocket to the shot's path (inOffPocketDistance)
}

const FAIL = CONFIG.solver.failure;

/** Powers from the middle outwards (a medium-paced attempt looks most natural and usually reaches the pocket). */
function middleOutPowers(): number[] {
  const p = Array.from({ length: Sv.powerSamples }, (_, i) =>
    Sv.minSpeed * (CONFIG.physics.maxCueSpeed / Sv.minSpeed) ** (i / (Sv.powerSamples - 1)));
  const mid = (p.length - 1) / 2;
  return p.map((v, i) => ({ v, d: Math.abs(i - mid) })).sort((a, b) => a.d - b.d).map((x) => x.v);
}

function firstHitOf(sim: ReturnType<typeof createSim>): string | null {
  const first = sim.events.find((e) => e.type === 'ball');
  return first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
}

/** Distance (m) from point q to the segment a-b. */
function segDist(q: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  const t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L2));
  return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
}

/** In-off: how far (m) the cue ball's pocket is from the shot's path (cue ball -> object ball -> aimed pocket). 0 = on it. */
export function inOffPocketDistance(cueStart: Vec2, ball: Vec2, aimed: Vec2, cuePocket: Vec2): number {
  return Math.min(segDist(cuePocket, cueStart, ball), segDist(cuePocket, ball, aimed));
}

/** The chosen failure type only (no fallback). `extraBudget`: shots it may spend on a second pass of less natural pots
 *  when the first pass found the type but only too long (or, for an in-off, only far-pocket) shots (natural switch on). */
function searchFailure(state: FrameState, target: BallKind, kind: FailureKind, table: TableGeometry, now: () => number,
  cfg: PhysicsConfig, shotBudget: number, count: { tried: number }, extraBudget = 0): SolvedFailure | null {
  const t0 = now();
  const r = table.ballRadius;
  const cue = state.balls.find((b) => b.kind === 'cue')!;
  const powers = middleOutPowers();
  // (ball, pocket, aim point) attempts, easiest first
  const attempts: { ball: Ball; pocket: PocketId; dir: Vec2; score: number }[] = [];
  for (const ball of state.balls.filter((b) => b.kind === target)) {
    for (const p of table.pockets) {
      const left = { x: -p.inward.y, y: p.inward.x };
      for (const off of FAIL.aimOffsets[kind]) {
        const tgt = { x: p.mouthMid.x + left.x * off, y: p.mouthMid.y + left.y * off };
        const toP = { x: tgt.x - ball.pos.x, y: tgt.y - ball.pos.y };
        const d = Math.hypot(toP.x, toP.y);
        const ghost = { x: ball.pos.x - (toP.x / d) * 2 * r, y: ball.pos.y - (toP.y / d) * 2 * r };
        const dir = { x: ghost.x - cue.pos.x, y: ghost.y - cue.pos.y };
        const dA = Math.hypot(dir.x, dir.y);
        if (dA < 1e-9) continue;
        // task 4.7: a real attempt at a sensible pot: a comfortable cut, the ball's way to the pocket open
        if (cutAngle(cue.pos, ball.pos, p.mouthMid, r) > FAIL.maxCutDeg) continue;
        if (!pathClear(ball.pos, p.mouthMid, state.balls, ['cue', ball.id], r)) continue;
        const blocked = !pathClear(cue.pos, ghost, state.balls, ['cue', ball.id], r);
        if ((kind === 'wrongBallFirst') !== blocked) continue; // only wrongBallFirst wants a ball in the way
        attempts.push({ ball, pocket: p.id, dir, score: potCost(cue.pos, ball, p.mouthMid, state.balls, r) });
      }
    }
  }
  // the most natural pots first (stable sort: aim points keep their order); only pots close to the best one
  attempts.sort((a, b) => a.score - b.score);
  const bestPot = attempts[0]?.score ?? 0;
  const rest = kind !== 'wrongBallFirst' ? attempts.filter((a) => a.score > bestPot + FAIL.potMargin) : [];
  if (kind !== 'wrongBallFirst') attempts.splice(0, attempts.length, ...attempts.filter((a) => a.score <= bestPot + FAIL.potMargin));
  const NF = FAIL.natural;
  // natural switch on: rank = (over maxSeconds?, in-off into a far pocket?, length); lower is better
  const over = (f: SolvedFailure) => f.duration > NF.maxSeconds;
  const far = (f: SolvedFailure) => kind === 'inOff' && !over(f) && (f.inOffDist ?? 0) > NF.inOffNearPocket;
  const better = (a: SolvedFailure, b: SolvedFailure) =>
    Number(over(a)) - Number(over(b)) || Number(far(a)) - Number(far(b)) || a.duration - b.duration;
  const goodEnough = (f: SolvedFailure) => f.duration <= CONFIG.shot.maxDurationFlex && (!NF.enabled || !far(f));
  let best: SolvedFailure | null = null;
  let tried = 0;
  let budget = shotBudget;
  let done = false;
  // natural switch on: when the type was found but only too long (or an in-off only into a far pocket), a second pass
  // with extraBudget more shots: the in-between powers (softest first: a gentler attempt ends sooner), on the natural
  // pots first, then the less natural ones (beyond potMargin)
  const sorted = [...powers].filter((v) => v <= FAIL.maxSpeed).sort((a, b) => a - b);
  const finePowers = sorted.slice(1).map((v, i) => Math.sqrt(v * sorted[i]!));
  const passes = [{ list: attempts, pw: powers }, { list: [...attempts, ...rest], pw: finePowers }];
  for (let pass = 0; pass < 2 && !done; pass++) {
    if (pass === 1) {
      if (!(NF.enabled && extraBudget > 0 && best && (over(best) || far(best)))) break;
      budget += extraBudget;
    }
  search: for (const { ball, pocket, dir } of passes[pass]!.list) {
    const p = table.pockets.find((q) => q.id === pocket)!;
    for (const speed of passes[pass]!.pw) {
      if (speed > FAIL.maxSpeed) continue; // medium power: a real attempt, not a smash
      for (const spin of Sv.spinSamples) {
        if (tried >= budget) break search; // a shot count: same on every device
        tried++;
        const sim = createSim(state.balls, table, cfg);
        strike(sim, 'cue', dir, speed, spin);
        let closest = Infinity;
        const tb = sim.balls.find((b) => b.id === ball.id)!;
        // a far-pocket in-off under maxSeconds can still lose to a near one up to maxSeconds
        const limitS = !best ? cfg.maxSimSeconds : NF.enabled && far(best) ? NF.maxSeconds : best.duration;
        const limit = Math.ceil(limitS / cfg.timestep);
        for (let n = 0; n < limit && isMoving(sim); n++) {
          stepSim(sim);
          closest = Math.min(closest, Math.hypot(tb.pos.x - p.mouthMid.x, tb.pos.y - p.mouthMid.y));
        }
        if (isMoving(sim)) continue;
        const firstHit = firstHitOf(sim);
        const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
        const v = judgeShot(state, target, { firstHit, potted, after: [] });
        if (v.result !== 'failure') continue;
        const jawHits = sim.events.some((e) => e.type === 'jaw' && e.a === ball.id);
        const ok = kind === 'plainMiss' ? v.type === 'noPot' && firstHit === ball.id && !jawHits && closest < FAIL.mustReach
          : kind === 'jawRattle' ? v.type === 'noPot' && firstHit === ball.id && jawHits
          : kind === 'inOff' ? v.type === 'inOff' && firstHit === ball.id
          : v.type === 'wrongBallFirst';
        if (!ok) continue;
        const cand: SolvedFailure = { target: ball.id, pocket, dir, speed, spin, duration: sim.time, computeMs: 0, tried: 0, kind, fallback: null,
          type: 'attempt', natural: 0, whyNot: null,
          score: sim.time, nextCost: null, cueEnd: { ...sim.balls.find((b) => b.kind === 'cue')!.pos } };
        if (kind === 'inOff') {
          const cp = sim.events.find((e) => e.type === 'pot' && e.a === 'cue');
          const cpm = cp && cp.type === 'pot' ? table.pockets.find((q) => q.id === cp.pocket)?.mouthMid : undefined;
          if (cpm) cand.inOffDist = inOffPocketDistance(cue.pos, ball.pos, p.mouthMid, cpm);
        }
        if (NF.enabled && best && better(cand, best) >= 0) continue;
        best = cand;
        if (goodEnough(best)) { done = true; break search; } // good enough: a failure need not be the quickest
      }
    }
  }
  }
  if (best) { best.computeMs = now() - t0; best.tried = tried; }
  count.tried += tried;
  return best;
}

/** RULES D.2 step 2: a soft shot straight at a ball that is not a target, hitting it first, potting nothing. */
function softFoul(state: FrameState, target: BallKind, table: TableGeometry, cfg: PhysicsConfig, count: { tried: number }): SolvedFailure | null {
  const cue = state.balls.find((b) => b.kind === 'cue')!;
  const away = (b: Ball) => Math.hypot(b.pos.x - cue.pos.x, b.pos.y - cue.pos.y);
  const wrong = state.balls.filter((b) => b.kind !== 'cue' && b.kind !== target).sort((a, b) => away(a) - away(b));
  let tried = 0;
  for (const w of wrong) {
    const dir = { x: w.pos.x - cue.pos.x, y: w.pos.y - cue.pos.y };
    for (const speed of FAIL.softSpeeds) {
      if (tried >= FAIL.softFoulMaxShots) return null; // a fixed cap (config), whatever the number of balls
      tried++;
      count.tried++;
      const sim = createSim(state.balls, table, cfg);
      strike(sim, 'cue', dir, speed, 0);
      runUntilStill(sim);
      const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
      const v = judgeShot(state, target, { firstHit: firstHitOf(sim), potted, after: [] });
      if (v.result === 'failure' && v.type === 'wrongBallFirst') {
        return { target: w.id, pocket: table.pockets[0]!.id, dir, speed, spin: 0, duration: sim.time, computeMs: 0, tried,
          kind: 'wrongBallFirst', fallback: 'softFoul', type: 'softFoul', natural: 0, whyNot: 'fallback', score: sim.time, nextCost: null, cueEnd: { ...sim.balls[0]!.pos } };
      }
    }
  }
  return null;
}

/** RULES D.2 step 3: tap the cue ball gently so it hits no ball at all (many directions are tried). */
function gentleTap(state: FrameState, target: BallKind, table: TableGeometry, cfg: PhysicsConfig, count: { tried: number }): SolvedFailure | null {
  for (let k = 0; k < FAIL.tapDirections; k++) {
    count.tried++;
    const a = (2 * Math.PI * k) / FAIL.tapDirections;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const sim = createSim(state.balls, table, cfg);
    strike(sim, 'cue', dir, FAIL.tapSpeed, 0);
    runUntilStill(sim);
    const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
    const v = judgeShot(state, target, { firstHit: firstHitOf(sim), potted, after: [] });
    if (v.result === 'failure' && v.type === 'missedAll') {
      return { target: 'cue', pocket: table.pockets[0]!.id, dir, speed: FAIL.tapSpeed, spin: 0, duration: sim.time,
        computeMs: 0, tried: k + 1, kind: 'wrongBallFirst', fallback: 'tap', type: 'tap', natural: 0, whyNot: 'fallback', score: sim.time, nextCost: null,
        cueEnd: { ...sim.balls[0]!.pos } };
    }
  }
  return null;
}

/** A failure shot of the chosen kind, else the RULES D.2 fallbacks in order. null only if even the tap fails. */
export function solveFailure(state: FrameState, target: BallKind, kind: FailureKind, table: TableGeometry,
  now: () => number, cfg: PhysicsConfig = CONFIG.physics, shotBudget: number = Sv.shotBudget): SolvedFailure | null {
  const t0 = now();
  const count = { tried: 0 }; // every shot simulated for this failure, all stages (never above shotCaps().failure)
  const done = (s: SolvedFailure | null, fallback: FailureFallback): SolvedFailure | null =>
    s && { ...s, kind, fallback, computeMs: now() - t0, tried: count.tried };
  // the second shotBudget (normally for the plain-miss fallback) may go to a second pass when the type was found
  // but only too long: shotCaps().failure stays the same
  const found = searchFailure(state, target, kind, table, now, cfg, shotBudget, count, shotBudget);
  if (found) return done(found, null);
  if (kind !== 'plainMiss') {
    const miss = searchFailure(state, target, 'plainMiss', table, now, cfg, shotBudget, count);
    if (miss) return done(miss, 'plainMiss');
  }
  return done(softFoul(state, target, table, cfg, count), 'softFoul') ?? done(gentleTap(state, target, table, cfg, count), 'tap');
}
