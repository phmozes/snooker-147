// Playback of a recorded shot: ball positions at any moment, by straight-line blending between the stored frames.
// Pure (no rendering). The 2D and 3D views both read their positions from here, so they always show the same shot.

import type { Recording } from '../core/physics/sim';
import type { BallKind, Vec2 } from '../core/types';

/** Position of every ball at time t (seconds from the start of the shot). null = the ball has dropped. */
export function positionsAt(rec: Recording, t: number): (Vec2 | null)[] {
  const last = rec.frames.length - 1;
  const f = Math.max(0, Math.min(last, t / rec.frameDt));
  const i = Math.min(last, Math.floor(f));
  const j = Math.min(last, i + 1);
  const k = f - i;
  const a = rec.frames[i]!;
  const b = rec.frames[j]!;
  return rec.ids.map((_, n) => {
    const ax = a[2 * n]!;
    const bx = b[2 * n]!;
    if (Number.isNaN(ax)) return null; // dropped already
    if (Number.isNaN(bx)) return { x: ax, y: a[2 * n + 1]! }; // drops before the next frame: hold, then gone
    return { x: ax + (bx - ax) * k, y: a[2 * n + 1]! + (b[2 * n + 1]! - a[2 * n + 1]!) * k };
  });
}

/** Plain gray-box ball colours, shared by the 2D and 3D views. */
export const BALL_COLOURS: Record<BallKind, string> = {
  cue: '#f4f4ef', red: '#d7322f', yellow: '#f2c94c', green: '#1f9d55', brown: '#8b5a2b',
  blue: '#2f6fdb', pink: '#f29cb8', black: '#151515',
};

/** Gravity of the drawn fall of a potted ball (table3d.ts), m/s². Visual only. */
export const DROP_GRAVITY = 9.81;

/** Bug 2026-11-27 (drop sound early): the shot time at which a potted ball is SEEN dropping, i.e. the drawn ball's
 *  centre reaches the cloth (half of it below the cloth). The view (table3d.ts) starts the fall when the playback
 *  first shows the ball as gone (the first recorded frame without it, positionsAt above) and lets it fall with
 *  DROP_GRAVITY for at most dropSeconds; the view clock runs at the playback speed, so this is shot time and the same
 *  at normal speed, in the pocket-camera slow motion and in the clearance replay. drawnRadius = ball radius x ballScale.
 *  Null if the ball is never potted in the recording. Pure. */
export function dropSeenAt(rec: Pick<Recording, 'frames' | 'frameDt' | 'ids'>, id: string, drawnRadius: number,
  dropSeconds: number): number | null {
  const n = rec.ids.indexOf(id);
  if (n < 0) return null;
  const f = rec.frames.findIndex((fr) => Number.isNaN(fr[2 * n]!));
  if (f < 0) return null;
  return f * rec.frameDt + Math.min(Math.max(0, dropSeconds), Math.sqrt((2 * drawnRadius) / DROP_GRAVITY));
}
