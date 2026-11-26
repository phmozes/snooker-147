// Night 4, Part 3b (docs/SLOW-SHOTS.md option 1): faster PLAYBACK of the end of a shot. Playback only: the physics,
// the solver and the outcome do not change; the same recording is shown, its end just runs faster.
// Rule (the same for success and failure shots, so the speed-up can never hint at a result early): the speed-up may
// start only once the result is already visible on screen:
//   - every ball that this shot will pot is down (the last pot event of the recording), AND
//   - the object ball (the first ball the cue ball touches) has come to rest or dropped, AND
//   - the cue ball has touched a ball at all (a shot that touches nothing is never sped up).
// From that moment the playback rate eases from 1x to `rate` over `ease` seconds (smoothstep), never a jump.
// Pure (no rendering, no Math.random): the game page and the soak use the same functions.
import type { Recording } from '../core/physics/sim';

export interface FastEndConfig { enabled: boolean; rate: number; ease: number; minRest: number }

/** The moment (seconds into the shot) from which the result is visible; null = never (no speed-up for this shot). */
export function resultVisibleAt(rec: Pick<Recording, 'events' | 'frames' | 'frameDt' | 'ids' | 'duration'>): number | null {
  const first = rec.events.find((e) => e.type === 'ball' && (e.a === 'cue' || e.b === 'cue'));
  if (!first || first.type !== 'ball') return null;
  const obj = first.a === 'cue' ? first.b : first.a;
  const lastPot = Math.max(0, ...rec.events.filter((e) => e.type === 'pot').map((e) => e.t));
  // the object ball: dropped (its pot event) or the last frame in which it still moved
  const objPot = rec.events.find((e) => e.type === 'pot' && e.a === obj);
  let objDone: number;
  if (objPot) objDone = objPot.t;
  else {
    const n = rec.ids.indexOf(obj);
    let last = 0;
    for (let f = 1; f < rec.frames.length; f++) {
      const a = rec.frames[f - 1]!, b = rec.frames[f]!;
      if (Math.abs(b[2 * n]! - a[2 * n]!) > 1e-6 || Math.abs(b[2 * n + 1]! - a[2 * n + 1]!) > 1e-6) last = f;
    }
    objDone = last * rec.frameDt;
  }
  return Math.max(lastPot, objDone, first.t);
}

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** Playback rate (shot seconds per real second) at shot time t. */
export function rateAt(t: number, from: number | null, c: FastEndConfig): number {
  if (!c.enabled || from === null) return 1;
  return 1 + (c.rate - 1) * smooth((t - from) / c.ease);
}

/** How long the playback of this recording takes on screen (real seconds), with or without the faster end. */
export function playbackSeconds(rec: Pick<Recording, 'events' | 'frames' | 'frameDt' | 'ids' | 'duration'>, c: FastEndConfig): number {
  const from = startOf(rec, c);
  if (from === null) return rec.duration;
  // integrate dt_real = dt_shot / rate(t) after `from` (fine steps; the ease part is short)
  let real = from, t = from;
  const h = 1 / 240;
  while (t < rec.duration) { const step = Math.min(h, rec.duration - t); real += step / rateAt(t + step / 2, from, c); t += step; }
  return real;
}

/** The shot time from which this recording is sped up, or null (switch off, result never visible, or too little left). */
export function startOf(rec: Pick<Recording, 'events' | 'frames' | 'frameDt' | 'ids' | 'duration'>, c: FastEndConfig): number | null {
  if (!c.enabled) return null;
  const from = resultVisibleAt(rec);
  if (from === null || rec.duration - from < c.minRest) return null;
  return from;
}
