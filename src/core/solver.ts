// Shot solver, success shots (task 4.1). For a decided SUCCESS, find a shot that pots exactly the target ball,
// checked by simulation AND by the rules code (judgeShot). Of the shots found within the shot budget (config solver.shotBudget), the quickest
// (until every ball stops) is returned (owner's pace decision, task 1.4). Pure: the clock is passed in.
//
// Search: every target ball x every pocket, easiest first (small cut, short distance, clear path), ghost-ball aim at
// a few points across the mouth, then every power and spin from the config. Flex chain (other pockets, longer time,
// wide search) comes in task 4.5.

import { CONFIG } from '../config/game.config';
import { createSim, isMoving, runUntilStill, stepSim, strike, type PhysicsConfig } from './physics/sim';
import { applyShot, judgeShot, type FrameState } from './rules';
import type { PocketId, TableGeometry } from './table/geometry';
import { type Ball, type BallKind, type Vec2 } from './types';

export interface SolvedShot {
  target: string; // id of the ball potted
  pocket: PocketId;
  dir: Vec2;
  speed: number; // m/s
  spin: number; // -1 screw ... +1 follow
  duration: number; // seconds until every ball stops
  score: number; // what the search minimises: duration (+ position weight x next-shot cost, task 4.3)
  nextCost: number | null; // how hard the next shot looks from cueEnd (null = not scored)
  cueEnd: Vec2;
  lookahead?: 'ok' | 'failed'; // was the next step found solvable from here? (undefined = not checked)
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
/**
 * Position play (task 4.3): how hard the NEXT shot looks with the cue ball at `cue` (same measure as the pair
 * ranking: cut angle and distances; lower = easier). No open pocket for the next ball = position.noShotCost.
 */
export function nextShotCost(cue: Vec2, balls: Ball[], next: BallKind, table: TableGeometry): number {
  const r = table.ballRadius;
  let best: number = Sv.position.noShotCost;
  for (const ball of balls.filter((b) => b.kind === next)) {
    for (const p of table.pockets) {
      const toP = { x: p.mouthMid.x - ball.pos.x, y: p.mouthMid.y - ball.pos.y };
      const dP = Math.hypot(toP.x, toP.y);
      const ghost = { x: ball.pos.x - (toP.x / dP) * 2 * r, y: ball.pos.y - (toP.y / dP) * 2 * r };
      const aim = { x: ghost.x - cue.x, y: ghost.y - cue.y };
      const dA = Math.hypot(aim.x, aim.y);
      if (dA < 1e-6) continue;
      const cut = (Math.acos(Math.max(-1, Math.min(1, (aim.x * toP.x + aim.y * toP.y) / (dA * dP)))) * 180) / Math.PI;
      if (cut > Sv.maxCutDeg) continue;
      const others = balls.filter((b) => b.kind !== 'cue');
      if (!pathClear(cue, ghost, others, [ball.id], r) || !pathClear(ball.pos, p.mouthMid, others, [ball.id], r)) continue;
      best = Math.min(best, cut / 45 + (dA + dP) / 2);
    }
  }
  return best;
}

/** The kind of ball due after potting `target` in this state (the game picks black until the colour choice, B.3). */
export function nextTargetAfter(state: FrameState, target: BallKind): BallKind | null {
  if (state.phase === 'red') return 'black';
  if (state.phase === 'colour') return state.redsLeft > 0 ? 'red' : CONFIG.finalColourOrder[0];
  const i = CONFIG.finalColourOrder.indexOf(target as (typeof CONFIG.finalColourOrder)[number]);
  return CONFIG.finalColourOrder[i + 1] ?? null;
}

export interface SolveOptions {
  position?: boolean; // position play (default: config solver.position.enabled)
  weight?: number; // position weight override (measurements)
  overFrom?: number; // seconds above which a shot pays extra (measurements)
  wide?: boolean; // RULES D.3 wide search
  maxDuration?: number; // reject shots longer than this (seconds)
  firstFound?: boolean; // stop at the first success (used by the lookahead check)
  lookahead?: boolean; // verify that the next step stays solvable (default: config solver.lookahead > 0)
}

/** Why a search ended (for the debug page and the solver report). */
export interface SolveInfo { pairs: number; tried: number; timedOut: boolean }

export function solveSuccess(state: FrameState, target: BallKind, table: TableGeometry, now: () => number,
  cfg: PhysicsConfig = CONFIG.physics, shotBudget: number = Sv.shotBudget, info?: SolveInfo,
  opts: SolveOptions = {}): SolvedShot | null {
  const t0 = now();
  const W = opts.wide ? Sv.wide : null; // RULES D.3 wide search: more aims, powers, spins, cushion-first, plants
  const position = opts.position ?? Sv.position.enabled;
  const next = position ? nextTargetAfter(state, target) : null;
  const r = table.ballRadius;
  const cue = state.balls.find((b) => b.kind === 'cue')!;
  const nPow = W ? W.powerSamples : Sv.powerSamples;
  const powers = Array.from({ length: nPow }, (_, i) =>
    Sv.minSpeed * (CONFIG.physics.maxCueSpeed / Sv.minSpeed) ** (i / (nPow - 1))); // low to high
  const spins = W ? W.spinSamples : Sv.spinSamples;
  const aimSamples = W ? W.aimSamples : Sv.aimSamplesPerPocket;
  const aimStep = W ? W.aimStep : Sv.aimStep;
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
      // the wide search keeps blocked pairs too: a cushion-first shot or a plant may still pot the ball
      if (!W && !pathClear(cue.pos, ghost, state.balls, ['cue', ball.id], r)) continue;
      if (!W && !pathClear(ball.pos, p.mouthMid, state.balls, ['cue', ball.id], r)) continue;
      pairs.push({ ball, pocket: p.id, score: cut / 45 + (dA + dP) / 2 });
    }
  }
  pairs.sort((a, b) => a.score - b.score);

  let best: SolvedShot | null = null;
  const improving: SolvedShot[] = []; // every new best in turn (the lookahead checks them, best first)
  let tried = 0;
  const half = (aimSamples - 1) / 2;
  search: for (const { ball, pocket } of pairs) {
    const p = table.pockets.find((q) => q.id === pocket)!;
    const left = { x: -p.inward.y, y: p.inward.x };
    for (let k = 0; k < aimSamples; k++) {
      const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * aimStep; // 0, -1, +1, -2, +2 ... steps across the mouth
      if (Math.abs(off) > half * aimStep + 1e-9) continue;
      const tgt = { x: p.mouthMid.x + left.x * off, y: p.mouthMid.y + left.y * off };
      const toP = { x: tgt.x - ball.pos.x, y: tgt.y - ball.pos.y };
      const d = Math.hypot(toP.x, toP.y);
      const ghost = { x: ball.pos.x - (toP.x / d) * 2 * r, y: ball.pos.y - (toP.y / d) * 2 * r };
      const dirs = [{ x: ghost.x - cue.pos.x, y: ghost.y - cue.pos.y }];
      if (W) {
        // cushion first: aim at the ghost ball's mirror image in each cushion line (the physics checks the real path)
        const X = table.halfWidth - r;
        const Y = table.halfLength - r;
        for (const m of [{ x: 2 * X - ghost.x, y: ghost.y }, { x: -2 * X - ghost.x, y: ghost.y },
          { x: ghost.x, y: 2 * Y - ghost.y }, { x: ghost.x, y: -2 * Y - ghost.y }]) dirs.push({ x: m.x - cue.pos.x, y: m.y - cue.pos.y });
      }
      for (const dir of dirs) for (const speed of powers) {
        for (const spin of spins) {
          if (tried >= shotBudget) { if (info) info.timedOut = true; break search; } // a shot count: same on every device
          tried++;
          const sim = createSim(state.balls, table, cfg);
          strike(sim, 'cue', dir, speed, spin);
          // stop early once this shot is already longer than the best one found (it cannot win)
          const limit = Math.ceil((best ? best.score : cfg.maxSimSeconds) / cfg.timestep);
          for (let n = 0; n < limit && isMoving(sim); n++) stepSim(sim);
          if (isMoving(sim)) continue;
          const duration = sim.time;
          const first = sim.events.find((e) => e.type === 'ball');
          const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
          const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
          const v = judgeShot(state, target, { firstHit, potted, after: [] });
          if (v.result !== 'success') continue;
          if (opts.maxDuration !== undefined && duration > opts.maxDuration) continue;
          // score = shot length + position weight x how hard the next shot looks from where the cue ball stopped
          const cueEnd = sim.balls.find((b) => b.kind === 'cue')!.pos;
          let cost = 0;
          if (next) {
            const after: Ball[] = sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: b.pos }));
            if (state.phase === 'colour' && state.redsLeft > 0) {
              const c = target as (typeof CONFIG.finalColourOrder)[number];
              after.push({ id: c, kind: c, pos: { ...table.spots[c] } }); // re-spotted (approximately: own spot)
            }
            cost = nextShotCost(cueEnd, after, next, table);
          }
          // a shot over the pace target (shot.maxDuration) pays heavily per extra second, so position play chooses among
          // shots that are themselves short; the quickest shot still wins when none is short
          const over = Math.max(0, duration - (opts.overFrom ?? Sv.position.overFrom)) * Sv.position.overPenalty;
          // lookahead (config solver.lookahead): a pot that leaves no open pocket for the next ball always loses to one
          // that does (it would make the next step a re-rack or a long fallback)
          const dead = next && Sv.lookahead > 0 && cost >= Sv.position.noShotCost ? Sv.position.deadPenalty : 0;
          const score = duration + over + dead + (opts.weight ?? Sv.position.weight) * cost;
          if (best && score >= best.score) continue;
          const pottedIn = sim.events.find((e) => e.type === 'pot' && e.a === v.potted);
          best = { target: v.potted, pocket: pottedIn && pottedIn.type === 'pot' ? pottedIn.pocket : pocket, dir, speed, spin,
            duration, computeMs: 0, tried: 0, score, nextCost: next ? cost : null, cueEnd: { ...cueEnd } };
          improving.push(best);
          if (opts.firstFound) break search;
        }
      }
    }
  }
  // lookahead (config solver.lookahead, RULES D: avoid re-racks): the next step must stay solvable. The best
  // candidates are checked in order by really solving the next shot from where they leave the balls (small budget,
  // first success found). If none passes, the best shot is kept.
  if (best && next && (opts.lookahead ?? Sv.lookahead > 0)) {
    const order = [...improving].sort((a, b) => a.score - b.score).slice(0, Sv.lookaheadCandidates);
    for (const c of order) {
      const sim = createSim(state.balls, table, cfg);
      strike(sim, 'cue', c.dir, c.speed, c.spin);
      runUntilStill(sim);
      const first = sim.events.find((e) => e.type === 'ball');
      const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
      const nextState = applyShot(state, target, { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
        after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) }, table);
      const ok = solveSuccess(nextState, next, table, now, cfg, Sv.lookaheadShots, undefined,
        { position: false, lookahead: false, firstFound: true, maxDuration: CONFIG.shot.maxDurationFlex });
      tried += ok ? ok.tried : Sv.lookaheadShots;
      if (ok) { best = { ...c, lookahead: 'ok' }; break; }
    }
    if (best.lookahead !== 'ok') best = { ...best, lookahead: 'failed' };
  }
  if (best) best = { ...best, computeMs: now() - t0, tried };
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

// ---------------- flex chain and fallback log (task 4.5, RULES D.3 / D.4) ----------------

/** Which step of the flex chain produced the success shot (RULES D.3), or RE-RACK (D.4). */
export type FlexLevel = 'normal' | 'longerDuration' | 'wideSearch' | 'overLong' | 'reRack';
export interface FallbackLogEntry { roundCode: string; step: number; target: BallKind; level: FlexLevel | 'noLookahead'; tried: number }
export interface FlexResult { shot: SolvedShot | null; level: FlexLevel; log: FallbackLogEntry | null }

/**
 * A decided SUCCESS (the outcome never changes): normal search; a shot up to shot.maxDuration is 'normal', up to
 * shot.maxDurationFlex 'longerDuration'. Other pockets and other balls of the same kind are already part of the
 * normal search. Then the wide search (more aims, powers and spins, cushion-first, plants), within maxDurationFlex.
 * Then 'overLong' (OWNER TO CONFIRM): the shortest shot found that is longer than maxDurationFlex. RULES D.4 says
 * RE-RACK only when "no shot exists", and a long shot is still a shot. Nothing at all: RE-RACK. Every step other than
 * 'normal' returns a log entry (RULES D: logged with the round code and step).
 */
export function solveSuccessFlex(state: FrameState, target: BallKind, table: TableGeometry, now: () => number,
  ctx: { roundCode: string; step: number }, cfg: PhysicsConfig = CONFIG.physics): FlexResult {
  const flex = CONFIG.shot.maxDurationFlex;
  const log = (level: FlexLevel | 'noLookahead', tried: number): FallbackLogEntry => ({ ...ctx, target, level, tried });
  // a shot whose lookahead failed (the next step looked unsolvable) is only used when nothing better exists
  const good = (s: SolvedShot | null) => !!s && s.lookahead !== 'failed';
  const normal = solveSuccess(state, target, table, now, cfg, Sv.shotBudget);
  if (good(normal) && normal!.duration <= CONFIG.shot.maxDuration) return { shot: normal, level: 'normal', log: null };
  if (good(normal) && normal!.duration <= flex) return { shot: normal, level: 'longerDuration', log: log('longerDuration', normal!.tried) };
  const wide = solveSuccess(state, target, table, now, cfg, Sv.wide.shotBudget, undefined, { wide: true });
  const tried = Sv.shotBudget + (wide ? wide.tried : Sv.wide.shotBudget);
  if (good(wide) && wide!.duration <= flex) return { shot: wide, level: 'wideSearch', log: log('wideSearch', tried) };
  const found = [normal, wide].filter((x): x is SolvedShot => x !== null);
  // prefer a shot that keeps the next step solvable, then the shortest
  found.sort((a, b) => Number(a.lookahead === 'failed') - Number(b.lookahead === 'failed') || a.duration - b.duration);
  const pick = found[0];
  if (pick && pick.duration <= flex) return { shot: pick, level: pick === wide ? 'wideSearch' : 'longerDuration', log: log('noLookahead', tried) };
  if (pick) return { shot: pick, level: 'overLong', log: log('overLong', tried) };
  return { shot: null, level: 'reRack', log: log('reRack', tried) };
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
  cfg: PhysicsConfig, shotBudget: number): SolvedFailure | null {
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
        if (tried >= shotBudget) break search; // a shot count: same on every device
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
        best = { target: ball.id, pocket, dir, speed, spin, duration: sim.time, computeMs: 0, tried: 0, kind, fallback: null,
          score: sim.time, nextCost: null, cueEnd: { ...sim.balls.find((b) => b.kind === 'cue')!.pos } };
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
          kind: 'wrongBallFirst', fallback: 'softFoul', score: sim.time, nextCost: null, cueEnd: { ...sim.balls[0]!.pos } };
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
        computeMs: 0, tried: k + 1, kind: 'wrongBallFirst', fallback: 'tap', score: sim.time, nextCost: null,
        cueEnd: { ...sim.balls[0]!.pos } };
    }
  }
  return null;
}

/** A failure shot of the chosen kind, else the RULES D.2 fallbacks in order. null only if even the tap fails. */
export function solveFailure(state: FrameState, target: BallKind, kind: FailureKind, table: TableGeometry,
  now: () => number, cfg: PhysicsConfig = CONFIG.physics, shotBudget: number = Sv.shotBudget): SolvedFailure | null {
  const t0 = now();
  const done = (s: SolvedFailure | null, fallback: FailureFallback): SolvedFailure | null =>
    s && { ...s, kind, fallback, computeMs: now() - t0 };
  const found = searchFailure(state, target, kind, table, now, cfg, shotBudget);
  if (found) return done(found, null);
  if (kind !== 'plainMiss') {
    const miss = searchFailure(state, target, 'plainMiss', table, now, cfg, shotBudget);
    if (miss) return done(miss, 'plainMiss');
  }
  return done(softFoul(state, target, table, cfg), 'softFoul') ?? done(gentleTap(state, target, table, cfg), 'tap');
}
