// Shot solver, success shots (task 4.1). For a decided SUCCESS, find a shot that pots exactly the target ball,
// checked by simulation AND by the rules code (judgeShot). Of the shots found within the time budget, the quickest
// (until every ball stops) is returned (owner's pace decision, task 1.4). Pure: the clock is passed in.
//
// Search: every target ball x every pocket, easiest first (small cut, short distance, clear path), ghost-ball aim at
// a few points across the mouth, then every power and spin from the config. Flex chain (other pockets, longer time,
// wide search) comes in task 4.5.

import { CONFIG } from '../config/game.config';
import { createSim, isMoving, runUntilStill, stepSim, strike, type PhysicsConfig } from './physics/sim';
import { judgeShot, type FrameState } from './rules';
import type { PocketId, TableGeometry } from './table/geometry';
import { type Ball, type BallKind, type Vec2 } from './types';

export interface SolvedShot {
  target: string; // id of the ball potted
  pocket: PocketId;
  dir: Vec2;
  speed: number; // m/s
  spin: number; // -1 screw ... +1 follow
  duration: number; // seconds until every ball stops
  computeMs: number;
  tried: number; // shots simulated
}

const Sv = CONFIG.solver;

/** Does the straight path of a ball from a to b pass clear of every other ball (ids in skip are ignored)? */
function pathClear(a: Vec2, b: Vec2, balls: Ball[], skip: string[], r: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  for (const o of balls) {
    if (skip.includes(o.id)) continue;
    const t = Math.max(0, Math.min(1, ((o.pos.x - a.x) * dx + (o.pos.y - a.y) * dy) / len2));
    const px = a.x + dx * t - o.pos.x;
    const py = a.y + dy * t - o.pos.y;
    if (px * px + py * py < (2 * r) * (2 * r)) return false;
  }
  return true;
}

/** Find the quickest success shot at `target` (a kind from legalTargets), or null if none within the budget. */
/** Why a search ended (for the debug page and the solver report). */
export interface SolveInfo { pairs: number; tried: number; timedOut: boolean }

export function solveSuccess(state: FrameState, target: BallKind, table: TableGeometry, now: () => number,
  cfg: PhysicsConfig = CONFIG.physics, budgetMs: number = Sv.timeBudgetMs, info?: SolveInfo): SolvedShot | null {
  const t0 = now();
  const r = table.ballRadius;
  const cue = state.balls.find((b) => b.kind === 'cue')!;
  const powers = Array.from({ length: Sv.powerSamples }, (_, i) =>
    Sv.minSpeed * (CONFIG.physics.maxCueSpeed / Sv.minSpeed) ** (i / (Sv.powerSamples - 1))); // low to high
  // candidate (ball, pocket) pairs, easiest first
  const pairs: { ball: Ball; pocket: PocketId; score: number }[] = [];
  for (const ball of state.balls.filter((b) => b.kind === target)) {
    for (const p of table.pockets) {
      const toP = { x: p.mouthMid.x - ball.pos.x, y: p.mouthMid.y - ball.pos.y };
      const dP = Math.hypot(toP.x, toP.y);
      const ghost = { x: ball.pos.x - (toP.x / dP) * 2 * r, y: ball.pos.y - (toP.y / dP) * 2 * r };
      const aim = { x: ghost.x - cue.pos.x, y: ghost.y - cue.pos.y };
      const dA = Math.hypot(aim.x, aim.y);
      const cut = (Math.acos(Math.max(-1, Math.min(1, (aim.x * toP.x + aim.y * toP.y) / (dA * dP)))) * 180) / Math.PI;
      if (cut > Sv.maxCutDeg) continue;
      if (!pathClear(cue.pos, ghost, state.balls, ['cue', ball.id], r)) continue;
      if (!pathClear(ball.pos, p.mouthMid, state.balls, ['cue', ball.id], r)) continue;
      pairs.push({ ball, pocket: p.id, score: cut / 45 + (dA + dP) / 2 });
    }
  }
  pairs.sort((a, b) => a.score - b.score);

  let best: SolvedShot | null = null;
  let tried = 0;
  const half = (Sv.aimSamplesPerPocket - 1) / 2;
  search: for (const { ball, pocket } of pairs) {
    const p = table.pockets.find((q) => q.id === pocket)!;
    const left = { x: -p.inward.y, y: p.inward.x };
    for (let k = 0; k < Sv.aimSamplesPerPocket; k++) {
      const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Sv.aimStep; // 0, -1, +1, -2, +2 ... steps across the mouth
      if (Math.abs(off) > half * Sv.aimStep + 1e-9) continue;
      const tgt = { x: p.mouthMid.x + left.x * off, y: p.mouthMid.y + left.y * off };
      const toP = { x: tgt.x - ball.pos.x, y: tgt.y - ball.pos.y };
      const d = Math.hypot(toP.x, toP.y);
      const dir = { x: ball.pos.x - (toP.x / d) * 2 * r - cue.pos.x, y: ball.pos.y - (toP.y / d) * 2 * r - cue.pos.y };
      for (const speed of powers) {
        for (const spin of Sv.spinSamples) {
          if (now() - t0 > budgetMs) { if (info) info.timedOut = true; break search; }
          tried++;
          const sim = createSim(state.balls, table, cfg);
          strike(sim, 'cue', dir, speed, spin);
          // stop early once this shot is already longer than the best one found (it cannot win)
          const limit = Math.ceil((best ? best.duration : cfg.maxSimSeconds) / cfg.timestep);
          for (let n = 0; n < limit && isMoving(sim); n++) stepSim(sim);
          if (isMoving(sim)) continue;
          const duration = sim.time;
          const first = sim.events.find((e) => e.type === 'ball');
          const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
          const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
          const v = judgeShot(state, target, { firstHit, potted, after: [] });
          if (v.result !== 'success') continue;
          const pottedIn = sim.events.find((e) => e.type === 'pot' && e.a === v.potted);
          best = { target: v.potted, pocket: pottedIn && pottedIn.type === 'pot' ? pottedIn.pocket : pocket, dir, speed, spin,
            duration, computeMs: 0, tried: 0 };
        }
      }
    }
  }
  if (best) { best.computeMs = now() - t0; best.tried = tried; }
  if (info) { info.pairs = pairs.length; info.tried = tried; }
  return best;
}

// ---------------- random layouts for the debug page and the tests ----------------

/** A random position on the cloth, at least `gap` from every ball in `others` and away from the cushions. */
function freeSpot(rng: () => number, table: TableGeometry, others: Vec2[]): Vec2 {
  const r = table.ballRadius;
  for (;;) {
    const p = { x: (rng() * 2 - 1) * (table.halfWidth - 2 * r), y: (rng() * 2 - 1) * (table.halfLength - 2 * r) };
    if (others.every((o) => Math.hypot(o.x - p.x, o.y - p.y) > 2 * r + 0.002)) return p;
  }
}

/**
 * A random mid-round layout: some reds left (1 .. reds) at random places, colours on their spots, cue ball anywhere.
 * `due` = 'red' (a red must be potted) or 'colour' (a red was just potted; the game picks black).
 */
export function randomLayout(rng: () => number, reds: number, due: 'red' | 'colour', table: TableGeometry): FrameState {
  const balls: Ball[] = CONFIG.finalColourOrder.map((c) => ({ id: c, kind: c, pos: { ...table.spots[c] } }));
  const left = 1 + Math.floor(rng() * reds);
  for (let i = 1; i <= left; i++) balls.push({ id: `red${i}`, kind: 'red', pos: freeSpot(rng, table, balls.map((b) => b.pos)) });
  balls.unshift({ id: 'cue', kind: 'cue', pos: freeSpot(rng, table, balls.map((b) => b.pos)) });
  return { phase: due, redsLeft: left, nextColour: null, balls, lastFailure: null,
    failedIn: null, score: 0, opponentScore: 0, blackAfterEveryRed: true };
}

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
export interface SolvedFailure extends SolvedShot { kind: FailureKind; fallback: FailureFallback }

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

/** The chosen failure type only (no fallback). */
function searchFailure(state: FrameState, target: BallKind, kind: FailureKind, table: TableGeometry, now: () => number,
  cfg: PhysicsConfig, budgetMs: number): SolvedFailure | null {
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
        const cut = (Math.acos(Math.max(-1, Math.min(1, (dir.x * toP.x + dir.y * toP.y) / (dA * d)))) * 180) / Math.PI;
        if (cut > Sv.maxCutDeg) continue;
        const blocked = !pathClear(cue.pos, ghost, state.balls, ['cue', ball.id], r);
        if ((kind === 'wrongBallFirst') !== blocked) continue; // only wrongBallFirst wants a ball in the way
        attempts.push({ ball, pocket: p.id, dir, score: cut / 45 + (dA + d) / 2 });
      }
    }
  }
  attempts.sort((a, b) => a.score - b.score);
  let best: SolvedFailure | null = null;
  let tried = 0;
  search: for (const { ball, pocket, dir } of attempts) {
    const p = table.pockets.find((q) => q.id === pocket)!;
    for (const speed of powers) {
      for (const spin of Sv.spinSamples) {
        if (now() - t0 > budgetMs) break search;
        tried++;
        const sim = createSim(state.balls, table, cfg);
        strike(sim, 'cue', dir, speed, spin);
        let closest = Infinity;
        const tb = sim.balls.find((b) => b.id === ball.id)!;
        const limit = Math.ceil((best ? best.duration : cfg.maxSimSeconds) / cfg.timestep);
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
        best = { target: ball.id, pocket, dir, speed, spin, duration: sim.time, computeMs: 0, tried: 0, kind, fallback: null };
        if (best.duration <= CONFIG.shot.maxDurationFlex) break search; // good enough: a failure need not be the quickest
      }
    }
  }
  if (best) { best.computeMs = now() - t0; best.tried = tried; }
  return best;
}

/** RULES D.2 step 2: a soft shot straight at a ball that is not a target, hitting it first, potting nothing. */
function softFoul(state: FrameState, target: BallKind, table: TableGeometry, cfg: PhysicsConfig): SolvedFailure | null {
  const cue = state.balls.find((b) => b.kind === 'cue')!;
  const away = (b: Ball) => Math.hypot(b.pos.x - cue.pos.x, b.pos.y - cue.pos.y);
  const wrong = state.balls.filter((b) => b.kind !== 'cue' && b.kind !== target).sort((a, b) => away(a) - away(b));
  let tried = 0;
  for (const w of wrong) {
    const dir = { x: w.pos.x - cue.pos.x, y: w.pos.y - cue.pos.y };
    for (const speed of FAIL.softSpeeds) {
      tried++;
      const sim = createSim(state.balls, table, cfg);
      strike(sim, 'cue', dir, speed, 0);
      runUntilStill(sim);
      const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
      const v = judgeShot(state, target, { firstHit: firstHitOf(sim), potted, after: [] });
      if (v.result === 'failure' && v.type === 'wrongBallFirst') {
        return { target: w.id, pocket: table.pockets[0]!.id, dir, speed, spin: 0, duration: sim.time, computeMs: 0, tried,
          kind: 'wrongBallFirst', fallback: 'softFoul' };
      }
    }
  }
  return null;
}

/** RULES D.2 step 3: tap the cue ball gently so it hits no ball at all (many directions are tried). */
function gentleTap(state: FrameState, target: BallKind, table: TableGeometry, cfg: PhysicsConfig): SolvedFailure | null {
  for (let k = 0; k < FAIL.tapDirections; k++) {
    const a = (2 * Math.PI * k) / FAIL.tapDirections;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const sim = createSim(state.balls, table, cfg);
    strike(sim, 'cue', dir, FAIL.tapSpeed, 0);
    runUntilStill(sim);
    const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
    const v = judgeShot(state, target, { firstHit: firstHitOf(sim), potted, after: [] });
    if (v.result === 'failure' && v.type === 'missedAll') {
      return { target: 'cue', pocket: table.pockets[0]!.id, dir, speed: FAIL.tapSpeed, spin: 0, duration: sim.time,
        computeMs: 0, tried: k + 1, kind: 'wrongBallFirst', fallback: 'tap' };
    }
  }
  return null;
}

/** A failure shot of the chosen kind, else the RULES D.2 fallbacks in order. null only if even the tap fails. */
export function solveFailure(state: FrameState, target: BallKind, kind: FailureKind, table: TableGeometry,
  now: () => number, cfg: PhysicsConfig = CONFIG.physics, budgetMs: number = Sv.timeBudgetMs): SolvedFailure | null {
  const t0 = now();
  const done = (s: SolvedFailure | null, fallback: FailureFallback): SolvedFailure | null =>
    s && { ...s, kind, fallback, computeMs: now() - t0 };
  const found = searchFailure(state, target, kind, table, now, cfg, budgetMs);
  if (found) return done(found, null);
  if (kind !== 'plainMiss') {
    const miss = searchFailure(state, target, 'plainMiss', table, now, cfg, budgetMs);
    if (miss) return done(miss, 'plainMiss');
  }
  return done(softFoul(state, target, table, cfg), 'softFoul') ?? done(gentleTap(state, target, table, cfg), 'tap');
}
