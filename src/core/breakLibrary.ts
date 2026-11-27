// Offline break-off library (task 4.6, RULES B.1 / B.2 / D.1). The opponent's break-off comes from this library; every
// break is stored together with the step-1 shots already tested offline, so step 1 never needs a fallback (D.1).
// Kinds: 'redPottable' (at least minPottableRedsForRedPottable reds have an open pocket) with a step-1 success shot
// and a step-1 plain miss; 'snookered' (no red can be hit straight) with a failed escape (FOUL / missed every ball).
// Pure and seeded: the same seed always builds the same library. The generator is run by `npm run breaks`.
// Night 6: v3 rounds use a library whose break-off starts ON the baulk line (public/breaks-v3); the old library
// (public/breaks, cue ball anywhere in the D) stays for v1 / v2 round codes (start 'd').

import { CONFIG } from '../config/game.config';
import { createSim, runUntilStill, strike, type PhysicsConfig } from './physics/sim';
import { mulberry32 } from './rng';
import { applyShot, judgeShot, newFrame, type FrameState } from './rules';
import { clusteredReds } from './shotType';
import { isNaturalShot, nextShotCost, solveFailure, solveSuccess } from './solver';
import type { TableGeometry } from './table/geometry';
import type { Ball, Vec2 } from './types';

export type BreakKind = 'redPottable' | 'snookered';
export interface StoredShot { dir: Vec2; speed: number; spin: number; duration: number }
export interface BreakEntry {
  kind: BreakKind;
  seed: number; // the seed that made this break (it can be rebuilt from it)
  cueStart: Vec2;
  breakShot: StoredShot;
  after: Ball[]; // the table after the break (what step 1 starts from)
  pottableReds: number;
  step1Success: StoredShot | null; // redPottable only
  step1Miss: StoredShot | null; // redPottable only (plain miss after the break, RULES B.2)
  step1Escape: StoredShot | null; // snookered only (the escape that fails)
}

const L = CONFIG.breakLibrary;
const r2 = (v: number) => Math.round(v * 1e6) / 1e6; // keep the JSON small (micrometres)
const shotOf = (s: { dir: Vec2; speed: number; spin: number; duration: number }): StoredShot =>
  ({ dir: { x: s.dir.x, y: s.dir.y }, speed: s.speed, spin: s.spin, duration: r2(s.duration) }); // full precision: replays must match

/** Where the break-off starts. 'baulkLine' (night 6, owner; v3 rounds): ON the baulk line between the brown and the
 *  yellow or green (config breakLibrary.baulkStart), played at the same side of the pack. 'd' (the old library of
 *  v1 / v2 rounds, kept so it can be rebuilt): anywhere in the D half circle, either side of the pack. */
export type BreakStart = 'baulkLine' | 'd';

/** The v3 break-off start for the draws (u, sideDraw) in [0, 1): on the baulk line, xMin <= |x| <= xMax. */
export function baulkLineStart(u: number, sideDraw: number, table: TableGeometry): Vec2 {
  const S = L.baulkStart;
  return { x: (sideDraw < 0.5 ? -1 : 1) * (S.xMin + (S.xMax - S.xMin) * u), y: table.baulkY };
}

/** The opponent's break: cue ball on the baulk line (or anywhere in the D: old library), aimed at the side of the
 *  pack, varied power and spin. */
function breakAttempt(seed: number, reds: number, table: TableGeometry, cfg: PhysicsConfig, start: BreakStart) {
  const rng = mulberry32(seed);
  const B = L.breakShot;
  const rack = newFrame(reds, table);
  const balls = rack.balls.map((b) => ({ ...b, pos: { ...b.pos } }));
  const cue = balls.find((b) => b.kind === 'cue')!;
  let side: number;
  if (start === 'd') {
    const a = Math.PI * rng(); // a point in the D (half circle below the baulk line)
    const d = table.dRadius * (0.3 + 0.65 * rng());
    cue.pos = { x: table.dCentre.x + Math.cos(a) * d * (rng() < 0.5 ? -1 : 1), y: table.dCentre.y - Math.sin(a) * d };
    side = rng() < 0.5 ? -1 : 1;
  } else {
    cue.pos = baulkLineStart(rng(), rng(), table);
    side = Math.sign(cue.pos.x); // from beside the yellow: the right side of the pack; beside the green: the left
  }
  const redsOn = balls.filter((b) => b.kind === 'red');
  const outer = redsOn.reduce((m, b) => (b.pos.x * side > m.pos.x * side ? b : m));
  const back = redsOn.reduce((m, b) => (b.pos.y > m.pos.y ? b : m));
  const aimY = outer.pos.y + (back.pos.y - outer.pos.y) * rng() * 0.5 - table.ballRadius * 2 * rng();
  const aim = { x: outer.pos.x + side * table.ballRadius * (B.offsetMin + (B.offsetMax - B.offsetMin) * rng()), y: aimY };
  const speed = B.speedMin + (B.speedMax - B.speedMin) * rng();
  const spin = B.spins[Math.floor(rng() * B.spins.length)]!;
  const dir = { x: aim.x - cue.pos.x, y: aim.y - cue.pos.y };
  const sim = createSim(balls, table, cfg);
  strike(sim, 'cue', dir, speed, spin);
  const duration = runUntilStill(sim);
  const pottedAny = sim.balls.some((b) => b.potted);
  const after: Ball[] = sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { x: r2(b.pos.x), y: r2(b.pos.y) } }));
  const firstHit = sim.events.find((e) => e.type === 'ball');
  const hitRedFirst = !!firstHit && firstHit.type === 'ball' && [firstHit.a, firstHit.b].some((id) => id.startsWith('red'));
  // a real break-off leaves the baulk colours and the blue (almost) where they were
  // owner 2026-11-25 (RULES B.1): the pink and the black stay near their spots too
  const quiet = coloursMovedByBreak(after, table) <= L.maxColourMove && topColoursMovedByBreak(after, table) <= L.maxTopColourMove;
  return { cueStart: { x: cue.pos.x, y: cue.pos.y }, breakShot: shotOf({ dir, speed, spin, duration }), after,
    valid: !pottedAny && hitRedFirst && quiet };
}

/** The largest distance (m) the break moved the yellow, green, brown or blue from its spot (a potted one: Infinity). */
export function coloursMovedByBreak(after: Ball[], table: TableGeometry): number {
  return Math.max(...L.stillColours.map((c) => {
    const b = after.find((x) => x.id === c);
    return b ? Math.hypot(b.pos.x - table.spots[c].x, b.pos.y - table.spots[c].y) : Infinity;
  }));
}

/** Reds with an open straight path and an open pocket from the cue ball (same test as the solver's pair filter). */
export function pottableReds(state: FrameState, table: TableGeometry): number {
  const cue = state.balls.find((b) => b.kind === 'cue')!.pos;
  return state.balls.filter((b) => b.kind === 'red').filter((red) => {
    // only this red counts as a target; the other reds stay on the table as blockers
    const balls = state.balls.map((b) => (b.kind === 'red' && b.id !== red.id ? { ...b, kind: 'black' as const } : b));
    return nextShotCost(cue, balls, 'red', table) < CONFIG.solver.position.noShotCost;
  }).length;
}

/** Snookered: no red can be reached by a straight line from the cue ball without touching another ball. */
export function isSnookered(state: FrameState, table: TableGeometry): boolean {
  const cue = state.balls.find((b) => b.kind === 'cue')!.pos;
  const r = table.ballRadius;
  return state.balls.filter((b) => b.kind === 'red').every((red) => state.balls.some((o) => {
    if (o.id === red.id || o.kind === 'cue') return false;
    const dx = red.pos.x - cue.x;
    const dy = red.pos.y - cue.y;
    const len2 = dx * dx + dy * dy;
    const t = ((o.pos.x - cue.x) * dx + (o.pos.y - cue.y) * dy) / len2;
    if (t <= 0 || t >= 1) return false;
    const px = cue.x + dx * t - o.pos.x;
    const py = cue.y + dy * t - o.pos.y;
    return px * px + py * py < (2 * r) * (2 * r);
  }));
}

/** The escape attempt that fails: aimed at a red off a cushion (or straight), hits a wrong ball first or nothing. */
function failedEscape(state: FrameState, table: TableGeometry, cfg: PhysicsConfig): StoredShot | null {
  const cue = state.balls.find((b) => b.kind === 'cue')!.pos;
  const X = table.halfWidth - table.ballRadius;
  const Y = table.halfLength - table.ballRadius;
  for (const red of state.balls.filter((b) => b.kind === 'red')) {
    const p = red.pos;
    for (const m of [{ x: 2 * X - p.x, y: p.y }, { x: -2 * X - p.x, y: p.y }, { x: p.x, y: 2 * Y - p.y }, { x: p.x, y: -2 * Y - p.y }, p]) {
      for (const speed of L.escapeSpeeds) {
        const dir = { x: m.x - cue.x, y: m.y - cue.y };
        const sim = createSim(state.balls, table, cfg);
        strike(sim, 'cue', dir, speed, 0);
        const duration = runUntilStill(sim);
        const first = sim.events.find((e) => e.type === 'ball');
        const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
        const v = judgeShot(state, 'red', { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id), after: [] });
        if (v.result === 'failure' && (v.type === 'wrongBallFirst' || v.type === 'missedAll')) return shotOf({ dir, speed, spin: 0, duration });
      }
    }
  }
  return null;
}

/** The largest distance (m) the break moved the pink or the black from its spot (a potted one: Infinity). */
export function topColoursMovedByBreak(after: Ball[], table: TableGeometry): number {
  return Math.max(...L.topColours.map((c) => {
    const b = after.find((x) => x.id === c);
    return b ? Math.hypot(b.pos.x - table.spots[c].x, b.pos.y - table.spots[c].y) : Infinity;
  }));
}

/**
 * Build `count` breaks of one kind for a level. Breaks that pot a ball, or that do not hit a red first, are skipped;
 * so are breaks whose step-1 shots cannot be found (D.1: step 1 must never need a fallback).
 */
export function buildBreaks(reds: number, kind: BreakKind, count: number, table: TableGeometry, baseSeed: number,
  cfg: PhysicsConfig = CONFIG.physics, maxAttempts = count * 1000, start: BreakStart = 'baulkLine'): { entries: BreakEntry[]; attempts: number } {
  const now = () => 0; // the solver stops on a shot count, so no clock is needed
  const entries: BreakEntry[] = [];
  let attempts = 0;
  for (let i = 0; entries.length < count && i < maxAttempts; i++) {
    attempts++;
    const seed = (baseSeed * 1_000_003 + i * 7919) >>> 0;
    const b = breakAttempt(seed, reds, table, cfg, start);
    if (!b.valid) continue;
    const state: FrameState = { ...newFrame(reds, table), balls: b.after };
    const snookered = isSnookered(state, table);
    if ((kind === 'snookered') !== snookered) continue;
    if (kind === 'snookered') {
      const esc = failedEscape(state, table, cfg);
      if (!esc) continue;
      entries.push({ kind, seed, cueStart: b.cueStart, breakShot: b.breakShot, after: b.after, pottableReds: 0,
        step1Success: null, step1Miss: null, step1Escape: esc });
      continue;
    }
    const pottable = pottableReds(state, table);
    if (pottable < L.minPottableRedsForRedPottable) continue;
    // task 4.7: the break must really open the pack (a closed pack later leaves no natural pot, even no pot at all)
    const packed = clusteredReds(b.after, table.ballRadius).size;
    if (packed > (L.maxPackedShare[`reds${reds}` as keyof typeof L.maxPackedShare] ?? 1) * reds) continue;
    const ok = solveSuccess(state, 'red', table, now, cfg);
    if (!ok || ok.duration > CONFIG.shot.maxDurationFlex) continue;
    if (L.requireNaturalChain && !isNaturalShot(ok)) continue; // task 4.7: step 1 itself must look natural
    // lookahead (config solver.lookahead, requireBlackPottableAfterRed): after the step-1 red the black must be pottable
    if (CONFIG.solver.requireBlackPottableAfterRed) {
      const sim = createSim(state.balls, table, cfg);
      strike(sim, 'cue', ok.dir, ok.speed, ok.spin);
      runUntilStill(sim);
      const first = sim.events.find((e) => e.type === 'ball');
      const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
      const s2 = applyShot(state, 'red', { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
        after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) }, table);
      const black = solveSuccess(s2, 'black', table, now, cfg);
      if (!black || black.duration > CONFIG.shot.maxDurationFlex) continue;
      if (L.requireNaturalChain) {
        // task 4.7: the black is natural and leaves a natural red (the break does not leave the reds locked up)
        if (!isNaturalShot(black)) continue;
        const sim3 = createSim(s2.balls, table, cfg);
        strike(sim3, 'cue', black.dir, black.speed, black.spin);
        runUntilStill(sim3);
        const f3 = sim3.events.find((e) => e.type === 'ball');
        const fh3 = f3 && f3.type === 'ball' ? (f3.a === 'cue' ? f3.b : f3.a) : null;
        const s3 = applyShot(s2, 'black', { firstHit: fh3, potted: sim3.balls.filter((b) => b.potted).map((b) => b.id),
          after: sim3.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) }, table);
        if (s3.phase !== 'red' || !isNaturalShot(solveSuccess(s3, 'red', table, now, cfg))) continue;
      }
    }
    const miss = solveFailure(state, 'red', 'plainMiss', table, now, cfg);
    if (!miss || miss.fallback) continue;
    entries.push({ kind, seed, cueStart: b.cueStart, breakShot: b.breakShot, after: b.after, pottableReds: pottable,
      step1Success: shotOf(ok), step1Miss: shotOf(miss), step1Escape: null });
  }
  return { entries, attempts };
}
