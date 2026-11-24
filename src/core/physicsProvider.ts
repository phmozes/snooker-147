// The real ShotProvider for the round state machine (task 5.1): step 1 from the break-off library, later shots from the
// solver (success: flex chain with RE-RACK; failure: chosen type with the RULES D.2 fallbacks). Every shot is simulated
// once more here, so the round state gets exactly what the physics reports. Fallbacks are collected in `log`.

import type { BreakEntry, StoredShot } from './breakLibrary';
import { createSim, runUntilStill, strike, type PhysicsConfig } from './physics/sim';
import type { FailureLabel, LevelId, PlannedShot, ShotProvider } from './round';
import type { FrameState, ShotResult } from './rules';
import { solveFailure, solveSuccessFlex, type FallbackLogEntry, type FailureKind } from './solver';
import type { TableGeometry } from './table/geometry';
import type { Ball, BallKind } from './types';
import { CONFIG } from '../config/game.config';

export type BreakLibrary = Partial<Record<LevelId, { redPottable: BreakEntry[]; snookered: BreakEntry[] }>>;
export interface PlayedShot { dir: { x: number; y: number }; speed: number; spin: number }

/** Simulate a shot from `balls` and report it the way the rules code wants it. */
export function simulate(balls: Ball[], table: TableGeometry, s: PlayedShot, cfg: PhysicsConfig = CONFIG.physics): ShotResult {
  const sim = createSim(balls, table, cfg);
  strike(sim, 'cue', s.dir, s.speed, s.spin);
  runUntilStill(sim);
  const first = sim.events.find((e) => e.type === 'ball');
  const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
  return { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
    after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: { ...b.pos } })) };
}

export function createPhysicsProvider(table: TableGeometry, library: BreakLibrary, now: () => number = () => 0) {
  const log: FallbackLogEntry[] = [];
  const provider: ShotProvider & { log: FallbackLogEntry[] } = {
    log,
    breakAndStep1(levelId, outcome, pick, frame) {
      const lib = library[levelId];
      const list = lib ? (outcome === 'snookered' ? lib.snookered : lib.redPottable) : [];
      if (!list.length) throw new Error(`no break-off library for ${levelId} (run npm run breaks)`);
      const e = list[Math.floor(pick * list.length)]!;
      const stored: StoredShot = outcome === 'success' ? e.step1Success! : outcome === 'plainMiss' ? e.step1Miss! : e.step1Escape!;
      return { afterBreak: { ...frame, balls: e.after }, breakShot: e.breakShot,
        step1: { result: simulate(e.after, table, stored), shot: stored } };
    },
    shot(frame: FrameState, target: BallKind, outcome: 'success' | FailureLabel, ctx): PlannedShot {
      if (outcome === 'success') {
        const f = solveSuccessFlex(frame, target, table, now, ctx);
        if (f.log) log.push(f.log);
        if (!f.shot) return { result: { firstHit: null, potted: [], after: frame.balls }, reRack: true };
        return { result: simulate(frame.balls, table, f.shot), shot: f.shot };
      }
      const kind: FailureKind = outcome === 'snookered' ? 'wrongBallFirst' : outcome;
      const s = solveFailure(frame, target, kind, table, now);
      if (!s) throw new Error('no failure shot (the gentle tap should always exist)');
      const label: FailureLabel = s.fallback === null ? outcome : s.fallback === 'plainMiss' ? 'plainMiss' : 'wrongBallFirst';
      return { result: simulate(frame.balls, table, s), shot: s, label };
    },
  };
  return provider;
}
