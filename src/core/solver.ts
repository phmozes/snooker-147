// Shot solver, success shots (task 4.1). For a decided SUCCESS, find a shot that pots exactly the target ball,
// checked by simulation AND by the rules code (judgeShot). Of the shots found within the shot budget (config solver.shotBudget), the quickest
// (until every ball stops) is returned (owner's pace decision, task 1.4). Pure: the clock is passed in.
//
// Search: every target ball x every pocket, easiest first (small cut, short distance, clear path), ghost-ball aim at
// a few points across the mouth, then every power and spin from the config. Flex chain (other pockets, longer time,
// wide search) comes in task 4.5.

import { pos411pOn } from './solverMode';
import { CONFIG } from '../config/game.config';
import { createSim, isMoving, runUntilStill, stepSim, strike, type PhysicsConfig } from './physics/sim';
import { applyShot, judgeShot, type FrameState } from './rules';
import type { PocketId, TableGeometry } from './table/geometry';
import { angleCost, classifySuccess, cutAngle, isExhibition, NATURAL_TYPES, naturalCheck, packLeftClosed, potCost, powerCost,
  typeCost, pocketPrefCost, zoneCost, clusteredReds, allRedsLocked, type ShotType } from './shotType';
import { type Ball, type BallKind, type Colour, type Vec2 } from './types';

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
  lockedReds?: boolean; // every red left is locked (no pocket can take any of them): RE-RACK risk
  nextNatural?: boolean; // colour planned two shots ahead: is the red after it strictly natural? (RULES B.3)
  computeMs: number;
  tried: number; // shots simulated
  type: ShotType; // what kind of shot it is (task 4.7)
  natural: number; // naturalness cost (0 = what a professional would play)
  whyNot: string | null; // null = natural by the strict check (owner 2026-11-24), else the reason
  // 2026-11-28 (RULES B.7): the ball and pocket the shot was AIMED at (not where it went: a fluke pots elsewhere). The
  // player's view camera follows this. Not set on shots without an aim (spray, soft foul, gentle tap): playerCam.ts aimOf
  aim?: { ball: string; pocket: PocketId };
}

const Sv = CONFIG.solver;
const NAT = Sv.natural;

/** Does the straight path of a ball from a to b pass clear of every other ball (ids in skip are ignored)? */
export function pathClear(a: Vec2, b: Vec2, balls: Ball[], skip: string[], r: number, margin = 0): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  for (const o of balls) {
    if (skip.includes(o.id)) continue;
    const t = Math.max(0, Math.min(1, ((o.pos.x - a.x) * dx + (o.pos.y - a.y) * dy) / len2));
    const px = a.x + dx * t - o.pos.x;
    const py = a.y + dy * t - o.pos.y;
    if (px * px + py * py < (2 * r + margin) * (2 * r + margin)) return false;
  }
  return true;
}

/**
 * Position play (task 4.3, 4.7): how hard the NEXT shot looks with the cue ball at `cue` (lower = easier): the angle
 * left on the next ball (an angle is better than dead straight, a thin cut is worse) and the distances. No open
 * pocket for the next ball = position.noShotCost.
 */
/** Can a ball at `from` go into pocket `p` at all? Middle pockets only take balls coming in fairly square (task 4.7). */
export function entryOk(from: Vec2, p: TableGeometry['pockets'][number]): boolean {
  const d = Math.hypot(p.mouthMid.x - from.x, p.mouthMid.y - from.y);
  const cos = ((p.mouthMid.x - from.x) * p.inward.x + (p.mouthMid.y - from.y) * p.inward.y) / d;
  return cos >= Math.cos(((p.kind === 'middle' ? NAT.maxEntryDeg.middle : NAT.maxEntryDeg.corner) * Math.PI) / 180);
}

export function nextShotCost(cue: Vec2, balls: Ball[], next: BallKind, table: TableGeometry, redPlay = true): number {
  const r = table.ballRadius;
  let best: number = Sv.position.noShotCost;
  for (const ball of balls.filter((b) => b.kind === next)) {
    for (const p of table.pockets) {
      const toP = { x: p.mouthMid.x - ball.pos.x, y: p.mouthMid.y - ball.pos.y };
      const dP = Math.hypot(toP.x, toP.y);
      const ghost = { x: ball.pos.x - (toP.x / dP) * 2 * r, y: ball.pos.y - (toP.y / dP) * 2 * r };
      const dA = Math.hypot(ghost.x - cue.x, ghost.y - cue.y);
      if (dA < 1e-6) continue;
      const cut = cutAngle(cue, ball.pos, p.mouthMid, r);
      if (cut > Sv.maxCutDeg || !entryOk(ball.pos, p)) continue;
      const others = balls.filter((b) => b.kind !== 'cue');
      // with a safety margin: a path that only just clears another ball is no real chance (task 4.7)
      if (!pathClear(cue, ghost, others, [ball.id], r, NAT.pathMargin) || !pathClear(ball.pos, p.mouthMid, others, [ball.id], r, NAT.pathMargin)) continue;
      // a ball touching another ball (a red in the pack) moves its neighbours when hit: not a real chance (task 4.7)
      const touching = balls.some((o) => o.id !== ball.id && o.kind !== 'cue' &&
        Math.hypot(o.pos.x - ball.pos.x, o.pos.y - ball.pos.y) < 2 * r + NAT.touchGap);
      // a long pot next is what a break-builder avoids: keep the cue ball near the next ball
      const long = dA + dP > NAT.longFrom ? NAT.longCost : 0;
      const rest = (dA + dP) / 2 + (touching ? NAT.touchingCost : 0) + long;
      const old = angleCost(cut) + rest;
      // Phase 1 costs only rank the playable next pots: they never turn one into 'no shot' (>= noShotCost = dead)
      best = Math.min(best, !BP.enabled || old >= Sv.position.noShotCost ? old
        : Math.min(Sv.position.noShotCost - 0.01, blackPlayCost(cue, ball, p, ghost, cut, dA, balls, r, table, redPlay) + rest));
    }
  }
  return best;
}

const BP = NAT.blackPlay;
const RP = NAT.redPlay;
const TC = NAT.topColour;
/**
 * Task 4.9 (owner 2026-11-25): how good the next RED looks from `cue` (after a colour). A small, comfortable angle into a
 * near pocket (black-end corner first, then middle), the cue ball not on a side cushion, and the cue ball's natural
 * line after the red (the tangent line) heading back toward the pink side of the black, so the next colour is easy.
 */
function redPlayCost(cue: Vec2, ball: Ball, p: TableGeometry['pockets'][number], ghost: Vec2, cut: number, table: TableGeometry): number {
  const [lo, hi] = RP.cutDeg;
  const base = cut < lo ? ((lo - cut) / lo) * NAT.straightCost : cut > hi ? (cut - hi) / RP.cutDegPerPoint : 0;
  let c = 0; // the extras below are capped at RP.maxCost, so a nicer red never outweighs a natural colour pot
  if (table.halfWidth - Math.abs(cue.x) <= RP.sideCushionM) c += RP.sideCushionCost;
  if (ball.pos.y > 0) {
    const d = (q: TableGeometry['pockets'][number]) => Math.hypot(q.mouthMid.x - ball.pos.x, q.mouthMid.y - ball.pos.y);
    const near = [...table.pockets].sort((a, b) => d(a) - d(b)).slice(0, 2);
    if (!near.includes(p)) c += RP.farPocketCost;
  }
  if (cut > 3) {
    // cue ball after a stun: along the tangent line, away from the pocket side
    const a = { x: ghost.x - cue.x, y: ghost.y - cue.y };
    const o = { x: p.mouthMid.x - ball.pos.x, y: p.mouthMid.y - ball.pos.y };
    const ol = Math.hypot(o.x, o.y); o.x /= ol; o.y /= ol;
    const k = a.x * o.x + a.y * o.y;
    const t = { x: a.x - k * o.x, y: a.y - k * o.y };
    const black = table.spots.black;
    const goal = { x: black.x, y: black.y - RP.returnBelowBlack }; // pink side of the black
    // the cue ball may also roll on (follow) or stop (stun): accept the goal within returnMaxDeg of the tangent line
    // or straight ahead (a follow shot carries it forward along the aim)
    const v = { x: goal.x - ghost.x, y: goal.y - ghost.y };
    const vl = Math.hypot(v.x, v.y);
    const cosT = (v.x * t.x + v.y * t.y) / (vl * Math.hypot(t.x, t.y) + 1e-9);
    const cosF = (v.x * a.x + v.y * a.y) / (vl * Math.hypot(a.x, a.y) + 1e-9);
    if (vl > RP.returnNearM && Math.max(cosT, cosF) < Math.cos((RP.returnMaxDeg * Math.PI) / 180)) c += RP.returnCost;
  }
  return base + Math.min(c, RP.maxCost);
}
/** Phase 1 (owner, night 2026-11-24): how good the next pot looks for position play around the black (replaces angleCost). */
function blackPlayCost(cue: Vec2, ball: Ball, p: TableGeometry['pockets'][number], ghost: Vec2, cut: number, dA: number,
  balls: Ball[], r: number, table: TableGeometry, redPlay: boolean): number {
  let c = 0;
  if (ball.kind === 'black') {
    const [lo, hi] = BP.blackCutDeg;
    c += cut < lo ? ((lo - cut) / lo) * NAT.straightCost : cut > hi ? (cut - hi) / NAT.cutDegPerPoint : 0;
    if (cue.y > ball.pos.y) c += BP.behindBlackCost;
    const [d0, d1] = BP.blackDist;
    c += (dA < d0 ? d0 - dA : dA > d1 ? dA - d1 : 0) * BP.blackDistCostPerM;
  } else if (ball.kind === 'red' && RP.enabled && redPlay) c += redPlayCost(cue, ball, p, ghost, cut, table);
  else c += angleCost(cut);
  if (cut > BP.thinCutFrom) c += BP.thinCutCost;
  c += pocketPrefCost(ball.kind, ball.pos, p.id);
  // night 4, Part 3c ("solver 4.11p", switch off by default): black or pink into a black-end corner, a red in the black
  // half into a black-end corner, the cue ball on the inner side of that ball (never cut back)
  if (pos411pOn() && (ball.kind === 'black' || ball.kind === 'pink' || (ball.kind === 'red' && ball.pos.y > table.spots.blue.y))) {
    const P4 = NAT.pos411p;
    if (!(p.kind === 'corner' && p.mouthMid.y > 0)) c += P4.notBlackEndCornerCost;
    if (cue.y > ball.pos.y - P4.innerMarginM) c += P4.cutBackCost;
  }
  // right side: a colour while reds remain; after the pot the cue ball leaves along the tangent line
  const reds = ball.kind !== 'red' ? balls.filter((b) => b.kind === 'red') : [];
  if (reds.length && cut > 3) {
    const a = { x: ghost.x - cue.x, y: ghost.y - cue.y };
    const o = { x: p.mouthMid.x - ball.pos.x, y: p.mouthMid.y - ball.pos.y };
    const ol = Math.hypot(o.x, o.y); o.x /= ol; o.y /= ol;
    const k = a.x * o.x + a.y * o.y;
    const t = { x: a.x - k * o.x, y: a.y - k * o.y };
    const tl = Math.hypot(t.x, t.y);
    const pack = clusteredReds(balls, r);
    const loose = reds.filter((b) => !pack.has(b.id));
    const cos = Math.cos((BP.sideMaxDeg * Math.PI) / 180);
    const ok = (loose.length ? loose : reds).some((b) => {
      const v = { x: b.pos.x - ghost.x, y: b.pos.y - ghost.y };
      return (v.x * t.x + v.y * t.y) / (Math.hypot(v.x, v.y) * tl + 1e-9) >= cos;
    });
    if (!ok) c += BP.wrongSideCost;
  }
  return c;
}

/** The kind of ball due after potting `target` (after a red: black, the auto colour's first choice, RULES B.3). */
export function nextTargetAfter(state: FrameState, target: BallKind): BallKind | null {
  return nextTargetsAfter(state, target)[0]?.kind ?? null;
}

/** Every ball the next shot could be at, with its extra position cost (after a red: black, pink, blue; RULES B.3). */
export function nextTargetsAfter(state: FrameState, target: BallKind): { kind: BallKind; extra: number }[] {
  if (state.phase === 'red') return NAT.autoColours.map((c) => ({ kind: c, extra: NAT.nextColourCost[c] }));
  if (state.phase === 'colour') return [{ kind: state.redsLeft > 0 ? 'red' : CONFIG.finalColourOrder[0], extra: 0 }];
  const i = CONFIG.finalColourOrder.indexOf(target as (typeof CONFIG.finalColourOrder)[number]);
  const n = CONFIG.finalColourOrder[i + 1];
  return n ? [{ kind: n, extra: 0 }] : [];
}

export interface SolveOptions {
  position?: boolean; // position play (default: config solver.position.enabled)
  weight?: number; // position weight override (measurements)
  overFrom?: number; // seconds above which a shot pays extra (measurements)
  wide?: boolean; // RULES D.3 wide search: more aims, powers and spins (still natural shots only)
  exhibition?: boolean; // last searches before RE-RACK: cushion-first, plants, blocked pairs; exhibition shots allowed
  maxDuration?: number; // reject shots longer than this (seconds)
  firstFound?: boolean; // stop at the first success (used by the lookahead check)
  lookahead?: boolean; // verify that the next step stays solvable (default: config solver.lookahead > 0)
  naturalOnly?: boolean; // accept only natural shots (plain pot, planned pack cannon): the lookahead check
  rescue?: boolean; // config solver.rescue: the lookahead accepts any next shot (exhibition allowed), more candidates
  redPlay?: boolean; // task 4.9: score the next red with redPlayCost (default true; off in a red's own look-ahead)
}

/** Why a search ended (for the debug page and the solver report). */
export interface SolveInfo { pairs: number; tried: number; timedOut: boolean }

/**
 * Find the best success shot at `target` (a kind from legalTargets), or null if none within the shot budget.
 * Best = lowest score: shot length + position + naturalness (task 4.7). Exhibition shots (cushion-first, plant,
 * double, kiss, far pocket, fluke) are rejected unless opts.exhibition.
 */
export function solveSuccess(state: FrameState, target: BallKind, table: TableGeometry, now: () => number,
  cfg: PhysicsConfig = CONFIG.physics, shotBudget: number = Sv.shotBudget, info?: SolveInfo,
  opts: SolveOptions = {}): SolvedShot | null {
  const t0 = now();
  const ex = !!opts.exhibition;
  const W = opts.wide || ex ? Sv.wide : null;
  const position = opts.position ?? Sv.position.enabled;
  const nexts = position ? nextTargetsAfter(state, target) : [];
  const r = table.ballRadius;
  const cue = state.balls.find((b) => b.kind === 'cue')!;
  const nPow = W ? W.powerSamples : Sv.powerSamples;
  // medium power first (natural, and usually reaches the pocket), then softer and firmer in turn
  const powers = Array.from({ length: nPow }, (_, i) => Sv.minSpeed * (CONFIG.physics.maxCueSpeed / Sv.minSpeed) ** (i / (nPow - 1)))
    .map((v, i) => ({ v, d: Math.abs(i - (nPow - 1) * Sv.firstPowerAt) })).sort((a, b) => a.d - b.d).map((x) => x.v);
  const spins = W ? W.spinSamples : Sv.spinSamples;
  const aimSamples = W ? W.aimSamples : Sv.aimSamplesPerPocket;
  const aimStep = W ? W.aimStep : Sv.aimStep;
  // candidate (ball, pocket) pairs, most natural first
  const pairs: { ball: Ball; pocket: PocketId; score: number }[] = [];
  for (const ball of state.balls.filter((b) => b.kind === target)) {
    for (const p of table.pockets) {
      const toP = { x: p.mouthMid.x - ball.pos.x, y: p.mouthMid.y - ball.pos.y };
      const dP = Math.hypot(toP.x, toP.y);
      const ghost = { x: ball.pos.x - (toP.x / dP) * 2 * r, y: ball.pos.y - (toP.y / dP) * 2 * r };
      if (cutAngle(cue.pos, ball.pos, p.mouthMid, r) > Sv.maxCutDeg) continue;
      if (!ex && !entryOk(ball.pos, p)) continue; // a middle pocket from a steep angle: no chance
      // only the exhibition search keeps blocked pairs: a cushion-first shot or a plant may still pot the ball
      if (!ex && !pathClear(cue.pos, ghost, state.balls, ['cue', ball.id], r)) continue;
      if (!ex && !pathClear(ball.pos, p.mouthMid, state.balls, ['cue', ball.id], r)) continue;
      pairs.push({ ball, pocket: p.id, score: potCost(cue.pos, ball, p.mouthMid, state.balls, r) + pocketPrefCost(ball.kind, ball.pos, p.id) +
        (BP.enabled && cutAngle(cue.pos, ball.pos, p.mouthMid, r) > BP.thinCutFrom ? BP.thinCutCost : 0) });
    }
  }
  pairs.sort((a, b) => a.score - b.score);

  let best: SolvedShot | null = null;
  // every success within lookaheadMargin of the best score (the lookahead checks the best ones that leave the cue
  // ball in clearly different places, task 4.7)
  const cands: SolvedShot[] = [];
  // a colour while reds remain: plan two shots ahead (more candidates, a wider margin; every candidate is checked)
  const planRed = state.phase === 'red' && NAT.planReds; // night round 2: a red is planned two shots ahead too
  const plan = ((state.phase === 'colour' && state.redsLeft > 0 && NAT.planColours) || planRed) && nexts.length > 0 && (opts.lookahead ?? Sv.lookahead > 0);
  // task 4.10: a red keeps candidates up to noNaturalCost further, so a red that leaves a natural black / pink can win
  const M = opts.rescue ? Sv.rescue.margin : plan ? NAT.planMargin + (planRed && NAT.topColour.enabled ? NAT.topColour.noNaturalCost : 0) : Sv.lookaheadMargin;
  let tried = 0;
  const half = (aimSamples - 1) / 2;
  // One simulated shot. 'miss' = it did not pot the target (the next aim point across the mouth may);
  // 'done' = this power and spin are settled (a pot was judged, or the shot already runs too long to win).
  const trySim = (dir: Vec2, speed: number, spin: number, pocket: PocketId, pairCost: number, ballId: string, mouth: Vec2):
    'miss' | 'done' => {
    tried++;
    const sim = createSim(state.balls, table, cfg);
    strike(sim, 'cue', dir, speed, spin);
    // stop early once this shot is already longer than the best one's score (every cost is >= 0: it cannot win)
    const limit = Math.ceil((best ? best.score + M : cfg.maxSimSeconds) / cfg.timestep);
    const tb = sim.balls.find((b) => b.id === ballId)!;
    const cb = sim.balls.find((b) => b.kind === 'cue')!;
    let closest = Infinity; // how near the aimed ball came to the pocket mouth
    let travel = 0; // how far the cue ball rolls after its first contact (strict naturalness)
    let px = cb.pos.x;
    let py = cb.pos.y;
    let touched = false;
    for (let n = 0; n < limit && isMoving(sim); n++) {
      stepSim(sim);
      if (!tb.potted) closest = Math.min(closest, Math.hypot(tb.pos.x - mouth.x, tb.pos.y - mouth.y));
      touched ||= sim.events.length > 0 && sim.events.some((e) => e.type === 'ball');
      if (touched) travel += Math.hypot(cb.pos.x - px, cb.pos.y - py);
      px = cb.pos.x;
      py = cb.pos.y;
    }
    if (isMoving(sim)) return 'done';
    const duration = sim.time;
    const first = sim.events.find((e) => e.type === 'ball');
    const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
    const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
    const v = judgeShot(state, target, { firstHit, potted, after: [] });
    // not potted: another aim point helps only when the ball got near the pocket (else the power is wrong)
    if (v.result !== 'success') return tb.potted || closest < Sv.aimRetryWithin ? 'miss' : 'done';
    if (opts.maxDuration !== undefined && duration > opts.maxDuration) return 'done';
    const type = classifySuccess({ state: state.balls, target, potted: v.potted, aimedPocket: pocket, events: sim.events, table });
    if (!ex && isExhibition(type)) return 'miss'; // a player would not have meant it
    if (opts.naturalOnly && !NATURAL_TYPES.includes(type)) return 'miss';
    const cueEnd = sim.balls.find((b) => b.kind === 'cue')!.pos;
    const after: Ball[] = sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: b.pos }));
    // score = shot length + position weight x how hard the next shot looks from where the cue ball stopped
    let cost = 0;
    if (nexts.length) {
      if (state.phase === 'colour' && state.redsLeft > 0) {
        const c = target as (typeof CONFIG.finalColourOrder)[number];
        after.push({ id: c, kind: c, pos: { ...table.spots[c] } }); // re-spotted (approximately: own spot)
      }
      cost = Math.min(...nexts.map((n) => nextShotCost(cueEnd, after, n.kind, table, opts.redPlay ?? true) + n.extra)) + zoneCost(cueEnd, after, table);
    }
    // a shot over the pace target (shot.maxDuration) pays heavily per extra second, so position play chooses among
    // shots that are themselves short; the quickest shot still wins when none is short
    const over = Math.max(0, duration - (opts.overFrom ?? Sv.position.overFrom)) * Sv.position.overPenalty;
    // lookahead (config solver.lookahead): a pot that leaves no open pocket for the next ball always loses to one
    // that does (it would make the next step a re-rack or a long fallback)
    const dead = nexts.length && Sv.lookahead > 0 && cost >= Sv.position.noShotCost ? Sv.position.deadPenalty : 0;
    // naturalness (task 4.7): the pot itself, medium power, the kind of shot, and opening the pack in time
    const closed = target !== 'red' && state.redsLeft > 1 ? packLeftClosed(after, r) * NAT.packClosedCost : 0;
    // only locked reds left (no pocket can take any of them): a dead end, only a cannon frees them (RE-RACK risk)
    const locked = Sv.position.lockedCost ? allRedsLocked(after, table) * Sv.position.lockedCost : 0;
    const whyNot = naturalCheck(type, { state: state.balls, target, potted: v.potted, aimedPocket: pocket, events: sim.events, table,
      duration, cueTravel: travel, after });
    if (opts.naturalOnly && whyNot !== null) return 'done';
    // task 4.10: a long colour pot must not send the cue ball into another ball (like a yellow off its spot)
    const longMoves = TC.enabled && target !== 'red' && type === 'long' && state.balls.some((b) => {
      if (b.kind === 'cue' || b.id === v.potted) return false;
      const a = after.find((x) => x.id === b.id);
      return !a || Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) > NAT.disturbFrom;
    }) ? TC.longDisturbCost : 0;
    const natural = pairCost + powerCost(speed) + typeCost(type) + closed + longMoves + (whyNot && NATURAL_TYPES.includes(type) ? NAT.unnaturalPlayCost : 0);
    const score = duration + over + dead + (opts.weight ?? Sv.position.weight) * (cost + locked) + NAT.weight * natural;
    if (best && score >= best.score + M) return 'done';
    const pottedIn = sim.events.find((e) => e.type === 'pot' && e.a === v.potted);
    const shot: SolvedShot = { target: v.potted, pocket: pottedIn && pottedIn.type === 'pot' ? pottedIn.pocket : pocket, dir, speed,
      spin, duration, computeMs: 0, tried: 0, score, nextCost: nexts.length ? cost : null, cueEnd: { ...cueEnd }, type, natural, whyNot,
      aim: { ball: ballId, pocket },
      ...(locked ? { lockedReds: true } : {}) };
    cands.push(shot);
    if (!best || score < best.score) best = shot;
    return 'done';
  };
  // Order (task 4.7): for each pot, each power and spin, the aim points across the mouth are tried only until one
  // pots. So the budget covers several pots (balls and pockets), not one pot at every aim point: real position play.
  search: for (const { ball, pocket, score: pairCost } of pairs) {
    const p = table.pockets.find((q) => q.id === pocket)!;
    const left = { x: -p.inward.y, y: p.inward.x };
    const aims: Vec2[][] = []; // aims[k][j]: aim point k across the mouth, direction j (0 = straight, 1-4 = off a cushion)
    for (let k = 0; k < aimSamples; k++) {
      const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * aimStep; // 0, -1, +1, -2, +2 ... steps across the mouth
      if (Math.abs(off) > half * aimStep + 1e-9) continue;
      const tgt = { x: p.mouthMid.x + left.x * off, y: p.mouthMid.y + left.y * off };
      const toP = { x: tgt.x - ball.pos.x, y: tgt.y - ball.pos.y };
      const d = Math.hypot(toP.x, toP.y);
      const ghost = { x: ball.pos.x - (toP.x / d) * 2 * r, y: ball.pos.y - (toP.y / d) * 2 * r };
      const dirs = [{ x: ghost.x - cue.pos.x, y: ghost.y - cue.pos.y }];
      if (ex) {
        // cushion first: aim at the ghost ball's mirror image in each cushion line (the physics checks the real path)
        const X = table.halfWidth - r;
        const Y = table.halfLength - r;
        for (const m of [{ x: 2 * X - ghost.x, y: ghost.y }, { x: -2 * X - ghost.x, y: ghost.y },
          { x: ghost.x, y: 2 * Y - ghost.y }, { x: ghost.x, y: -2 * Y - ghost.y }]) dirs.push({ x: m.x - cue.pos.x, y: m.y - cue.pos.y });
      }
      aims.push(dirs);
    }
    for (let j = 0; j < aims[0]!.length; j++) {
      for (const speed of powers) {
        for (const spin of spins) {
          for (const dirs of aims) {
            if (tried >= shotBudget) { if (info) info.timedOut = true; break search; } // a shot count: same on every device
            if (trySim(dirs[j]!, speed, spin, pocket, pairCost, ball.id, p.mouthMid) === 'done') break;
          }
          if (opts.firstFound && best) break search;
        }
      }
    }
  }
  // lookahead (config solver.lookahead, RULES D: avoid re-racks): the next step must stay solvable (no exhibition
  // shot needed). The best candidates are checked in order by really solving the next shot from where they leave the balls
  // (small budget, first success found; after a red: black, else pink, else blue). If none passes, the best is kept.
  if (best && nexts.length && (opts.lookahead ?? Sv.lookahead > 0)) {
    const order: SolvedShot[] = [];
    const rescue = !!opts.rescue;
    let rescueOk: SolvedShot | null = null;
    for (const c of cands.filter((x) => rescue || x.score < best!.score + M).sort((a, b) => a.score - b.score)) {
      if (order.length >= (rescue ? Sv.rescue.candidates : plan ? (planRed ? Sv.lookaheadCandidates : NAT.planCandidates) : Sv.lookaheadCandidates)) break;
      if (order.every((o) => Math.hypot(o.cueEnd.x - c.cueEnd.x, o.cueEnd.y - c.cueEnd.y) >= Sv.lookaheadSpread)) order.push(c);
    }
    let planned: { shot: SolvedShot; total: number; natural: boolean } | null = null;
    // task 4.10: in red planning, is the black or the pink natural after the best planned red? If no checked red leaves
    // one, a few more reds are checked (cue ball stopping elsewhere)
    let plannedTop = false;
    const extra = planRed && TC.enabled ? cands.filter((x) => x.score < best!.score + M && !order.includes(x)).sort((a, b) => a.score - b.score) : [];
    for (let oi = 0; oi < order.length; oi++) {
      const c = order[oi]!;
      tried++; // simulating where this candidate leaves the balls is one more shot
      const sim = createSim(state.balls, table, cfg);
      strike(sim, 'cue', c.dir, c.speed, c.spin);
      runUntilStill(sim);
      const first = sim.events.find((e) => e.type === 'ball');
      const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
      const nextState = applyShot(state, target, { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
        after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) }, table);
      if (rescue) {
        // any pot of the next ball at all (exhibition shots allowed): the next step is no RE-RACK
        let ok = false;
        for (const n of nexts) {
          const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
          const s = solveSuccess(nextState, n.kind, table, now, cfg, Sv.rescue.lookaheadShots, i,
            { position: false, lookahead: false, firstFound: true, exhibition: true });
          tried += i.tried;
          if (s) { ok = true; break; }
        }
        if (ok && (!c.lockedReds || !rescueOk)) rescueOk = { ...c, lookahead: 'ok' };
        if (rescueOk && !rescueOk.lockedReds) break;
        continue;
      }
      if (plan) {
        // two shots ahead (task 4.7): really solve the red after this colour, with position play, and score the pair
        // (after a red: each auto colour, black / pink / blue, with its extra position cost)
        let mine: { total: number; natural: boolean } | null = null;
        let top = false; // black or pink natural after this red (task 4.10)
        for (const n of planRed ? nexts : [{ kind: 'red' as BallKind, extra: 0 }]) {
          const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
          const s = solveSuccess(nextState, n.kind, table, now, cfg, Sv.lookaheadShots, i,
            { lookahead: false, maxDuration: CONFIG.shot.maxDurationFlex, redPlay: !planRed || RP.inRedLookahead });
          tried += i.tried;
          if (!s) continue;
          // the auto pick (RULES B.3) takes the black or pink only if it is natural AND leaves a natural red: check that
          if (planRed && TC.enabled && !top && s.whyNot === null && (n.kind === 'black' || n.kind === 'pink')) {
            const sim2 = createSim(nextState.balls, table, cfg);
            strike(sim2, 'cue', s.dir, s.speed, s.spin);
            runUntilStill(sim2);
            tried++;
            const f2 = sim2.events.find((e) => e.type === 'ball');
            const fh2 = f2 && f2.type === 'ball' ? (f2.a === 'cue' ? f2.b : f2.a) : null;
            const s3 = applyShot(nextState, n.kind, { firstHit: fh2, potted: sim2.balls.filter((b) => b.potted).map((b) => b.id),
              after: sim2.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) }, table);
            const i3: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
            const red = solveSuccess(s3, 'red', table, now, cfg, TC.redCheckShots, i3,
              { position: false, lookahead: false, firstFound: true, maxDuration: CONFIG.shot.maxDurationFlex, naturalOnly: true });
            tried += i3.tried;
            if (red) top = true;
          }
          const total = c.score + NAT.planWeight * (s.score + n.extra + (s.whyNot === null ? 0 : NAT.unnaturalPlayCost));
          if (!mine || total < mine.total) mine = { total, natural: s.whyNot === null };
        }
        if (mine) {
          const total = mine.total + (planRed && TC.enabled && !top ? TC.noNaturalCost : 0);
          if (!planned || total < planned.total) { planned = { shot: c, total, natural: mine.natural }; plannedTop = top; }
        }
        // no checked red leaves a natural black or pink yet: check a few more (spread apart like the first ones)
        if (oi === order.length - 1 && planRed && TC.enabled && !plannedTop && order.length < Sv.lookaheadCandidates + TC.extraCandidates) {
          const more = extra.find((x) => !order.includes(x) && order.every((o) => Math.hypot(o.cueEnd.x - x.cueEnd.x, o.cueEnd.y - x.cueEnd.y) >= Sv.lookaheadSpread));
          if (more) order.push(more);
        }
        continue;
      }
      let ok = false;
      for (const n of nexts) {
        const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
        const s = solveSuccess(nextState, n.kind, table, now, cfg, Sv.lookaheadShots, i,
          { position: false, lookahead: false, firstFound: true, maxDuration: CONFIG.shot.maxDurationFlex, naturalOnly: NAT.lookaheadNatural });
        tried += i.tried;
        if (s) { ok = true; break; }
      }
      if (ok) { best = { ...c, lookahead: 'ok' }; break; }
    }
    if (planned) best = { ...planned.shot, lookahead: 'ok', nextNatural: planned.natural };
    if (rescueOk) best = rescueOk;
    if (best.lookahead !== 'ok') best = { ...best, lookahead: 'failed' };
  }
  if (best) best = { ...best, computeMs: now() - t0, tried };
  if (info) { info.pairs = pairs.length; info.tried = tried; }
  return best;
}

/** Natural by the strict check (owner 2026-11-24): used for the automatic colour (RULES B.3) and the break library. */
export const isNaturalShot = (s: SolvedShot | null): boolean => !!s && s.whyNot === null;

/**
 * RULES B.3 (owner 2026-11-24): until the colour-choice stage the game picks the colour: black when it has a natural
 * shot, else pink, else blue; if none has one, the first with any shot in time, else black (flex chain, RULES D.5). It depends only on the layout,
 * never on the decided outcome, and changes only the snooker score. `normal` is the chosen colour's normal search.
 */
export function chooseAutoColour(state: FrameState, table: TableGeometry, now: () => number, cfg: PhysicsConfig = CONFIG.physics):
  { colour: Colour; normal: SolvedShot | null; tried: number } {
  let tried = 0;
  const all: { colour: Colour; normal: SolvedShot | null }[] = [];
  for (const c of NAT.autoColours) {
    const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
    const s = solveSuccess(state, c, table, now, cfg, Sv.shotBudget, i);
    tried += i.tried;
    // RULES B.3 (owner confirmed 2026-11-24): natural means a natural colour that also leaves a natural red
    if (isNaturalShot(s) && (!NAT.autoColourNeedsNextRed || (s!.lookahead !== 'failed' && s!.nextNatural !== false && !s!.lockedReds))) return { colour: c, normal: s, tried };
    all.push({ colour: c, normal: s });
  }
  // no natural shot on any of them: the first with a shot in time that keeps the next step solvable, else black
  const inTime = all.find((a) => a.normal && a.normal.lookahead !== 'failed' && !a.normal.lockedReds && a.normal.duration <= CONFIG.shot.maxDurationFlex);
  if (inTime) return { ...inTime, tried };
  // night 2026-11-24 (soak reds10-5000066 step 16): no colour keeps the next red reachable -> rescue search for each
  // colour in order (RULES D: avoid RE-RACK); the first that leaves a red pottable by any shot is picked (layout only)
  if (Sv.rescue.enabled) {
    // all three are tried; a natural one first, then one in time, then the order black, pink, blue
    const rank = (x: SolvedShot) => (x.whyNot === null ? 0 : 2) + (x.duration <= CONFIG.shot.maxDurationFlex ? 0 : 1);
    let pick: { colour: Colour; normal: SolvedShot } | null = null;
    for (const c of NAT.autoColours) {
      const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
      const res = solveSuccess(state, c, table, now, cfg, Sv.wide.shotBudget, i, { wide: true, rescue: true });
      tried += i.tried;
      if (res && res.lookahead === 'ok' && !res.lockedReds && (!pick || rank(res) < rank(pick.normal))) pick = { colour: c, normal: res };
    }
    if (pick) return { ...pick, tried };
  }
  const natural = all.find((a) => isNaturalShot(a.normal)); // no colour leaves a red: a natural colour shot anyway
  if (natural) return { ...natural, tried };
  const ok = all.find((a) => a.normal); // black with no shot at all: pink or blue with any shot (avoids a RE-RACK)
  return { ...(ok ?? all[0]!), tried };
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

// ---------------- spray search (last step before RE-RACK) ----------------

/**
 * When the normal and wide searches find nothing (typically: the last reds still in a cluster), aim at many points
 * across the whole width of every target ball, straight and off each cushion, with firm powers: a firm hit into a
 * cluster often pots a ball. The physics and the rules code decide. Quickest success wins (no position play).
 */
export function solveSpray(state: FrameState, target: BallKind, table: TableGeometry, cfg: PhysicsConfig = CONFIG.physics,
  shotBudget: number = Sv.spray.shotBudget, info?: SolveInfo): SolvedShot | null {
  const r = table.ballRadius;
  const cue = state.balls.find((b) => b.kind === 'cue')!.pos;
  const X = table.halfWidth - r;
  const Y = table.halfLength - r;
  let best: SolvedShot | null = null;
  let tried = 0;
  search: for (const ball of state.balls.filter((b) => b.kind === target)) {
    const p = ball.pos;
    for (const m of [p, { x: 2 * X - p.x, y: p.y }, { x: -2 * X - p.x, y: p.y }, { x: p.x, y: 2 * Y - p.y }, { x: p.x, y: -2 * Y - p.y }]) {
      const d = { x: m.x - cue.x, y: m.y - cue.y };
      const len = Math.hypot(d.x, d.y);
      const side = { x: -d.y / len, y: d.x / len };
      for (const f of Sv.spray.offsets) {
        const dir = { x: d.x + side.x * f * 2 * r, y: d.y + side.y * f * 2 * r }; // across the full width of the ball
        for (const speed of Sv.spray.speeds) {
          for (const spin of Sv.spray.spins) {
            if (tried >= shotBudget) break search;
            tried++;
            const sim = createSim(state.balls, table, cfg);
            strike(sim, 'cue', dir, speed, spin);
            const limit = Math.ceil((best ? best.duration : cfg.maxSimSeconds) / cfg.timestep);
            for (let n = 0; n < limit && isMoving(sim); n++) stepSim(sim);
            if (isMoving(sim)) continue;
            const first = sim.events.find((e) => e.type === 'ball');
            const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
            const v = judgeShot(state, target, { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id), after: [] });
            if (v.result !== 'success') continue;
            const pot = sim.events.find((e) => e.type === 'pot' && e.a === v.potted);
            const type = classifySuccess({ state: state.balls, target, potted: v.potted, aimedPocket: null, events: sim.events, table });
            best = { target: v.potted, pocket: pot && pot.type === 'pot' ? pot.pocket : table.pockets[0]!.id, dir, speed, spin,
              duration: sim.time, score: sim.time, nextCost: null, cueEnd: { ...sim.balls.find((b) => b.kind === 'cue')!.pos },
              computeMs: 0, tried: 0, type, natural: typeCost(type), whyNot: 'spray' };
          }
        }
      }
    }
  }
  if (info) info.tried = tried;
  return best && { ...best, tried };
}

/**
 * Night 2026-11-24 (soak reds6-5000614 step 11): object-ball doubles, the last search before the spray. A red glued to
 * the pink spot (or to another ball) cannot go straight into any pocket, but it can go off a cushion: aim the object
 * ball at the pocket's mirror image in each cushion line, at a few points across the mouth.
 */
export function solveDoubles(state: FrameState, target: BallKind, table: TableGeometry, cfg: PhysicsConfig = CONFIG.physics,
  shotBudget: number = Sv.doubles.shotBudget, info?: SolveInfo): SolvedShot | null {
  const r = table.ballRadius;
  const cue = state.balls.find((b) => b.kind === 'cue')!.pos;
  const X = table.halfWidth - r;
  const Y = table.halfLength - r;
  let best: SolvedShot | null = null;
  let tried = 0;
  search: for (const ball of state.balls.filter((b) => b.kind === target)) {
    const p = ball.pos;
    for (const pk of table.pockets) {
      const m = pk.mouthMid;
      for (const mir of [{ x: 2 * X - m.x, y: m.y }, { x: -2 * X - m.x, y: m.y }, { x: m.x, y: 2 * Y - m.y }, { x: m.x, y: -2 * Y - m.y }]) {
        for (const off of Sv.doubles.offsets) {
          const t = { x: mir.x - p.x, y: mir.y - p.y };
          const tl = Math.hypot(t.x, t.y);
          const aim = { x: mir.x - (t.y / tl) * off, y: mir.y + (t.x / tl) * off };
          const d = { x: aim.x - p.x, y: aim.y - p.y };
          const dl = Math.hypot(d.x, d.y);
          const ghost = { x: p.x - (d.x / dl) * 2 * r, y: p.y - (d.y / dl) * 2 * r };
          // the cue ball must be able to reach the ghost-ball spot
          if (state.balls.some((o) => o.kind !== 'cue' && o.id !== ball.id && Math.hypot(o.pos.x - ghost.x, o.pos.y - ghost.y) < 2 * r)) continue;
          if (Math.abs(ghost.x) > X || Math.abs(ghost.y) > Y) continue;
          if (!pathClear(cue, ghost, state.balls, ['cue', ball.id], r)) continue;
          const dir = { x: ghost.x - cue.x, y: ghost.y - cue.y };
          for (const speed of Sv.doubles.speeds) {
            for (const spin of Sv.doubles.spins) {
              if (tried >= shotBudget) break search;
              tried++;
              const sim = createSim(state.balls, table, cfg);
              strike(sim, 'cue', dir, speed, spin);
              const limit = Math.ceil((best ? best.duration : cfg.maxSimSeconds) / cfg.timestep);
              for (let n = 0; n < limit && isMoving(sim); n++) stepSim(sim);
              if (isMoving(sim)) continue;
              const first = sim.events.find((e) => e.type === 'ball');
              const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
              const v = judgeShot(state, target, { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id), after: [] });
              if (v.result !== 'success') continue;
              const pot = sim.events.find((e) => e.type === 'pot' && e.a === v.potted);
              const type = classifySuccess({ state: state.balls, target, potted: v.potted, aimedPocket: null, events: sim.events, table });
              best = { target: v.potted, pocket: pot && pot.type === 'pot' ? pot.pocket : pk.id, dir, speed, spin,
                duration: sim.time, score: sim.time, nextCost: null, cueEnd: { ...sim.balls.find((b) => b.kind === 'cue')!.pos },
                computeMs: 0, tried: 0, type, natural: typeCost(type), whyNot: 'double', aim: { ball: ball.id, pocket: pk.id } };
            }
          }
        }
      }
    }
  }
  if (info) info.tried = tried;
  return best && { ...best, tried };
}

// ---------------- flex chain and fallback log (task 4.5, 4.7, RULES D.3 / D.4) ----------------

export type FlexLevel = 'normal' | 'longerDuration' | 'wideSearch' | 'rescue' | 'overLong' | 'exhibition' | 'doubles' | 'spray' | 'reRack';
export interface FallbackLogEntry { roundCode: string; step: number; target: BallKind; level: FlexLevel | 'noLookahead'; tried: number }
/** tried: every shot simulated for this decision (search, lookahead checks, wide search, exhibition, spray); never
 *  above shotCaps().success (plus shotCaps().colourPick when the colour was picked automatically). */
export interface FlexResult { shot: SolvedShot | null; level: FlexLevel; log: FallbackLogEntry | null; tried: number }

/**
 * Fixed caps on the work per decision, counted in simulated shots (not ms), so every device does the same work and
 * picks the same shot. A success solve: normal search + its lookahead checks (each candidate: 1 shot to see where it
 * leaves the balls + a small search of the next step, after a red for black, pink and blue), then the same for the
 * wide search and the exhibition search, then the spray. On a colour step the automatic colour pick (RULES B.3) may
 * first run the normal search for pink and blue too. A failure solve: the chosen type, a plain miss, the soft foul and
 * the gentle tap. While the player decides, both outcomes are solved.
 */
/**
 * Night 2026-11-25: can the ball due after `shot` be potted by any shot at all (exhibition and cushion-first allowed)?
 * Used for the last-resort shots, so that a RE-RACK is not just pushed one step on. Shot count: config lastResortCheck.
 */
export function nextReachable(state: FrameState, target: BallKind, shot: SolvedShot, table: TableGeometry, now: () => number,
  cfg: PhysicsConfig = CONFIG.physics): { ok: boolean; tried: number } {
  const nexts = nextTargetsAfter(state, target);
  let tried = 1;
  const sim = createSim(state.balls, table, cfg);
  strike(sim, 'cue', shot.dir, shot.speed, shot.spin);
  runUntilStill(sim);
  const first = sim.events.find((e) => e.type === 'ball');
  const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
  const nextState = applyShot(state, target, { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
    after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) }, table);
  if (!nexts.length) return { ok: true, tried };
  for (const n of nexts) {
    const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
    const s = solveSuccess(nextState, n.kind, table, now, cfg, Sv.lastResortCheck.shotBudget, i,
      { position: false, lookahead: false, firstFound: true, exhibition: true });
    tried += i.tried;
    if (s) return { ok: true, tried };
  }
  return { ok: false, tried };
}

export function shotCaps() {
  const look = Sv.lookaheadCandidates * (1 + Sv.lookaheadShots * NAT.autoColours.length);
  const normal = Sv.shotBudget + look;
  const wide = Sv.wide.shotBudget + look;
  const exhibition = Sv.exhibition.shotBudget + look;
  const rescue = Sv.rescue.enabled ? Sv.wide.shotBudget + Sv.rescue.candidates * (1 + Sv.rescue.lookaheadShots * NAT.autoColours.length) : 0;
  // + up to three last-resort checks (exhibition, doubles, spray), each a shot plus one search per next ball
  const lastResort = Sv.lastResortCheck.enabled ? 3 * (1 + NAT.autoColours.length * Sv.lastResortCheck.shotBudget) : 0;
  const success = normal + wide + rescue + exhibition + Sv.doubles.shotBudget + Sv.spray.shotBudget + lastResort;
  const colourPick = (NAT.autoColours.length - 1) * normal + NAT.autoColours.length * rescue; // + the rescue per colour
  const failure = 2 * Sv.shotBudget + CONFIG.solver.failure.softFoulMaxShots + CONFIG.solver.failure.tapDirections;
  return { normal, wide, rescue, exhibition, doubles: Sv.doubles.shotBudget, spray: Sv.spray.shotBudget, lastResort, success, colourPick, failure, decision: success + colourPick + failure };
}

/**
 * A decided SUCCESS (the outcome never changes), most natural first (task 4.7):
 * 1. normal search: up to shot.maxDuration 'normal', up to shot.maxDurationFlex 'longerDuration';
 * 2. wide search (more aims, powers, spins; still natural shots only), within maxDurationFlex;
 * 3. 'overLong': the shortest natural shot found, longer than maxDurationFlex (owner: a long shot is still a shot);
 * 4. 'exhibition': cushion-first, plants, doubles, kisses, far pockets, flukes (rare, last resort);
 * 5. 'spray': many aim points across each ball, straight and off each cushion; 6. RE-RACK.
 * Every step other than 'normal' returns a log entry (RULES D: logged with the round code and step).
 * `pre`: the normal search already done (by the automatic colour pick).
 */
export function solveSuccessFlex(state: FrameState, target: BallKind, table: TableGeometry, now: () => number,
  ctx: { roundCode: string; step: number }, cfg: PhysicsConfig = CONFIG.physics,
  pre?: { normal: SolvedShot | null; tried: number }): FlexResult {
  const flex = CONFIG.shot.maxDurationFlex;
  const log = (level: FlexLevel | 'noLookahead', tried: number): FallbackLogEntry => ({ ...ctx, target, level, tried });
  // a shot whose lookahead failed (the next step looked unsolvable) is only used when nothing better exists
  const good = (s: SolvedShot | null) => !!s && s.lookahead !== 'failed' && !s.lockedReds;
  let tried = pre?.tried ?? 0;
  const out = (shot: SolvedShot | null, level: FlexLevel, logLevel: FlexLevel | 'noLookahead' | null): FlexResult =>
    ({ shot: shot && { ...shot, tried }, level, log: logLevel ? log(logLevel, tried) : null, tried });
  const run = (budget: number, opts: SolveOptions) => {
    const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
    const s = solveSuccess(state, target, table, now, cfg, budget, i, opts);
    tried += i.tried;
    return s;
  };
  let normal = pre ? pre.normal : run(Sv.shotBudget, {});
  let wideDone: SolvedShot | null | undefined; // the wide search runs at most once per decision (shot cap)
  // task 4.7: a colour pot that leaves a poor next red (long, in the pack): the wide search (more spins and powers,
  // cannons into the pack) looks for better position; the better score wins
  if (good(normal) && (target !== 'red' ? state.redsLeft > 0 : NAT.wideForPoorColour) && (normal!.nextCost ?? 0) >= NAT.poorNextCost) {
    const w = (wideDone = run(Sv.wide.shotBudget, { wide: true }));
    if (good(w) && w!.duration <= flex && w!.score < normal!.score) normal = w;
  }
  if (good(normal) && normal!.duration <= CONFIG.shot.maxDuration) return out(normal, 'normal', null);
  if (good(normal) && normal!.duration <= flex) return out(normal, 'longerDuration', 'longerDuration');
  const wide = wideDone !== undefined ? wideDone : run(Sv.wide.shotBudget, { wide: true });
  if (good(wide) && wide!.duration <= flex) return out(wide, 'wideSearch', 'wideSearch');
  const found = [normal, wide].filter((x): x is SolvedShot => x !== null);
  // prefer a shot that keeps the next step solvable, then the shortest
  found.sort((a, b) => Number(a.whyNot !== null) - Number(b.whyNot !== null) ||
    Number(a.lookahead === 'failed') - Number(b.lookahead === 'failed') ||
    Number(!!a.lockedReds) - Number(!!b.lockedReds) || a.duration - b.duration);
  let pick = found[0];
  // night 2026-11-24: every shot found leaves the next ball unreachable -> rescue search (RE-RACK avoidance)
  if (Sv.rescue.enabled && !found.some(good)) {
    const res = run(Sv.wide.shotBudget, { wide: true, rescue: true });
    if (res && res.lookahead === 'ok' && (!res.lockedReds || !pick || pick.lockedReds || pick.lookahead === 'failed')) return out(res, 'rescue', 'rescue');
    if (!pick && res) pick = res;
  }
  // realism first (owner, task 4.7): any natural shot, even long or with a doubtful next step, before an exhibition one
  if (pick && pick.duration <= flex) return out(pick, pick === wide ? 'wideSearch' : 'longerDuration', 'noLookahead');
  if (pick) return out(pick, 'overLong', 'overLong');
  const exh = run(Sv.exhibition.shotBudget, { exhibition: true });
  // night 2026-11-25 (soak reds10-5001536 step 17): a last-resort shot that leaves no ball pottable at all only makes
  // the RE-RACK one step later. Then doubles and spray are tried too; the first that leaves a pottable ball wins.
  const reach = (s: SolvedShot) => { const x = nextReachable(state, target, s, table, now, cfg); tried += x.tried; return x.ok; };
  const lastCheck = Sv.lastResortCheck.enabled;
  if (exh && (!lastCheck || exh.lookahead !== 'failed' || reach(exh))) return out(exh, 'exhibition', 'exhibition');
  const di: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
  const dbl = solveDoubles(state, target, table, cfg, Sv.doubles.shotBudget, di);
  tried += di.tried;
  if (dbl && (!lastCheck || !exh || reach(dbl))) return out(dbl, 'doubles', 'doubles');
  const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
  const spray = solveSpray(state, target, table, cfg, Sv.spray.shotBudget, i);
  tried += i.tried;
  if (spray && (!lastCheck || !(exh || dbl) || reach(spray))) return out(spray, 'spray', 'spray');
  const any = exh ?? dbl ?? spray; // none leaves a pottable ball: the first one anyway (a RE-RACK later is still possible)
  if (any) return out(any, any === exh ? 'exhibition' : any === dbl ? 'doubles' : 'spray', any === exh ? 'exhibition' : any === dbl ? 'doubles' : 'spray');
  return out(null, 'reRack', 'reRack');
}

export * from './solverFailure';
