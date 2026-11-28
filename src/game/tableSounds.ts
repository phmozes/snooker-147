// PLAN 9.1 / 9.2: the table sounds (cue strike, ball hits ball, cushion and jaw hits, ball drops into a pocket), played from
// the shot recording's events while the shot plays on screen. Sound only: it reads the recording, never changes it.
// Web Audio (no library). Phones only allow sound after a user tap: nothing loads or plays before the first tap.
// The mute button (sound.ts) silences everything at once and is remembered on the device.
import { CONFIG } from '../config/game.config';
import type { Recording } from '../core/physics/sim';
import { dropSeenAt } from '../view/playback';
import type { ApplauseLevel } from './applause';
import { isMuted, onMuteChange } from './sound';

// + the opponent's break-off (one sound for the cue ball hitting the pack), the 6 applause levels and the button tap.
type Name = 'cue' | 'ball-soft' | 'ball-hard' | 'cushion' | 'pocket' | 'break' | 'tap' | 'miss' | `applause-${ApplauseLevel}`;
const NAMES: Name[] = ['cue', 'ball-soft', 'ball-hard', 'cushion', 'pocket', 'break', 'tap', 'miss',
  'applause-1', 'applause-2', 'applause-3', 'applause-4', 'applause-5', 'applause-6'];
const U = CONFIG.sound.uiSounds;
const S = CONFIG.sound.tableHits;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<Name, AudioBuffer>();
const voices: AudioBufferSourceNode[] = [];
const lastAt = new Map<string, number>();

/** Volume 0..1 for impact speed s (0 = silent). The rule is in game.config.ts sound.tableHits. */
export function impactVolume(s: number, r: { min: number; max: number; floor: number; gain?: number }): number {
  if (!(s >= r.min)) return 0; // also NaN
  const k = Math.min(1, Math.max(0, (s - r.min) / (r.max - r.min)));
  return Math.min(1, r.floor + (1 - r.floor) * k ** S.curve) * (r.gain ?? 1);
}

function unlock() {
  if (ctx) { void ctx.resume(); return; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = CONFIG.sound.masterVolume;
  master.connect(ctx.destination);
  void ctx.resume();
  for (const n of NAMES) if (!n.startsWith('applause-')) fetchSound(n);
  if (applauseWanted) loadApplause();
}
function fetchSound(n: Name) {
  fetch(`${import.meta.env.BASE_URL}sounds/${n}.mp3`)
    .then((r) => r.arrayBuffer()).then((a) => ctx!.decodeAudioData(a)).then((b) => { buffers.set(n, b); })
    .catch(() => { /* no file or no decoder: that sound stays silent */ });
}
/** Owner 2026-11-28 (speed): the 6 applause files (259 KB) load after the first break-off has started, not on the
 *  first tap, so the first START downloads less. Called once a break-off starts; later calls do nothing. */
let applauseWanted = false, applauseAsked = false;
export function loadApplause() {
  applauseWanted = true;
  if (!ctx || applauseAsked) return; // no sound system yet: unlock() loads them
  applauseAsked = true;
  for (const n of NAMES) if (n.startsWith('applause-')) fetchSound(n);
}
/** Call once at page start: the first tap anywhere switches the sound system on (phone rule). */
export function initTableSounds() {
  for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) document.addEventListener(ev, unlock, { capture: true, passive: true });
  onMuteChange((m) => { if (m) stopAll(); });
}

function stopAll() { for (const v of voices.splice(0)) try { v.stop(); } catch { /* already ended */ } }

function play(name: Name, volume: number, key: string, ui = false): AudioBufferSourceNode | null {
  if (volume <= 0 || isMuted() || !ctx || !master || ctx.state !== 'running') return null;
  const buf = buffers.get(name);
  if (!buf) return null;
  const now = performance.now();
  if (now - (lastAt.get(key) ?? -1e9) < S.minGapMs) return null; // one contact recorded twice in a row: one sound
  lastAt.set(key, now);
  if (!ui && voices.length >= S.maxVoices) return null; // enough sounds already: the newest hit is the one left out
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(master);
  src.onended = () => { const i = voices.indexOf(src); if (i >= 0) voices.splice(i, 1); };
  voices.push(src);
  src.start();
  if (import.meta.env.DEV) ((window as unknown as { __soundLog?: { name: Name; at: number; key: string }[] }).__soundLog ??= []).push({ name, at: now, key }); // scripts/sound-check.mjs
  return src;
}

/** Owner 2026-11-27: applause level 1-6 (when each plays: applause.ts). Never waits for anything; a new applause stops
 *  the one still playing; mute stops it (stopAll). */
let applause: AudioBufferSourceNode | null = null;
export function playApplause(level: ApplauseLevel) {
  if (applause) { try { applause.stop(); } catch { /* already ended */ } applause = null; }
  applause = play(`applause-${level}`, U.applauseVolume, 'applause', true);
}
/** Owner 2026-11-27 (pick B): the crowd "oh" after a failed shot, once, at missMoment. Mute stops it (stopAll). */
export const playMiss = () => play('miss', U.missVolume, 'miss', true);

/** The shot time at which a failed shot's failure is clear on screen, so the miss sound gives nothing away early
 *  (owner 2026-11-27). label = the shot's failure label (round history):
 *  - jawRattle: when the target ball comes to rest outside the pocket for good (after the rattle has been seen);
 *  - inOff: when the cue ball is seen dropping (potHeardAt: the same moment as its pocket sound);
 *  - every other failure (plain miss, wrong ball first / foul, snookered escape): when all balls have stopped.
 *  Falls back to "all balls stopped" if the recording does not show what the label says. */
export function missMoment(rec: Recording, label: string, target: string | undefined, drawnRadius: number): number {
  if (label === 'inOff') {
    const e = rec.events.find((x) => x.type === 'pot' && x.a === 'cue');
    if (e) return potHeardAt(rec, e.t, 'cue', drawnRadius);
  }
  if (label === 'jawRattle' && target) {
    const n = rec.ids.indexOf(target);
    const jaw = rec.events.find((x) => x.type === 'jaw' && x.a === target);
    if (n >= 0 && jaw && !rec.events.some((x) => x.type === 'pot' && x.a === target)) {
      // the last recorded frame in which the target still moves; from the next one on it is at rest for good
      let f = rec.frames.length - 1;
      const at = (i: number) => rec.frames[i]!;
      while (f > 0 && Math.abs(at(f)[2 * n]! - at(f - 1)[2 * n]!) < 1e-9 && Math.abs(at(f)[2 * n + 1]! - at(f - 1)[2 * n + 1]!) < 1e-9) f--;
      return Math.min(rec.duration, Math.max(jaw.t, f * rec.frameDt));
    }
  }
  return rec.duration;
}
/** PLAN 9.2: a UI button was pressed. */
export const playTap = () => play('tap', U.tapVolume, 'tap', true);

/** The cue hits the cue ball (speed = the shot's cue speed, m/s). */
export const playCueStrike = (speed: number) => play('cue', impactVolume(speed, S.cue), 'cue');

/** Speed of ball `id` just before it dropped (from the recorded frames), m/s. */
function dropSpeed(rec: Recording, id: string, t: number): number {
  const n = rec.ids.indexOf(id);
  let f = Math.min(rec.frames.length - 1, Math.floor(t / rec.frameDt));
  while (f > 0 && Number.isNaN(rec.frames[f]![2 * n]!)) f--;
  if (f < 1) return 0;
  const a = rec.frames[f - 1]!, b = rec.frames[f]!;
  return Math.hypot(b[2 * n]! - a[2 * n]!, b[2 * n + 1]! - a[2 * n + 1]!) / rec.frameDt;
}

/** The opponent's break-off: the moment the cue ball first hits another ball (the pack), or null. */
export function breakOffMoment(rec: Recording): number | null {
  const e = rec.events.find((x) => x.type === 'ball' && (x.a === 'cue' || x.b === 'cue'));
  return e ? e.t : null;
}

/** Bug 2026-11-27: the shot time a pot is HEARD = when the ball is seen dropping on screen (its drawn centre reaches the
 *  cloth, playback.ts dropSeenAt), not the physics pot moment (about 0.1 s earlier). The milestone applause uses it too.
 *  drawnRadius = ball radius x the drawn ball scale. Falls back to the physics moment if the ball never leaves the frames. */
export function potHeardAt(rec: Recording, potT: number, ball: string, drawnRadius: number): number {
  return dropSeenAt(rec, ball, drawnRadius, CONFIG.view3d.dropSeconds) ?? potT;
}
/** The latest moment any sound of this recording is heard (a pot can be heard after the recording's end). */
export function lastSoundAt(rec: Recording, drawnRadius: number): number {
  let m = rec.duration;
  for (const e of rec.events) if (e.type === 'pot') m = Math.max(m, potHeardAt(rec, e.t, e.a, drawnRadius));
  return m;
}

/** Play every recorded event heard at prevT < time <= t (seconds of the shot). The caller moves t at the speed the shot
 *  is shown (slow motion included), so the sounds come exactly when the balls touch on screen; a pot when the drawn
 *  ball is seen dropping (potHeardAt). breakAt (the opponent's break-off only): one break sound at that moment instead
 *  of the ball-ball hits of the next breakOff.muteBallSeconds. */
export function playEventsBetween(rec: Recording, prevT: number, t: number, drawnRadius: number, breakAt: number | null = null) {
  if (!ctx || isMuted() || t <= prevT) return;
  if (breakAt !== null && breakAt > prevT && breakAt <= t) play('break', S.breakOff.volume, 'break');
  for (const e of rec.events) {
    const at = e.type === 'pot' ? potHeardAt(rec, e.t, e.a, drawnRadius) : e.t;
    if (at <= prevT || at > t) continue;
    if (e.type === 'ball') {
      if (breakAt !== null && e.t >= breakAt && e.t < breakAt + S.breakOff.muteBallSeconds) continue;
      const v = impactVolume(e.speed, S.ball);
      play(e.speed >= S.ball.hardFrom ? 'ball-hard' : 'ball-soft', v, e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`);
    } else if (e.type === 'cushion' || e.type === 'jaw') play('cushion', impactVolume(e.speed, S.cushion), `${e.a}|c`);
    else if (e.type === 'pot') play('pocket', impactVolume(dropSpeed(rec, e.a, e.t), S.pocket), `${e.a}|p`);
  }
}
