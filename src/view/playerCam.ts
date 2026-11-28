// 2026-11-28 (owner, mockups/player-cam3; RULES B.7): the player's view cameras V1 / V2 / V3. Playback only: the
// physics, the solver and the outcome never see this file.
// Which camera: pickPlayerCam reads ONLY (round seed, step, rng version) from its own stream (round.ts playerCamDraw),
// so the pick is made before the outcome is used and is the same for a pot and a miss. The pocket cut comes first
// (pocketCam.ts, unchanged); on a shot without a cut the pick is shown.
// Where the follow looks: followInputOf reads ONLY the AIMED pocket (shot.aim, or the aimOf rule for a shot without an
// aim), the target ball's place before the shot, the cue ball's place and the planned cue direction. Never the
// recording, where a ball went or whether it dropped. The move runs on a fixed clock from the hit.
// Pure (no rendering, no Math.random): the game page and the tests use the same functions.
import { CONFIG } from '../config/game.config';
import { playerCamDraw, type RngVersion } from '../core/round';
import type { PocketId, TableGeometry } from '../core/table/geometry';
import type { Vec2 } from '../core/types';
import { autoCutDraw } from './pocketCam';

const PCAM = CONFIG.playerCam;
const FW = PCAM.follow;
const FX = PCAM.fixes;

export type PlayerCamId = 'TODAY' | 'V1' | 'V2' | 'V3';
export type ShotCamera = PlayerCamId | 'POCKET';
export const PLAYER_CAMS: PlayerCamId[] = ['TODAY', 'V1', 'V2', 'V3'];

/** The player's view camera for this round and step. Inputs: seed, step, rng version. Nothing else (no outcome). */
export function pickPlayerCam(seed: number, step: number, rng: RngVersion): PlayerCamId {
  if (!PCAM.enabled || step < PCAM.fromStep) return 'TODAY';
  const u = playerCamDraw(seed, step, rng);
  let acc = 0;
  for (const id of PLAYER_CAMS) { acc += PCAM.shares[id]; if (u < acc) return id; }
  return 'TODAY';
}

/** The camera a shot is shown with: the pocket cut first (exactly today's rule: its draw, its chances, and only when the
 *  shot is cuttable), else the player's view pick. `cuttable` = pocketCam.ts planCut found the cut window. */
export function shotCamera(levelId: string, step: number, outcome: string, seed: number, rng: RngVersion, cuttable: boolean): ShotCamera {
  const pick = pickPlayerCam(seed, step, rng); // made first, from its own stream only
  if (cuttable && autoCutDraw(levelId, step, outcome, seed, rng)) return 'POCKET';
  return pick;
}

// ---------------- the aimed pocket ----------------
export interface ShotAimFields { aim?: { ball: string; pocket: PocketId }; dir: Vec2 }
interface BallAt { id: string; kind: string; pos: Vec2 }

/** RULES B.7: the pocket (and ball) a shot is AIMED at. The solver's aim when it has one; otherwise (soft foul, gentle
 *  tap, spray) from the layout and the planned cue direction only: the first ball on the cue ball's path (ghost-ball
 *  contact), and the pocket closest in direction to that ball's line from the contact; with no ball on the path, the
 *  pocket closest in direction to the cue ball's own line. Never reads where a ball went. */
export function aimOf(shot: ShotAimFields, before: BallAt[], table: TableGeometry): { ball: string | null; pocket: PocketId } {
  if (shot.aim) return { ball: shot.aim.ball, pocket: shot.aim.pocket };
  const cue = before.find((b) => b.kind === 'cue')!;
  const C = cue.pos, dl = Math.hypot(shot.dir.x, shot.dir.y) || 1, d = { x: shot.dir.x / dl, y: shot.dir.y / dl };
  const r = table.ballRadius;
  let best: { b: BallAt; t: number; lat: number } | null = null;
  for (const b of before) {
    if (b.kind === 'cue') continue;
    const rx = b.pos.x - C.x, ry = b.pos.y - C.y, t = rx * d.x + ry * d.y, lat = Math.abs(rx * d.y - ry * d.x);
    if (t > 0 && lat < 2 * r && (!best || t < best.t)) best = { b, t, lat };
  }
  let from = C, u = d;
  if (best) {
    const back = Math.sqrt(Math.max(0, 4 * r * r - best.lat * best.lat));
    const G = { x: C.x + d.x * (best.t - back), y: C.y + d.y * (best.t - back) }, O = best.b.pos;
    const ul = Math.hypot(O.x - G.x, O.y - G.y) || 1;
    from = O; u = { x: (O.x - G.x) / ul, y: (O.y - G.y) / ul };
  }
  let pocket = table.pockets[0]!.id, bestCos = -2;
  for (const p of table.pockets) {
    const vx = p.mouthMid.x - from.x, vy = p.mouthMid.y - from.y, l = Math.hypot(vx, vy) || 1, c = (vx * u.x + vy * u.y) / l;
    if (c > bestCos) { bestCos = c; pocket = p.id; }
  }
  return { ball: best ? best.b.id : null, pocket };
}

/** Everything the follow may know (RULES B.7): the aimed pocket, the target ball's place before the shot (the cue ball's
 *  when no ball is aimed at), the cue ball's place, and the planned cue direction (unit). Nothing else. */
export interface FollowInput { pocket: PocketId; ball: Vec2; cue: Vec2; dir: Vec2 }
export const FOLLOW_INPUT_KEYS = ['ball', 'cue', 'dir', 'pocket'] as const;

/** Builds the follow input from the planned shot and the balls before it (reads shot.aim and shot.dir only). */
export function followInputOf(shot: ShotAimFields, before: BallAt[], table: TableGeometry): FollowInput {
  const a = aimOf(shot, before, table);
  const cue = before.find((b) => b.kind === 'cue')!.pos;
  const ball = (a.ball !== null ? before.find((b) => b.id === a.ball)?.pos : undefined) ?? cue;
  const dl = Math.hypot(shot.dir.x, shot.dir.y) || 1;
  return { pocket: a.pocket, ball: { x: ball.x, y: ball.y }, cue: { x: cue.x, y: cue.y }, dir: { x: shot.dir.x / dl, y: shot.dir.y / dl } };
}

// ---------------- poses ----------------
export interface Pose { pos: [number, number, number]; at: [number, number, number]; fov: number }
export interface Heights { railZ: number }
const ss = (k: number) => k * k * (3 - 2 * k);
const cl = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const DEG = Math.PI / 180;

/** The orbit blend (round 2, H3): the look-at point moves in a straight line; the camera's angle above the cloth, its
 *  compass direction and its distance from that point are blended separately, so the angle stays between the two ends
 *  (never steeper than the steeper end) and the camera never dives towards the cloth. */
export function orbit(A: Pose, B: Pose, k: number): Pose {
  const sph = (P: Pose) => { const dx = P.pos[0] - P.at[0], dy = P.pos[1] - P.at[1], dz = P.pos[2] - P.at[2], D = Math.hypot(dx, dy, dz); return { D, el: Math.asin(dz / D), yaw: Math.atan2(dy, dx) }; };
  const a = sph(A), c = sph(B);
  let dy = c.yaw - a.yaw;
  while (dy > Math.PI) dy -= 2 * Math.PI;
  while (dy < -Math.PI) dy += 2 * Math.PI;
  const at = A.at.map((v, i) => lerp(v, B.at[i]!, k)) as [number, number, number];
  const D = lerp(a.D, c.D, k), el = lerp(a.el, c.el, k), yaw = a.yaw + dy * k;
  return { pos: [at[0] + D * Math.cos(el) * Math.cos(yaw), at[1] + D * Math.cos(el) * Math.sin(yaw), at[2] + D * Math.sin(el)], at, fov: lerp(A.fov, B.fov, k) };
}

/** The hold (V1 / V2 / V3): behind the cue ball on the planned cue line, with the H1 fixes (over the cue, over the rail).
 *  cueEl = the cue's raised-butt angle (radians) of this shot, from the layout (table3d planCue). rs = drawn ball radius. */
export function holdPose(cam: Exclude<PlayerCamId, 'TODAY'>, C: Vec2, dir: Vec2, cueEl: number, table: TableGeometry, heights: Heights, rs: number): Pose & { raised: string[] } {
  const V = PCAM.views[cam];
  const dl = Math.hypot(dir.x, dir.y) || 1, d = { x: dir.x / dl, y: dir.y / dl };
  let h = V.h;
  const raised: string[] = [];
  const cueZ = rs + V.back * Math.tan(cueEl);
  if (h < cueZ + FX.overCue - 0.005) { h = cueZ + FX.overCue; raised.push('cue'); }
  const x = C.x - d.x * V.back, y = C.y - d.y * V.back;
  if ((Math.abs(x) > table.halfWidth || Math.abs(y) > table.halfLength) && h < heights.railZ + FX.overRail) { h = heights.railZ + FX.overRail; raised.push('rail'); }
  return { pos: [x, y, h], at: [C.x + d.x * V.ahead, C.y + d.y * V.ahead, 0], fov: V.fov, raised };
}

/** The end of the V1 / V2 follow (F2): looks at the aimed pocket's mouth from 30° above the cloth, at most 1.5 m away
 *  (a middle pocket: middleEnd, 50° and 1.8 m),
 *  from a spot slid at most 0.8 m from the hold towards the pot line behind the target ball. Inputs: the hold and the
 *  FollowInput only. */
export function followPose(hold: Pose, f: FollowInput, table: TableGeometry): Pose {
  const pk = table.pockets.find((p) => p.id === f.pocket)!;
  const mouth = pk.mouthMid, ob = f.ball;
  const ux0 = ob.x - mouth.x, uy0 = ob.y - mouth.y, ul = Math.hypot(ux0, uy0) || 1;
  const ux = ux0 / ul, uy = uy0 / ul, Dl = Math.min(ul + FW.behind, FW.lineMax);
  let nx = -uy, ny = ux;
  if ((hold.pos[0] - mouth.x) * nx + (hold.pos[1] - mouth.y) * ny < 0) { nx = -nx; ny = -ny; }
  const side = ul + FW.behind > FW.lineMax ? FW.side : 0;
  const ideal = { x: mouth.x + ux * Dl + nx * side, y: mouth.y + uy * Dl + ny * side };
  const sx = ideal.x - hold.pos[0], sy = ideal.y - hold.pos[1];
  const sl = Math.hypot(sx, sy), lim = Math.min(1, FW.slide / (sl || 1));
  let px = hold.pos[0] + sx * lim, py = hold.pos[1] + sy * lim;
  const inX = table.halfWidth - FW.clothInset, inY = table.halfLength - FW.clothInset;
  if (Math.abs(px) > inX && Math.abs(px) > Math.abs(hold.pos[0])) px = Math.sign(px) * Math.max(inX, Math.abs(hold.pos[0]));
  if (Math.abs(py) > inY && Math.abs(py) > Math.abs(hold.pos[1])) py = Math.sign(py) * Math.max(inY, Math.abs(hold.pos[1]));
  const hor = Math.hypot(px - mouth.x, py - mouth.y);
  if (pk.kind === 'middle') return middleEnd(hold, mouth, px - mouth.x, py - mouth.y);
  const el = FW.liftDeg * DEG;
  const D = Math.min(Math.hypot(hor, hold.pos[2]), FW.maxDist);
  const h = D * Math.cos(el), yaw = Math.atan2(py - mouth.y, px - mouth.x);
  const pos: [number, number, number] = [mouth.x + h * Math.cos(yaw), mouth.y + h * Math.sin(yaw), D * Math.sin(el)];
  const fov = Math.max(FW.minFov, Math.min(hold.fov, (2 * Math.atan(FW.frameWidth / 2 / D) / DEG) * FW.fovFactor));
  return { pos, at: [mouth.x, mouth.y, 0], fov };
}

/** The follow's end when the AIMED pocket is a middle pocket (owner 2026-11-28): from the same compass direction as a
 *  corner end (but pointing onto the cloth at least FW.middle.minInward), always FW.middle.dist from the mouth at
 *  FW.middle.liftDeg above the cloth, looking a little onto the cloth, zoomed to about FW.middle.frameWidth. */
function middleEnd(hold: Pose, mouth: Vec2, vx0: number, vy0: number): Pose {
  const M = FW.middle, inX = -Math.sign(mouth.x) || 1; // middle pockets sit on the long cushions (x = +-halfWidth)
  let vl = Math.hypot(vx0, vy0);
  let vx = vl > 1e-9 ? vx0 / vl : inX, vy = vl > 1e-9 ? vy0 / vl : 0;
  if (vx * inX < M.minInward) { vx = inX * M.minInward; vy = (Math.sign(vy) || 1) * Math.sqrt(1 - M.minInward * M.minInward); }
  vl = Math.hypot(vx, vy); vx /= vl; vy /= vl;
  const el = M.liftDeg * DEG, D = M.dist, h = D * Math.cos(el);
  const at: [number, number, number] = [mouth.x + vx * M.atInward, mouth.y + vy * M.atInward, 0];
  const pos: [number, number, number] = [mouth.x + vx * h, mouth.y + vy * h, D * Math.sin(el)];
  const fov = Math.max(FW.minFov, Math.min(hold.fov, (2 * Math.atan(M.frameWidth / 2 / D) / DEG) * FW.fovFactor));
  return { pos, at, fov };
}

/** H2/H3 on every frame of a move: outside the cloth at least overRail above the rail top; never lower than the hold
 *  height (or minHeight, whichever is lower). */
export function keepClear(P: Pose, hold: Pose, table: TableGeometry, heights: Heights): Pose {
  let z = P.pos[2];
  if (Math.abs(P.pos[0]) > table.halfWidth || Math.abs(P.pos[1]) > table.halfLength) z = Math.max(z, heights.railZ + FX.overRail);
  z = Math.max(z, Math.min(hold.pos[2], FX.minHeight));
  return z === P.pos[2] ? P : { ...P, pos: [P.pos[0], P.pos[1], z] };
}

/** One shot's player's view: everything is fixed before the shot plays (hold, follow end). */
export interface PlayerCamPlan { cam: Exclude<PlayerCamId, 'TODAY'>; hold: Pose; follow: Pose | null }

export function planPlayerCam(cam: Exclude<PlayerCamId, 'TODAY'>, f: FollowInput, cueEl: number, table: TableGeometry, heights: Heights, rs: number): PlayerCamPlan {
  const hold = holdPose(cam, f.cue, f.dir, cueEl, table, heights, rs);
  return { cam, hold, follow: cam === 'V3' ? null : followPose(hold, f, table) };
}

/** The camera at `sinceHit` seconds after the tip hits the cue ball (negative = during the stroke: the hold). `main` =
 *  the main camera now. seeThrough: H2 is on (balls between the camera and the cue ball drawn see-through). */
export function playerCamPose(plan: PlayerCamPlan, sinceHit: number, main: Pose, table: TableGeometry, heights: Heights): { pose: Pose; seeThrough: boolean; done: boolean } {
  if (plan.cam === 'V3') {
    const k = ss(cl(sinceHit / PCAM.v3RiseSeconds));
    return { pose: orbit(plan.hold, main, k), seeThrough: k <= FX.seeThroughUntil, done: k >= 1 };
  }
  const k = ss(cl((sinceHit - FW.startAfterHit) / FW.moveSeconds));
  return { pose: keepClear(orbit(plan.hold, plan.follow!, k), plan.hold, table, heights), seeThrough: k <= FX.seeThroughUntil, done: false };
}

/** R2: the glide back to the main camera, `since` seconds after the balls stopped (from the pose shown then). */
export function glideBack(from: Pose, main: Pose, since: number): { pose: Pose; done: boolean } {
  const T = PCAM.glideBackSeconds;
  const k = T > 0 ? ss(cl(since / T)) : 1;
  return { pose: orbit(from, main, k), done: since >= T };
}

/** Owner 2026-11-28 (3.5 s rule): no glide when the shot is already longer than longShotSeconds when the balls stop
 *  (`shotSeconds` = from the start of the cue's stroke); the camera cuts back to the main camera at once. */
export const glideSkipped = (shotSeconds: number): boolean => shotSeconds > PCAM.longShotSeconds;

/** Seconds the glide back adds once the balls have stopped (0 when the camera is already at the main camera, or when
 *  the shot is long: glideSkipped). */
export const glideSeconds = (cam: ShotCamera, sinceHitAtEnd: number, shotSeconds = 0): number =>
  glideSkipped(shotSeconds) ? 0
    : cam === 'V1' || cam === 'V2' ? PCAM.glideBackSeconds
    : cam === 'V3' && sinceHitAtEnd < PCAM.v3RiseSeconds ? PCAM.glideBackSeconds : 0;
