// PLAN 9.1 / 9.2: the table sounds (cue strike, ball hits ball, cushion and jaw hits, ball drops into a pocket), played from
// the shot recording's events while the shot plays on screen. Sound only: it reads the recording, never changes it.
// Web Audio (no library). Phones only allow sound after a user tap: nothing loads or plays before the first tap.
// The mute button (sound.ts) silences everything at once and is remembered on the device.
import { CONFIG } from '../config/game.config';
import type { Recording } from '../core/physics/sim';
import { isMuted, onMuteChange } from './sound';

// + the opponent's break-off (one sound for the cue ball hitting the pack), the win applause and the button tap.
type Name = 'cue' | 'ball-soft' | 'ball-hard' | 'cushion' | 'pocket' | 'break' | 'win' | 'tap';
const NAMES: Name[] = ['cue', 'ball-soft', 'ball-hard', 'cushion', 'pocket', 'break', 'win', 'tap'];
const U = CONFIG.sound.uiSounds;
const S = CONFIG.sound.tableHits;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<Name, AudioBuffer>();
const voices: AudioBufferSourceNode[] = [];
const lastAt = new Map<string, number>();

/** Volume 0..1 for impact speed s (0 = silent). The rule is in game.config.ts sound.tableHits. */
export function impactVolume(s: number, r: { min: number; max: number; floor: number }): number {
  if (!(s >= r.min)) return 0; // also NaN
  const k = Math.min(1, Math.max(0, (s - r.min) / (r.max - r.min)));
  return Math.min(1, r.floor + (1 - r.floor) * k ** S.curve);
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
  for (const n of NAMES) {
    fetch(`${import.meta.env.BASE_URL}sounds/${n}.mp3`)
      .then((r) => r.arrayBuffer()).then((a) => ctx!.decodeAudioData(a)).then((b) => { buffers.set(n, b); })
      .catch(() => { /* no file or no decoder: that sound stays silent */ });
  }
}
/** Call once at page start: the first tap anywhere switches the sound system on (phone rule). */
export function initTableSounds() {
  for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) document.addEventListener(ev, unlock, { capture: true, passive: true });
  onMuteChange((m) => { if (m) stopAll(); });
}

function stopAll() { for (const v of voices.splice(0)) try { v.stop(); } catch { /* already ended */ } }

function play(name: Name, volume: number, key: string, ui = false) {
  if (volume <= 0 || isMuted() || !ctx || !master || ctx.state !== 'running') return;
  const buf = buffers.get(name);
  if (!buf) return;
  const now = performance.now();
  if (now - (lastAt.get(key) ?? -1e9) < S.minGapMs) return; // one contact recorded twice in a row: one sound
  lastAt.set(key, now);
  if (!ui && voices.length >= S.maxVoices) return; // enough sounds already: the newest hit is the one left out
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(master);
  src.onended = () => { const i = voices.indexOf(src); if (i >= 0) voices.splice(i, 1); };
  voices.push(src);
  src.start();
  if (import.meta.env.DEV) ((window as unknown as { __soundLog?: { name: Name; at: number }[] }).__soundLog ??= []).push({ name, at: now }); // scripts/sound-check.mjs
}

/** PLAN 9.2: a paid end (CASH OUT, RE-RACK, clearance): the crowd applause. */
export const playWin = () => play('win', U.winVolume, 'win', true);
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

/** Play every recorded event with prevT < e.t <= t (seconds of the shot). The caller moves t at the speed the shot is
 *  shown (slow motion included), so the sounds come exactly when the balls touch on screen.
 *  breakAt (the opponent's break-off only): one break sound at that moment instead of the ball-ball hits of the next
 *  breakOff.muteBallSeconds. */
export function playEventsBetween(rec: Recording, prevT: number, t: number, breakAt: number | null = null) {
  if (!ctx || isMuted() || t <= prevT) return;
  if (breakAt !== null && breakAt > prevT && breakAt <= t) play('break', S.breakOff.volume, 'break');
  for (const e of rec.events) {
    if (e.t <= prevT || e.t > t) continue;
    if (e.type === 'ball') {
      if (breakAt !== null && e.t >= breakAt && e.t < breakAt + S.breakOff.muteBallSeconds) continue;
      const v = impactVolume(e.speed, S.ball);
      play(e.speed >= S.ball.hardFrom ? 'ball-hard' : 'ball-soft', v, e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`);
    } else if (e.type === 'cushion' || e.type === 'jaw') play('cushion', impactVolume(e.speed, S.cushion), `${e.a}|c`);
    else if (e.type === 'pot') play('pocket', impactVolume(dropSpeed(rec, e.a, e.t), S.pocket), `${e.a}|p`);
  }
}
