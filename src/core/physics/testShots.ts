// Fixed test shots for the debug page and the physics tests (the real break-off library comes in task 4.6).

import { CONFIG } from '../../config/game.config';
import type { PocketId, TableGeometry } from '../table/geometry';
import { rackBalls } from '../table/rack';
import { COLOURS, sub, type Ball, type Vec2 } from '../types';
import { createSim, naturalRollSpin, runUntilStill, strike, type PhysicsConfig, type Sim } from './sim';

/**
 * Direction for a hard break from the cue ball's place in the D. It aims just outside the outer red of
 * one triangle row (config dev.breakAimRow / breakAimOffset), so it passes the pink and smashes into
 * the side of the pack. Those two numbers were picked by a scan: most reds move, for 6, 10 and 15 reds.
 */
export function breakAim(table: TableGeometry, balls: Ball[]): Vec2 {
  const cue = balls.find((b) => b.kind === 'cue')!;
  const reds = balls.filter((b) => b.kind === 'red');
  const rowYs = [...new Set(reds.map((b) => b.pos.y))].sort((a, b) => a - b);
  const rowY = rowYs[Math.min(CONFIG.dev.breakAimRow, rowYs.length - 1)]!;
  const side = Math.sign(cue.pos.x) || 1;
  const outer = reds
    .filter((b) => b.pos.y === rowY)
    .reduce((a, b) => (b.pos.x * side > a.pos.x * side ? b : a));
  return sub({ x: outer.pos.x + side * CONFIG.dev.breakAimOffset * table.ballRadius, y: rowY }, cue.pos);
}

// ---------------- pocket test: roll one ball at a pocket ----------------

export interface PocketRoll {
  pocket: PocketId;
  angleDeg: number; // 0 = straight into the pocket; + turns the approach line anticlockwise
  offset: number; // metres, aim point across the mouth (+ = to the left of the approach direction)
  speed: number; // m/s at the start
  distance: number; // metres from the mouth centre back to the start
}

export type RollOutcome = 'clean' | 'rattleIn' | 'rattleOut' | 'missed' | 'offTable';

/** Start position and direction for a pocket roll, or null if the start is not on the cloth. */
export function pocketRollStart(table: TableGeometry, roll: PocketRoll): { pos: Vec2; dir: Vec2 } | null {
  const p = table.pockets.find((q) => q.id === roll.pocket)!;
  const a = (roll.angleDeg * Math.PI) / 180;
  const dir = { x: p.inward.x * Math.cos(a) - p.inward.y * Math.sin(a), y: p.inward.x * Math.sin(a) + p.inward.y * Math.cos(a) };
  const left = { x: -dir.y, y: dir.x };
  const aim = { x: p.mouthMid.x + left.x * roll.offset, y: p.mouthMid.y + left.y * roll.offset };
  const pos = { x: aim.x - dir.x * roll.distance, y: aim.y - dir.y * roll.distance };
  const r = table.ballRadius;
  if (Math.abs(pos.x) > table.halfWidth - r || Math.abs(pos.y) > table.halfLength - r) return null;
  return { pos, dir };
}

/** Run a pocket roll to the end. Returns what happened, or 'offTable' if the start is not on the cloth. */
export function runPocketRoll(table: TableGeometry, roll: PocketRoll, cfg: PhysicsConfig = CONFIG.physics): { outcome: RollOutcome; sim: Sim | null } {
  const start = pocketRollStart(table, roll);
  if (!start) return { outcome: 'offTable', sim: null };
  const sim = createSim([{ id: 'red1', kind: 'red', pos: start.pos }], table, cfg);
  strike(sim, 'red1', start.dir, roll.speed, naturalRollSpin(cfg)); // object ball rolling naturally
  runUntilStill(sim);
  return { outcome: classifyRoll(sim, 'red1'), sim };
}

export function classifyRoll(sim: Sim, ballId: string): RollOutcome {
  const jaws = sim.events.filter((e) => e.type === 'jaw' && e.a === ballId).length;
  const potted = sim.balls.find((b) => b.id === ballId)!.potted !== null;
  if (potted) return jaws ? 'rattleIn' : 'clean';
  return jaws ? 'rattleOut' : 'missed';
}

// ---------------- recorded check shots (task 2.1: the 2D and 3D views replay the same recording) ----------------

export interface ShotSetup { balls: Ball[]; dir: Vec2; speed: number; spin: number }

/** Break-off for a level: full rack, hard break from the cue ball's place in the D. */
export function breakOffShot(table: TableGeometry, reds: number): ShotSetup {
  const balls = rackBalls(reds, table);
  return { balls, dir: breakAim(table, balls), speed: CONFIG.physics.maxCueSpeed, spin: 0 };
}

/**
 * A red potted into a corner: colours on their spots, one red and the cue ball at fixed places (config
 * dev.potRedShot). Every aim point across the mouth, power and solver spin is tried; the QUICKEST shot that pots
 * only the red (nothing else dropped) is kept, as the solver will do (task 1.4 decision).
 */
export function potRedShot(table: TableGeometry, cfg: PhysicsConfig = CONFIG.physics): ShotSetup {
  const S = CONFIG.dev.potRedShot;
  const colours: Ball[] = COLOURS.map((c) => ({ id: c, kind: c, pos: { ...table.spots[c] } }));
  const balls: Ball[] = [
    { id: 'cue', kind: 'cue', pos: { x: S.cue[0], y: S.cue[1] } },
    { id: 'red1', kind: 'red', pos: { x: S.red[0], y: S.red[1] } },
    ...colours,
  ];
  const r = table.ballRadius;
  const p = table.pockets.find((q) => q.id === S.pocket)!;
  const left = { x: -p.inward.y, y: p.inward.x };
  const red = balls[1]!.pos;
  const cue = balls[0]!.pos;
  let best: (ShotSetup & { t: number }) | null = null;
  for (let off = -S.aimRange; off <= S.aimRange + 1e-9; off += S.aimStep) {
    const tgt = { x: p.mouthMid.x + left.x * off, y: p.mouthMid.y + left.y * off };
    const to = sub(tgt, red);
    const l = Math.hypot(to.x, to.y);
    const dir = sub({ x: red.x - (to.x / l) * 2 * r, y: red.y - (to.y / l) * 2 * r }, cue); // ghost ball
    for (let v = S.minSpeed; v <= CONFIG.physics.maxCueSpeed + 1e-9; v += S.speedStep) {
      for (const spin of CONFIG.solver.spinSamples) {
        const sim = createSim(balls, table, cfg);
        strike(sim, 'cue', dir, v, spin);
        const t = runUntilStill(sim);
        const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
        if (potted.length === 1 && potted[0] === 'red1' && (!best || t < best.t)) best = { balls, dir, speed: v, spin, t };
      }
    }
  }
  if (!best) throw new Error('potRedShot: no potting shot found for this layout');
  return { balls, dir: best.dir, speed: best.speed, spin: best.spin };
}
