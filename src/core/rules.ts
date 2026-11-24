// Snooker rules state (task 3.1): what must be potted next, whether a shot was a success, a failure or a shot the
// solver must never play, and what the table looks like afterwards (re-spotting). Pure: no rendering, no randomness.
// Score, points remaining, snookers and the maximum come in task 3.2. Rules: docs/RULES.md section C.

import { CONFIG } from '../config/game.config';
import type { TableGeometry } from './table/geometry';
import { rackBalls } from './table/rack';
import { dist, type Ball, type BallKind, type Colour, type Vec2 } from './types';

export type Phase =
  | 'red' // a red must be potted next
  | 'colour' // a red was just potted: one colour (the player's choice) must be potted next
  | 'final' // no reds left: the colours in order yellow ... black (nextColour)
  | 'cleared' // every ball potted: the round is won
  | 'lost'; // a failed shot ended the round

export interface FrameState {
  phase: Phase;
  redsLeft: number; // reds still on the table
  nextColour: Colour | null; // only in the final phase
  balls: Ball[]; // every ball on the table (cue ball included)
  lastFailure: FailureType | null;
}

/** Labels from RULES B.4/C.5: noPot = plain miss or jaw rattle (MISSED), inOff = IN-OFF, wrongBallFirst = FOUL,
 *  missedAll = no ball hit at all (SNOOKERED when escaping a snooker). */
export type FailureType = 'noPot' | 'inOff' | 'wrongBallFirst' | 'missedAll';

/** What the physics reports about one shot. `after` = the balls still on the table when everything has stopped. */
export interface ShotResult {
  firstHit: string | null; // id of the first ball the cue ball touched, null if none
  potted: string[]; // ids of every ball that dropped (cue ball included)
  after: Ball[];
}

export type Verdict =
  | { result: 'success'; potted: string }
  | { result: 'failure'; type: FailureType }
  | { result: 'invalid'; reason: string }; // the solver must never show such a shot (RULES C.4 / C.5)

export function newFrame(reds: number, table: TableGeometry): FrameState {
  return { phase: 'red', redsLeft: reds, nextColour: null, balls: rackBalls(reds, table), lastFailure: null };
}

/** The kinds of ball that may be the target of the next shot. In the colour phase any colour (the player picks). */
export function legalTargets(state: FrameState): BallKind[] {
  switch (state.phase) {
    case 'red': return ['red'];
    case 'colour': return [...CONFIG.finalColourOrder];
    case 'final': return [state.nextColour!];
    default: return [];
  }
}

const kindOf = (state: FrameState, id: string): BallKind | undefined => state.balls.find((b) => b.id === id)?.kind;

/**
 * Judge one shot at `target` (a kind from legalTargets). Success = the cue ball first touches a ball of the target
 * kind, exactly one ball drops, it is of the target kind, and the cue ball stays on the table (RULES C.4).
 * A failure never pots an object ball (C.5); a shot that does, or that pots two balls, is 'invalid'.
 */
export function judgeShot(state: FrameState, target: BallKind, shot: ShotResult): Verdict {
  if (!legalTargets(state).includes(target)) throw new Error(`${target} is not a legal target in phase ${state.phase}`);
  const objects = shot.potted.filter((id) => id !== 'cue');
  const cueIn = shot.potted.includes('cue');
  if (cueIn) return objects.length ? { result: 'invalid', reason: 'in-off with an object ball potted' } : { result: 'failure', type: 'inOff' };
  if (shot.firstHit === null) return { result: 'failure', type: 'missedAll' }; // nothing hit, so nothing can drop
  if (kindOf(state, shot.firstHit) !== target) {
    return objects.length ? { result: 'invalid', reason: 'wrong ball hit first and a ball potted' } : { result: 'failure', type: 'wrongBallFirst' };
  }
  if (objects.length === 0) return { result: 'failure', type: 'noPot' };
  if (objects.length > 1) return { result: 'invalid', reason: 'more than one ball potted' };
  if (kindOf(state, objects[0]!) !== target) return { result: 'invalid', reason: 'a ball other than the target potted' };
  return { result: 'success', potted: objects[0]! };
}

/** Apply a judged shot: the next phase, and the table afterwards (a colour potted while reds remain is re-spotted). */
export function applyShot(state: FrameState, target: BallKind, shot: ShotResult, table: TableGeometry): FrameState {
  const v = judgeShot(state, target, shot);
  if (v.result === 'invalid') throw new Error(`invalid shot: ${v.reason}`);
  if (v.result === 'failure') return { ...state, phase: 'lost', balls: shot.after, lastFailure: v.type };
  const balls = shot.after.map((b) => ({ ...b, pos: { ...b.pos } }));
  if (state.phase === 'red') return { ...state, phase: 'colour', redsLeft: state.redsLeft - 1, balls };
  if (state.phase === 'colour') {
    // C.2: while reds remain (and for the colour after the last red, C.3) the colour comes back
    const colour = target as Colour;
    balls.push({ id: colour, kind: colour, pos: respotPosition(colour, balls, table) });
    return state.redsLeft > 0
      ? { ...state, phase: 'red', balls }
      : { ...state, phase: 'final', nextColour: CONFIG.finalColourOrder[0], balls };
  }
  // final phase: the colour stays down (C.3)
  const i = CONFIG.finalColourOrder.indexOf(target as Colour);
  const next = CONFIG.finalColourOrder[i + 1];
  return next ? { ...state, nextColour: next, balls } : { ...state, phase: 'cleared', nextColour: null, balls };
}

/**
 * RULES C.2: its own spot if free; else the highest free spot (black, pink, blue, brown, green, yellow); else the
 * nearest free point on the long centre line above its own spot (toward the top cushion); else below it.
 */
export function respotPosition(colour: Colour, balls: Ball[], table: TableGeometry): Vec2 {
  const r = table.ballRadius;
  const free = (p: Vec2) => balls.every((b) => dist(b.pos, p) >= 2 * r + CONFIG.respot.gap);
  const own = table.spots[colour];
  if (free(own)) return { ...own };
  for (const c of CONFIG.respotPriority) if (free(table.spots[c])) return { ...table.spots[c] };
  const step = CONFIG.respot.lineStep;
  for (let y = own.y + step; y <= table.halfLength - r; y += step) if (free({ x: own.x, y })) return { x: own.x, y };
  for (let y = own.y - step; y >= -table.halfLength + r; y -= step) if (free({ x: own.x, y })) return { x: own.x, y };
  throw new Error(`no place to re-spot ${colour}`);
}
