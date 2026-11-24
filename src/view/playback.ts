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
