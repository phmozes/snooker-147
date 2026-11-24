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
import { angleCost, classifySuccess, cutAngle, isExhibition, NATURAL_TYPES, packLeftClosed, potCost, powerCost, typeCost,
  type ShotType } from './shotType';
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
  computeMs: number;
  tried: number; // shots simulated
  type: ShotType; // what kind of shot it is (task 4.7)
  natural: number; // naturalness cost (0 = what a professional would play)
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

export function nextShotCost(cue: Vec2, balls: Ball[], next: BallKind, table: TableGeometry): number {
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
      best = Math.min(best, angleCost(cut) + (dA + dP) / 2 + (touching ? NAT.touchingCost : 0) + long);
    }
  }
  return best;
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
      pairs.push({ ball, pocket: p.id, score: potCost(cue.pos, ball, p.mouthMid, state.balls, r) });
    }
  }
  pairs.sort((a, b) => a.score - b.score);

  let best: SolvedShot | null = null;
  // every success within lookaheadMargin of the best score (the lookahead checks the best ones that leave the cue
  // ball in clearly different places, task 4.7)
  const cands: SolvedShot[] = [];
  const M = Sv.lookaheadMargin;
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
    let closest = Infinity; // how near the aimed ball came to the pocket mouth
    for (let n = 0; n < limit && isMoving(sim); n++) {
      stepSim(sim);
      if (!tb.potted) closest = Math.min(closest, Math.hypot(tb.pos.x - mouth.x, tb.pos.y - mouth.y));
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
      cost = Math.min(...nexts.map((n) => nextShotCost(cueEnd, after, n.kind, table) + n.extra));
    }
    // a shot over the pace target (shot.maxDuration) pays heavily per extra second, so position play chooses among
    // shots that are themselves short; the quickest shot still wins when none is short
    const over = Math.max(0, duration - (opts.overFrom ?? Sv.position.overFrom)) * Sv.position.overPenalty;
    // lookahead (config solver.lookahead): a pot that leaves no open pocket for the next ball always loses to one
    // that does (it would make the next step a re-rack or a long fallback)
    const dead = nexts.length && Sv.lookahead > 0 && cost >= Sv.position.noShotCost ? Sv.position.deadPenalty : 0;
    // naturalness (task 4.7): the pot itself, medium power, the kind of shot, and opening the pack in time
    const closed = target !== 'red' && state.redsLeft > 1 ? packLeftClosed(after, r) * NAT.packClosedCost : 0;
    const natural = pairCost + powerCost(speed) + typeCost(type) + closed;
    const score = duration + over + dead + (opts.weight ?? Sv.position.weight) * cost + NAT.weight * natural;
    if (best && score >= best.score + M) return 'done';
    const pottedIn = sim.events.find((e) => e.type === 'pot' && e.a === v.potted);
    const shot: SolvedShot = { target: v.potted, pocket: pottedIn && pottedIn.type === 'pot' ? pottedIn.pocket : pocket, dir, speed,
      spin, duration, computeMs: 0, tried: 0, score, nextCost: nexts.length ? cost : null, cueEnd: { ...cueEnd }, type, natural };
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
    for (const c of cands.filter((x) => x.score < best!.score + M).sort((a, b) => a.score - b.score)) {
      if (order.length >= Sv.lookaheadCandidates) break;
      if (order.every((o) => Math.hypot(o.cueEnd.x - c.cueEnd.x, o.cueEnd.y - c.cueEnd.y) >= Sv.lookaheadSpread)) order.push(c);
    }
    for (const c of order) {
      tried++; // simulating where this candidate leaves the balls is one more shot
      const sim = createSim(state.balls, table, cfg);
      strike(sim, 'cue', c.dir, c.speed, c.spin);
      runUntilStill(sim);
      const first = sim.events.find((e) => e.type === 'ball');
      const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
      const nextState = applyShot(state, target, { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
        after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) }, table);
      let ok = false;
      for (const n of nexts) {
        const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
        const s = solveSuccess(nextState, n.kind, table, now, cfg, Sv.lookaheadShots, i,
          { position: false, lookahead: false, firstFound: true, maxDuration: CONFIG.shot.maxDurationFlex });
        tried += i.tried;
        if (s) { ok = true; break; }
      }
      if (ok) { best = { ...c, lookahead: 'ok' }; break; }
    }
    if (best.lookahead !== 'ok') best = { ...best, lookahead: 'failed' };
  }
  if (best) best = { ...best, computeMs: now() - t0, tried };
  if (info) { info.pairs = pairs.length; info.tried = tried; }
  return best;
}

/** Natural enough to be the automatic colour (RULES B.3): a plain pot or a planned cannon, within maxDurationFlex. */
export const isNaturalShot = (s: SolvedShot | null): boolean =>
  !!s && s.duration <= CONFIG.shot.maxDurationFlex && NATURAL_TYPES.includes(s.type);

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
    if (isNaturalShot(s)) return { colour: c, normal: s, tried };
    all.push({ colour: c, normal: s });
  }
  // no natural shot on any of them: the first with a shot in time that keeps the next step solvable, else black
  const ok = all.find((a) => a.normal && a.normal.lookahead !== 'failed' && a.normal.duration <= CONFIG.shot.maxDurationFlex);
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
              computeMs: 0, tried: 0, type, natural: typeCost(type) };
          }
        }
      }
    }
  }
  if (info) info.tried = tried;
  return best && { ...best, tried };
}

// ---------------- flex chain and fallback log (task 4.5, 4.7, RULES D.3 / D.4) ----------------

export type FlexLevel = 'normal' | 'longerDuration' | 'wideSearch' | 'overLong' | 'exhibition' | 'spray' | 'reRack';
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
export function shotCaps() {
  const look = Sv.lookaheadCandidates * (1 + Sv.lookaheadShots * NAT.autoColours.length);
  const normal = Sv.shotBudget + look;
  const wide = Sv.wide.shotBudget + look;
  const exhibition = Sv.exhibition.shotBudget + look;
  const success = normal + wide + exhibition + Sv.spray.shotBudget;
  const colourPick = (NAT.autoColours.length - 1) * normal;
  const failure = 2 * Sv.shotBudget + CONFIG.solver.failure.softFoulMaxShots + CONFIG.solver.failure.tapDirections;
  return { normal, wide, exhibition, spray: Sv.spray.shotBudget, success, colourPick, failure, decision: success + colourPick + failure };
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
  const good = (s: SolvedShot | null) => !!s && s.lookahead !== 'failed';
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
  if (good(normal) && target !== 'red' && state.redsLeft > 0 && (normal!.nextCost ?? 0) >= NAT.poorNextCost) {
    const w = (wideDone = run(Sv.wide.shotBudget, { wide: true }));
    if (good(w) && w!.duration <= flex && w!.score < normal!.score) normal = w;
  }
  if (good(normal) && normal!.duration <= CONFIG.shot.maxDuration) return out(normal, 'normal', null);
  if (good(normal) && normal!.duration <= flex) return out(normal, 'longerDuration', 'longerDuration');
  const wide = wideDone !== undefined ? wideDone : run(Sv.wide.shotBudget, { wide: true });
  if (good(wide) && wide!.duration <= flex) return out(wide, 'wideSearch', 'wideSearch');
  const found = [normal, wide].filter((x): x is SolvedShot => x !== null);
  // prefer a shot that keeps the next step solvable, then the shortest
  found.sort((a, b) => Number(a.lookahead === 'failed') - Number(b.lookahead === 'failed') || a.duration - b.duration);
  const pick = found[0];
  // realism first (owner, task 4.7): any natural shot, even long or with a doubtful next step, before an exhibition one
  if (pick && pick.duration <= flex) return out(pick, pick === wide ? 'wideSearch' : 'longerDuration', 'noLookahead');
  if (pick) return out(pick, 'overLong', 'overLong');
  const exh = run(Sv.exhibition.shotBudget, { exhibition: true });
  if (exh) return out(exh, 'exhibition', 'exhibition');
  const i: SolveInfo = { pairs: 0, tried: 0, timedOut: false };
  const spray = solveSpray(state, target, table, cfg, Sv.spray.shotBudget, i);
  tried += i.tried;
  if (spray) return out(spray, 'spray', 'spray');
  return out(null, 'reRack', 'reRack');
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
  cfg: PhysicsConfig, shotBudget: number, count: { tried: number }): SolvedFailure | null {
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
  if (kind !== 'wrongBallFirst') attempts.splice(0, attempts.length, ...attempts.filter((a) => a.score <= bestPot + FAIL.potMargin));
  let best: SolvedFailure | null = null;
  let tried = 0;
  search: for (const { ball, pocket, dir } of attempts) {
    const p = table.pockets.find((q) => q.id === pocket)!;
    for (const speed of powers) {
      if (speed > FAIL.maxSpeed) continue; // medium power: a real attempt, not a smash
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
          type: 'attempt', natural: 0,
          score: sim.time, nextCost: null, cueEnd: { ...sim.balls.find((b) => b.kind === 'cue')!.pos } };
        if (best.duration <= CONFIG.shot.maxDurationFlex) break search; // good enough: a failure need not be the quickest
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
          kind: 'wrongBallFirst', fallback: 'softFoul', type: 'softFoul', natural: 0, score: sim.time, nextCost: null, cueEnd: { ...sim.balls[0]!.pos } };
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
        computeMs: 0, tried: k + 1, kind: 'wrongBallFirst', fallback: 'tap', type: 'tap', natural: 0, score: sim.time, nextCost: null,
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
  const found = searchFailure(state, target, kind, table, now, cfg, shotBudget, count);
  if (found) return done(found, null);
  if (kind !== 'plainMiss') {
    const miss = searchFailure(state, target, 'plainMiss', table, now, cfg, shotBudget, count);
    if (miss) return done(miss, 'plainMiss');
  }
  return done(softFoul(state, target, table, cfg, count), 'softFoul') ?? done(gentleTap(state, target, table, cfg, count), 'tap');
}
