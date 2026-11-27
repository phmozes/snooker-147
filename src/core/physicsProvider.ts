// The real ShotProvider for the round state machine (task 5.1): step 1 from the break-off library, later shots from the
// solver (success: flex chain with RE-RACK; failure: chosen type with the RULES D.2 fallbacks). Every shot is simulated
// once more here, so the round state gets exactly what the physics reports. Fallbacks are collected in `log`.

import type { BreakEntry, StoredShot } from './breakLibrary';
import { createSim, runUntilStill, strike, type PhysicsConfig } from './physics/sim';
import type { FailureLabel, LevelId, PlannedShot, RngVersion, ShotProvider } from './round';
import type { FrameState, ShotResult } from './rules';
import { chooseAutoColour, solveFailure, solveSuccessFlex, type FallbackLogEntry, type FailureKind, type SolvedShot } from './solver';
import type { TableGeometry } from './table/geometry';
import type { Ball, BallKind, Colour } from './types';
import { CONFIG } from '../config/game.config';

/** version: 3 in the v3 files (public/breaks-v3); the old files have none. A tagged library is refused for a round
 *  of another version (an old code must never replay on the new breaks); untagged ones (old files, test libraries)
 *  are used as given. */
export type BreakLibrary = Partial<Record<LevelId, { redPottable: BreakEntry[]; snookered: BreakEntry[]; version?: number }>>;

/** The break-off library of a round version (night 6): 'v3' for v3 rounds, else the old one (public/breaks). */
export const breakLibraryOf = (rng: RngVersion): 'old' | 'v3' => (rng === 3 ? 'v3' : 'old');

/** The library files (in public/) for a round version: v3 rounds the new ones, v1 / v2 rounds the old ones. */
export const breakFilesFor = (rng: RngVersion): Record<LevelId, string> =>
  breakLibraryOf(rng) === 'v3' ? CONFIG.breakLibrary.filesV3 : CONFIG.breakLibrary.files;
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
  // the automatic colour pick (RULES B.3) already ran the chosen colour's normal search: reuse it for the success shot
  let picked: { frame: FrameState; colour: Colour; normal: SolvedShot | null; tried: number } | null = null;
  const provider: ShotProvider & { log: FallbackLogEntry[] } = {
    log,
    autoColour(frame) {
      if (picked?.frame !== frame) picked = { frame, ...chooseAutoColour(frame, table, now) };
      return picked.colour;
    },
    breakAndStep1(levelId, outcome, pick, frame, rng) {
      const lib = library[levelId];
      if (lib?.version !== undefined && rng !== undefined && lib.version !== (breakLibraryOf(rng) === 'v3' ? 3 : 2))
        throw new Error(`break-off library v${lib.version} cannot play a v${rng} round (${levelId})`);
      const list = lib ? (outcome === 'snookered' ? lib.snookered : lib.redPottable) : [];
      if (!list.length) throw new Error(`no break-off library for ${levelId} (run npm run breaks)`);
      const e = list[Math.floor(pick * list.length)]!;
      const stored: StoredShot = outcome === 'success' ? e.step1Success! : outcome === 'plainMiss' ? e.step1Miss! : e.step1Escape!;
      return { afterBreak: { ...frame, balls: e.after }, breakShot: { cueStart: e.cueStart, shot: e.breakShot },
        step1: { result: simulate(e.after, table, stored), shot: stored } };
    },
    shot(frame: FrameState, target: BallKind, outcome: 'success' | FailureLabel, ctx): PlannedShot {
      if (outcome === 'success') {
        const pre = picked && picked.frame === frame && picked.colour === target ? { normal: picked.normal, tried: picked.tried } : undefined;
        const f = solveSuccessFlex(frame, target, table, now, ctx, CONFIG.physics, pre);
        if (f.log) log.push(f.log);
        if (!f.shot) return { result: { firstHit: null, potted: [], after: frame.balls }, reRack: true, tried: f.tried };
        return { result: simulate(frame.balls, table, f.shot), shot: f.shot, tried: f.tried };
      }
      const kind: FailureKind = outcome === 'snookered' ? 'wrongBallFirst' : outcome;
      const s = solveFailure(frame, target, kind, table, now);
      if (!s) throw new Error('no failure shot (the gentle tap should always exist)');
      const label: FailureLabel = s.fallback === null ? outcome : s.fallback === 'plainMiss' ? 'plainMiss' : 'wrongBallFirst';
      return { result: simulate(frame.balls, table, s), shot: s, label, tried: s.tried };
    },
  };
  return provider;
}
