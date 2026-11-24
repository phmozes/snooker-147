// Task 4.7: what kind of shot is this, and how natural does it look? Pure (no rendering, no clock).
// A shot is labelled from the physics events (what really happened) and the layout before it. The naturalness cost
// (0 = what a professional would play, higher = less natural) is used by the solver to prefer natural shots, and the
// labels are reported over real rounds (target: 90% plain pots or planned cannons, exhibition shots under 2%).

import { CONFIG } from '../config/game.config';
import type { SimEvent } from './physics/sim';
import type { PocketId, TableGeometry } from './table/geometry';
import type { Ball, BallKind, Vec2 } from './types';

export type ShotType =
  // success shots
  | 'plain' // direct pot, nothing else touched by the cue ball (or only after the pot... see cannon)
  | 'packCannon' // a colour pot where the cue ball then runs into the reds (planned: opens the pack)
  | 'cannon' // the cue ball touches other balls after the pot (not planned)
  | 'long' // a long pot (far from the cue ball and/or the pocket)
  | 'cushionFirst' | 'plant' | 'double' | 'kiss' | 'farPocket' | 'fluke' // exhibition shots
  // failure shots
  | 'attempt' // a real attempt at a sensible pot that misses (or rattles, or goes in-off)
  | 'softFoul' | 'tap' // RULES D.2 fallbacks
  | 'library'; // step 1, from the break-off library

export const NATURAL_TYPES: readonly ShotType[] = ['plain', 'packCannon'];
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
  const cannoned = events.filter((e) => e.type === 'ball' && e.t > tFirst && (e.a === 'cue' || e.b === 'cue'))
    .map((e) => (e.type === 'ball' ? (e.a === 'cue' ? e.b : e.a) : ''))
    .filter((id) => id !== potted);
  if (cannoned.length) {
    const kinds = cannoned.map((id) => f.state.find((b) => b.id === id)?.kind);
    return f.target !== 'red' && kinds.every((k) => k === 'red') ? 'packCannon' : 'cannon';
  }
  return 'plain';
}

/** Extra naturalness cost of a shot type (0 for the natural ones). */
export const typeCost = (t: ShotType): number =>
  t === 'plain' || t === 'packCannon' ? 0 : t === 'cannon' ? N.cannonCost : t === 'long' ? N.longCost : N.exhibitionCost;

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

/** How a next shot looks when the cut is `cut` degrees: leave an angle (not dead straight, not too thin). */
export function angleCost(cut: number): number {
  const [lo, hi] = N.idealNextCutDeg;
  return cut < lo ? (lo - cut) / lo * N.straightCost : cut > hi ? (cut - hi) / N.cutDegPerPoint : 0;
}
