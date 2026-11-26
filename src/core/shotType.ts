// Task 4.7: what kind of shot is this, and how natural does it look? Pure (no rendering, no clock).
// A shot is labelled from the physics events (what really happened) and the layout before it. The naturalness cost
// (0 = what a professional would play, higher = less natural) is used by the solver to prefer natural shots, and the
// labels are reported over real rounds (target: 90% plain pots or planned cannons, exhibition shots under 2%).

import { CONFIG } from '../config/game.config';
import { createSim, isMoving, stepSim, strike, type PhysicsConfig, type SimEvent } from './physics/sim';
import type { PocketId, TableGeometry } from './table/geometry';
import type { Ball, BallKind, Vec2 } from './types';

export type ShotType =
  // success shots
  | 'plain' // direct pot, nothing else touched by the cue ball (or only after the pot... see cannon)
  | 'packCannon' // a colour pot where the cue ball then runs into the reds (planned: opens the pack)
  | 'softCannon' // after the pot the cue ball runs gently into reds (heading to the pack area anyway): natural
  | 'cannon' // after the pot the cue ball hits other balls hard, or a colour: accidental
  | 'long' // a long pot (far from the cue ball and/or the pocket)
  | 'cushionFirst' | 'plant' | 'double' | 'kiss' | 'farPocket' | 'fluke' // exhibition shots
  // failure shots
  | 'attempt' // a real attempt at a sensible pot that misses (or rattles, or goes in-off)
  | 'softFoul' | 'tap' // RULES D.2 fallbacks
  | 'library'; // step 1, from the break-off library

export const NATURAL_TYPES: readonly ShotType[] = ['plain', 'packCannon', 'softCannon'];
export const EXHIBITION_TYPES: readonly ShotType[] = ['cushionFirst', 'plant', 'double', 'kiss', 'farPocket', 'fluke'];
export const isExhibition = (t: ShotType) => EXHIBITION_TYPES.includes(t);

const N = CONFIG.solver.natural;

/** Angle of the cut (degrees) for cue ball at `cue`, object ball at `ball`, into a pocket mouth point `mouth`. */
export function cutAngle(cue: Vec2, ball: Vec2, mouth: Vec2, r: number): number {
  const toP = { x: mouth.x - ball.x, y: mouth.y - ball.y };
  const dP = Math.hypot(toP.x, toP.y);
  const ghost = { x: ball.x - (toP.x / dP) * 2 * r, y: ball.y - (toP.y / dP) * 2 * r };
  const aim = { x: ghost.x - cue.x, y: ghost.y - cue.y };
  const dA = Math.hypot(aim.x, aim.y);
  if (dA < 1e-9) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (aim.x * toP.x + aim.y * toP.y) / (dA * dP)))) * 180) / Math.PI;
}

/** Reds that touch or almost touch at least `clusterNeighbours` other reds (the pack). */
export function clusteredReds(balls: Ball[], r: number): Set<string> {
  const reds = balls.filter((b) => b.kind === 'red');
  const out = new Set<string>();
  for (const a of reds) {
    const n = reds.filter((b) => b !== a && Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y) < 2 * r + N.clusterGap).length;
    if (n >= N.clusterNeighbours) out.add(a.id);
  }
  return out;
}

/**
 * Naturalness of the pot itself, from the layout only (before simulating): cut angle, distances, and whether the red
 * comes out of the pack while loose reds exist. Used to order the search and as part of the score.
 */
/** Phase 1 (owner, night 2026-11-24): pocket choice cost. Reds into the black-end corners first, the middles when
 * natural, a baulk-end corner only for a red already in the baulk half. Black into a black-end corner, pink not into a
 * baulk-end corner. */
export function pocketPrefCost(kind: BallKind, ball: Vec2, pocket: PocketId): number {
  const B = N.blackPlay;
  if (!B.enabled) return 0;
  const baulkCorner = pocket === 'bottomLeft' || pocket === 'bottomRight';
  if (kind === 'red') return baulkCorner ? (ball.y > 0 ? B.redBaulkCornerCost : 0) : pocket.startsWith('middle') ? B.redMiddleCost : 0;
  if (kind === 'black') return pocket === 'topLeft' || pocket === 'topRight' ? 0 : B.colourOffPocketCost;
  if (kind === 'pink') return baulkCorner ? B.colourOffPocketCost : 0;
  return 0;
}

/** Phase 1: keep the cue ball between the black, the pink and the blue while reds remain in the black half. */
export function zoneCost(cueEnd: Vec2, after: Ball[], table: TableGeometry): number {
  const B = N.blackPlay;
  if (!B.enabled || !after.some((b) => b.kind === 'red' && b.pos.y > table.spots.blue.y)) return 0;
  const lo = table.spots.blue.y - B.zoneBelowBlue;
  const hi = table.spots.black.y;
  const dx = Math.max(0, Math.abs(cueEnd.x) - B.zoneHalfWidth);
  const dy = cueEnd.y > hi ? cueEnd.y - hi : cueEnd.y < lo ? lo - cueEnd.y : 0;
  return Math.hypot(dx, dy) * B.zoneCostPerM;
}

export function potCost(cue: Vec2, ball: Ball, mouth: Vec2, balls: Ball[], r: number): number {
  const cut = cutAngle(cue, ball.pos, mouth, r);
  const dA = Math.hypot(ball.pos.x - cue.x, ball.pos.y - cue.y);
  const dP = Math.hypot(mouth.x - ball.pos.x, mouth.y - ball.pos.y);
  let c = Math.max(0, cut - N.comfortableCutDeg) / N.cutDegPerPoint + N.perMetre * (dA + dP);
  if (ball.kind === 'red') {
    const pack = clusteredReds(balls, r);
    const loose = balls.filter((b) => b.kind === 'red' && !pack.has(b.id)).length;
    if (pack.has(ball.id) && loose > 0) c += N.redFromPackWhileLoose; // loose reds first
  }
  return c;
}

/** Extra cost for power: medium power is natural, full power along the table is not. */
export const powerCost = (speed: number) => Math.max(0, speed - N.mediumSpeed) ** 2 * N.powerPerSpeed2;

export interface ShotFacts {
  state: Ball[]; // balls before the shot
  target: BallKind;
  potted: string; // the id of the ball that dropped
  aimedPocket: PocketId | null; // the pocket the shot was aimed at (null = unknown)
  events: SimEvent[];
  table: TableGeometry;
}

/** Label a success shot from what really happened. Exhibition labels win over the others. */
export function classifySuccess(f: ShotFacts): ShotType {
  const { events, potted, table } = f;
  const r = table.ballRadius;
  const firstCueBall = events.find((e) => e.type === 'ball' && (e.a === 'cue' || e.b === 'cue'));
  const tFirst = firstCueBall ? firstCueBall.t : Infinity;
  const firstHit = firstCueBall && firstCueBall.type === 'ball' ? (firstCueBall.a === 'cue' ? firstCueBall.b : firstCueBall.a) : null;
  const pot = events.find((e) => e.type === 'pot' && e.a === potted);
  const tPot = pot ? pot.t : Infinity;
  if (events.some((e) => e.type === 'cushion' && e.a === 'cue' && e.t < tFirst)) return 'cushionFirst';
  if (firstHit !== potted) return 'plant';
  // what touched the potted ball between the cue-ball contact and the drop
  const touches = events.filter((e) => e.t > tFirst && e.t < tPot);
  // a double: off a cushion away from the pocket (running along the cushion into the pocket is a normal pot)
  const dropIn = pot && pot.type === 'pot' ? table.pockets.find((p) => p.id === pot.pocket)!.mouthMid : null;
  if (touches.some((e) => e.type === 'cushion' && e.a === potted &&
    (!dropIn || Math.hypot(e.at.x - dropIn.x, e.at.y - dropIn.y) > N.doubleFrom))) return 'double';
  if (touches.some((e) => e.type === 'ball' && (e.a === potted || e.b === potted))) return 'kiss';
  if (pot && pot.type === 'pot' && f.aimedPocket && pot.pocket !== f.aimedPocket) return 'fluke';
  const ball = f.state.find((b) => b.id === potted)!;
  const cue = f.state.find((b) => b.kind === 'cue')!;
  const pocket = pot && pot.type === 'pot' ? table.pockets.find((p) => p.id === pot.pocket)! : null;
  if (pocket) {
    const dP = Math.hypot(pocket.mouthMid.x - ball.pos.x, pocket.mouthMid.y - ball.pos.y);
    // far pocket: a much nearer pocket was there to take, with a comfortable angle
    const nearer = table.pockets.some((p) => p.id !== pocket.id &&
      Math.hypot(p.mouthMid.x - ball.pos.x, p.mouthMid.y - ball.pos.y) < dP - N.farPocketMargin &&
      cutAngle(cue.pos, ball.pos, p.mouthMid, r) <= N.comfortableCutDeg + N.cutDegPerPoint);
    if (dP > N.farPocketFrom && nearer) return 'farPocket';
    const dA = Math.hypot(ball.pos.x - cue.pos.x, ball.pos.y - cue.pos.y);
    if (dA + dP > N.longFrom) return 'long';
  }
  // the cue ball touching other balls after its first contact
  const hits = events.filter((e): e is Extract<SimEvent, { type: 'ball' }> => e.type === 'ball' && e.t > tFirst &&
    (e.a === 'cue' || e.b === 'cue') && (e.a === 'cue' ? e.b : e.a) !== potted);
  if (hits.length) {
    const kinds = hits.map((e) => f.state.find((b) => b.id === (e.a === 'cue' ? e.b : e.a))?.kind);
    const allReds = kinds.every((k) => k === 'red');
    if (f.target !== 'red' && allReds) return 'packCannon'; // a colour pot that opens the pack (planned)
    // owner 2026-11-24: a soft contact with reds after potting is natural; a hard one, or a colour, is accidental
    return allReds && hits.every((e) => e.speed <= N.softCannonSpeed) ? 'softCannon' : 'cannon';
  }
  return 'plain';
}

/** What the whole shot did (for the strict naturalness check, owner 2026-11-24). */
export interface PlayFacts extends ShotFacts {
  duration: number; // seconds until every ball stopped
  cueTravel: number; // metres the cue ball rolled after its first contact with a ball
  after: Ball[]; // balls on the table at the end
}

/**
 * Strict naturalness (owner 2026-11-24). Natural only if ALL hold: the pot is plain or a planned soft cannon into the
 * pack; the whole shot lasts at most natural.maxSeconds; after its first contact the cue ball touches at most
 * maxCueCushions cushions and rolls at most maxCueTravel; no other ball moves, except reds touched softly by a
 * (pack / soft) cannon. Returns null when natural, else the first reason it is not.
 */
export function naturalCheck(type: ShotType, f: PlayFacts): string | null {
  if (!NATURAL_TYPES.includes(type)) return type;
  if (f.duration > N.maxSeconds) return `over ${N.maxSeconds} s`;
  const firstContact = f.events.find((e) => e.type === 'ball');
  const t0 = firstContact ? firstContact.t : 0;
  const cushions = f.events.filter((e) => e.type === 'cushion' && e.a === 'cue' && e.t > t0).length;
  if (cushions > N.maxCueCushions) return `cue ball ${cushions} cushions`;
  if (f.cueTravel > N.maxCueTravel) return `cue ball runs ${f.cueTravel.toFixed(1)} m`;
  if (type === 'packCannon' && f.events.some((e) => e.type === 'ball' && e.t > t0 && (e.a === 'cue' || e.b === 'cue') &&
    (e.a === 'cue' ? e.b : e.a) !== f.potted && e.speed > N.packCannonSpeed)) return 'hard cannon into the pack';
  for (const b of f.state) {
    if (b.kind === 'cue' || b.id === f.potted) continue;
    const a = f.after.find((x) => x.id === b.id);
    const moved = a ? Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) : Infinity;
    if (moved <= N.disturbFrom) continue;
    const softReds = b.kind === 'red' && (type === 'softCannon' || type === 'packCannon') && moved <= N.packDisturbMax;
    if (!softReds) return `${b.id} disturbed`;
  }
  return null;
}

/** Play a shot and collect what the strict check needs (used by the reports; the solver measures while it searches). */
export function playFacts(balls: Ball[], s: { dir: Vec2; speed: number; spin: number }, table: TableGeometry, cfg?: PhysicsConfig) {
  const sim = createSim(balls, table, cfg);
  strike(sim, 'cue', s.dir, s.speed, s.spin);
  const cue = sim.balls.find((b) => b.kind === 'cue')!;
  let travel = 0;
  let prev = { ...cue.pos };
  while (isMoving(sim)) {
    stepSim(sim);
    if (sim.events.some((e) => e.type === 'ball')) travel += Math.hypot(cue.pos.x - prev.x, cue.pos.y - prev.y);
    prev = { ...cue.pos };
  }
  return { events: sim.events, duration: sim.time, cueTravel: travel, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
    after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) };
}

/** Extra naturalness cost of a shot type (0 for the natural ones). */
export const typeCost = (t: ShotType): number =>
  t === 'plain' || t === 'packCannon' || t === 'softCannon' ? 0 : t === 'cannon' ? N.cannonCost : t === 'long' ? N.longCost : N.exhibitionCost;

/**
 * After the shot: are reds left only in the pack? (a natural player opens the pack before the loose reds run out)
 * 1 when no loose red is left but a pack is, else 0.
 */
export function packLeftClosed(after: Ball[], r: number): number {
  const reds = after.filter((b) => b.kind === 'red');
  if (reds.length < 2) return 0;
  const pack = clusteredReds(after, r);
  return reds.length - pack.size < N.minLooseReds && pack.size > 0 ? 1 : 0;
}

/**
 * Night 2026-11-24 (RULES D: avoid RE-RACK): 1 when reds remain but every one is locked, else 0. A red is locked when
 * no pocket can take it: for each pocket the path to it is blocked, or the ghost-ball spot overlaps another ball
 * (for example two reds glued to the pink spot). Only a cannon can free such reds, so leaving only them is a dead end.
 */
export function allRedsLocked(after: Ball[], table: TableGeometry): number {
  const r = table.ballRadius;
  const reds = after.filter((b) => b.kind === 'red');
  if (!reds.length) return 0;
  const others = after.filter((b) => b.kind !== 'cue');
  const blocked = (a: Vec2, b: Vec2, skip: string) => others.some((o) => {
    if (o.id === skip) return false;
    const dx = b.x - a.x; const dy = b.y - a.y; const L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((o.pos.x - a.x) * dx + (o.pos.y - a.y) * dy) / L2));
    return Math.hypot(a.x + t * dx - o.pos.x, a.y + t * dy - o.pos.y) < 2 * r;
  });
  const free = reds.some((red) => table.pockets.some((p) => {
    const toP = { x: p.mouthMid.x - red.pos.x, y: p.mouthMid.y - red.pos.y };
    const d = Math.hypot(toP.x, toP.y);
    const ghost = { x: red.pos.x - (toP.x / d) * 2 * r, y: red.pos.y - (toP.y / d) * 2 * r };
    if (others.some((o) => o.id !== red.id && Math.hypot(o.pos.x - ghost.x, o.pos.y - ghost.y) < 2 * r)) return false;
    return !blocked(red.pos, p.mouthMid, red.id);
  }));
  return free ? 0 : 1;
}

/** How a next shot looks when the cut is `cut` degrees: leave an angle (not dead straight, not too thin). */
export function angleCost(cut: number): number {
  const [lo, hi] = N.idealNextCutDeg;
  return cut < lo ? (lo - cut) / lo * N.straightCost : cut > hi ? (cut - hi) / N.cutDegPerPoint : 0;
}
