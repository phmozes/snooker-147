// 2026-11-27 small task 2 (PLAN 8.2): the pocket-camera cut. Playback only: the physics, the solver and the outcome do
// not change; the same recording is shown, part of it from a pocket camera and in slow motion.
// The rule is the same for a pot and for a rattle, so the cut can never hint at the result:
//   arrival = the first moment the target ball is within arriveRadius of the pocket's mouth middle, or its first jaw /
//   pot event at that pocket, whichever is first. The cut starts secondsBeforeArrival before that and ends
//   secondsAfterArrival after it (capped so the pocket camera is on screen at most maxSeconds real seconds), never
//   earlier because the balls stopped (that would differ between a pot and a rattle).
// Which camera (P1b or P2): a visual-only seeded stream (round seed, 'pocketCam', step), never the outcome stream.
// Pure (no rendering, no Math.random): the game page and the tests use the same functions.
import { CONFIG } from '../config/game.config';
import type { Recording } from '../core/physics/sim';
import { pocketCamDraw, type RngVersion } from '../core/round';
import type { Pocket, PocketId, TableGeometry } from '../core/table/geometry';

export type PocketView = 'P1b' | 'P2';
export interface CamPose { position: [number, number, number]; lookAt: [number, number, number]; fov: number }
export interface PocketCut { pocket: PocketId; view: PocketView; from: number; to: number; arrival: number }

const PC = CONFIG.pocketCut;
const V = CONFIG.camera.pocketViews;

/** Where the pocket camera stands and looks, for any of the 6 pockets (built from the pocket's throat axis). */
export function pocketCamPose(pocket: Pocket, view: PocketView): CamPose {
  const J = pocket.mouthMid, u = pocket.inward; // u: from the mouth into the pocket (away from the table)
  if (view === 'P1b') {
    const c = V.P1b, x = J.x + u.x * c.back, y = J.y + u.y * c.back, r = (c.tiltDeg * Math.PI) / 180;
    return { position: [x, y, c.height], lookAt: [x - u.x * Math.cos(r), y - u.y * Math.cos(r), c.height - Math.sin(r)], fov: c.fov };
  }
  const c = V.P2;
  return { position: [J.x + u.x * c.back, J.y + u.y * c.back, c.height], lookAt: [J.x + u.x * c.lookAhead, J.y + u.y * c.lookAhead, 0], fov: c.fov };
}

/** P1b or P2 for this round and step: visual-only stream, about p1bShare P1b. Same round code = same cameras. */
export function pickView(seed: number, step: number, rng: RngVersion): PocketView {
  return pocketCamDraw(seed, step, rng) < PC.p1bShare ? 'P1b' : 'P2';
}

/** The step groups of CONFIG.pocketCut.stepGroups (the failure mix changes a little with the step). */
export const STEP_GROUPS = PC.stepGroups.map((from, i) => {
  const next = PC.stepGroups[i + 1];
  return { from, label: next === undefined ? `${from}+` : `${from}-${next - 1}` };
});
/** The first step of the group that `step` belongs to. */
export const stepGroup = (step: number): number => [...(PC.stepGroups as readonly number[])].reverse().find((f) => step >= f) ?? PC.stepGroups[0]!;

/** The chance that a CUTTABLE shot of this level / step / outcome gets the automatic cut (0 on step 1). */
export function cutChance(levelId: string, step: number, outcome: string): number {
  if (step < PC.fromStep || outcome === 'reRack') return 0;
  const c = PC.cutChance[levelId];
  if (!c) return 0;
  return Math.min(1, outcome === 'success' ? c.success : c.failure[(PC.stepGroups as readonly number[]).indexOf(stepGroup(step))]!);
}

/** The automatic cut draw for this shot (visual-only stream; same round code = same answer). The shot is cut when
 *  this is true AND it is cuttable (planCut is not null). Outcome classes get different chances so that, over all
 *  shots, P(cut | success) = P(cut | failure) = CONFIG.pocketCut.rate (RULES B.6). */
export function autoCutDraw(levelId: string, step: number, outcome: string, seed: number, rng: RngVersion): boolean {
  const p = cutChance(levelId, step, outcome);
  return p > 0 && pocketCamDraw(seed, step, rng, 'cut') < p;
}

/** The cut for this recording (target ball sent to `pocketId`), or null when the ball never comes near that pocket. */
export function planCut(rec: Pick<Recording, 'events' | 'frames' | 'frameDt' | 'ids' | 'duration'>, table: TableGeometry,
  target: string, pocketId: PocketId, view: PocketView): PocketCut | null {
  const pocket = table.pockets.find((p) => p.id === pocketId);
  const n = rec.ids.indexOf(target);
  if (!pocket || n < 0) return null;
  let arrival = Infinity;
  const ev = rec.events.find((e) => (e.type === 'jaw' || e.type === 'pot') && e.a === target && e.pocket === pocketId);
  if (ev) arrival = ev.t;
  const M = pocket.mouthMid;
  for (let f = 0; f < rec.frames.length && f * rec.frameDt < arrival; f++) {
    const x = rec.frames[f]![2 * n]!, y = rec.frames[f]![2 * n + 1]!;
    if (Number.isNaN(x)) break;
    if (Math.hypot(x - M.x, y - M.y) <= PC.arriveRadius) { arrival = f * rec.frameDt; break; }
  }
  if (!Number.isFinite(arrival)) return null;
  const from = Math.max(0, arrival - PC.secondsBeforeArrival);
  // NOT cut short by the end of the recording: a clean pot often ends the shot sooner than a rattle, so a shorter
  // slow motion would hint at the result. If the balls stop first, the still table is held until `to`.
  const to = Math.min(arrival + PC.secondsAfterArrival, from + PC.maxSeconds * CONFIG.camera.slowMotionScale);
  return { pocket: pocketId, view, from, to, arrival };
}

/** Playback rate (shot seconds per real second) at shot time t: slow motion inside the cut, 1 outside. */
export const cutRateAt = (t: number, cut: PocketCut | null): number =>
  cut && t >= cut.from && t < cut.to ? CONFIG.camera.slowMotionScale : 1;

/** Shot time at which the playback ends: the recording's end, or the cut's end if that is later (still table held). */
export const playbackEnd = (duration: number, cut: PocketCut | null): number => Math.max(duration, cut?.to ?? 0);

/** Real seconds the slow motion adds to a shot (the held still table included, so pot and rattle add the same). */
export const addedSeconds = (cut: PocketCut | null): number =>
  cut ? (cut.to - cut.from) * (1 / CONFIG.camera.slowMotionScale - 1) : 0;
