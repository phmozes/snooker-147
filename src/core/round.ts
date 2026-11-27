// Round state machine (task 5.1, RULES A and B). Headless and pure: no rendering, no Math.random.
// Outcome first (RULES A.5): before a shot is shown, the seeded stream decides success or failure with p(step) from the
// ladder. Only then is a shot asked for, from a ShotProvider (the real one uses the break library and the solver;
// tests use a fast fake). Nothing visual (ball, colour choice, pocket, failure type) ever changes the outcome stream.

import { CONFIG } from '../config/game.config';
import { ladderForLevel, type LadderStep } from './ladder';
import { mulberry32 } from './rng';
import { HmacSha256, utf8 } from './sha256';
import { applyShot, newFrame, type FrameState, type ShotResult } from './rules';
import type { TableGeometry } from './table/geometry';
import type { BallKind, Colour } from './types';

export type LevelId = (typeof CONFIG.levels)[number]['id'];
export type FailureLabel = 'plainMiss' | 'jawRattle' | 'inOff' | 'wrongBallFirst' | 'snookered';

/** What the provider must deliver for one shot. `result` is what the physics reports; `shot` is opaque (for playback). */
/** label: the failure actually shown when the provider had to use a RULES D.2 fallback (e.g. a plain miss). */
/** tried: shots the solver simulated for it (shown on the developer menu). */
export interface PlannedShot { result: ShotResult; shot?: unknown; reRack?: boolean; label?: FailureLabel; tried?: number }
export interface ShotProvider {
  /** Step 1: the opponent's break and our first shot, both from the library (RULES B.1, B.2, D.1). */
  /** rng: the round's generator version; it also names the break-off library (v1/v2: the old one, v3: night 6). */
  breakAndStep1(levelId: LevelId, outcome: 'success' | 'plainMiss' | 'snookered', pick: number, frame: FrameState, rng?: RngVersion):
    { afterBreak: FrameState; step1: PlannedShot; breakShot?: unknown };
  /** A later shot. For a success the provider may answer reRack (RULES D.4); a failure always exists (D.2). */
  shot(frame: FrameState, target: BallKind, outcome: 'success' | FailureLabel, ctx: { roundCode: string; step: number }): PlannedShot;
  /** RULES B.3: on a colour step before the colour-choice stage, the colour the game picks (from the layout only,
   *  never from the decided outcome). Without it the game picks black. */
  autoColour?(frame: FrameState, ctx: { roundCode: string; step: number }): Colour;
}

export type RoundPhase = 'betting' | 'decide' | 'over';
export type RoundEnd =
  | { type: 'cashOut'; amount: number; multiplier: number }
  | { type: 'failure'; label: FailureLabel; step: number }
  | { type: 'clearance'; amount: number; multiplier: number }
  | { type: 'reRack'; amount: number; multiplier: number };

export interface Round {
  phase: RoundPhase;
  balance: number;
  bet: number;
  levelId: LevelId;
  seed: number; // round seed: the outcome of step k = f(seed, 'outcome', k)
  rng: RngVersion; // which outcome generator (2 for every new round; 1 only when replaying an old code)
  roundCode: string;
  ladder: LadderStep[];
  step: number; // successful pots so far (0 = before step 1)
  frame: FrameState | null;
  end: RoundEnd | null;
  history: { step: number; target: BallKind; outcome: 'success' | FailureLabel | 'reRack'; shot?: unknown; tried?: number; forced?: boolean }[];
  breakShot?: unknown; // the opponent's break-off of this round (opaque, for playback)
  forced?: boolean; // developer test panel (task 5.3): at least one outcome of this round was forced, not decided
  free?: boolean; // a replay (night 4, owner): takes no bet and pays nothing, the balance stays as it was
  /** RULES B.2 (owner 2026-11-27): step 1 waits for SHOOT. Decided and planned at START (same seed, same library
   *  pick as before), played by the SHOOT press at step 0. Cleared once played. */
  step1?: { outcome: 'success' | 'plainMiss' | 'snookered'; planned: PlannedShot };
}

// ---------------- seeded streams (RULES A.5, config rng.streams) ----------------

/** Round version (docs/FAIRNESS.md). 1 = the old light hash, kept only so that old round codes (without a marker)
 *  replay exactly as before; 2 = HMAC-SHA256 with the old break-off library; 3 (night 6, every new round) = the same
 *  v2 HMAC generator with the new break-off library (cue ball on the baulk line, RULES B.1). */
export type RngVersion = 1 | 2 | 3;
export const RNG_VERSION_NEW: RngVersion = 3;

/** v1 (until 2026-11-26): FNV-1a of seed + `${stream}#${k}` feeding one mulberry32 draw. Replay of old codes only. */
export function streamValueV1(seed: number, stream: string, k: number): number {
  let h = 2166136261 ^ seed;
  for (const ch of `${stream}#${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return mulberry32(h >>> 0)();
}

let macSeed = -1;
const MSG: Record<string, Uint8Array[]> = {}; // the encoded messages `${stream}#${k}` (a few dozen, reused)
let mac: HmacSha256 | null = null;
/** The HMAC key for a 32-bit seed: its 4 bytes, big-endian (the server will use a 32-byte seed, same function). */
export const seedKey = (seed: number): Uint8Array => { const s = seed >>> 0; return new Uint8Array([s >>> 24, (s >>> 16) & 255, (s >>> 8) & 255, s & 255]); };
/** v2: u = first 52 bits of HMAC-SHA256(key = seed, message = `${stream}#${k}`) / 2^52. */
export function streamValueV2(seed: number, stream: string, k: number): number {
  if (seed !== macSeed || !mac) { mac = new HmacSha256(seedKey(seed)); macSeed = seed; }
  const msgs = (MSG[stream] ??= []);
  const [w0, w1] = mac.first2((msgs[k] ??= utf8(`${stream}#${k}`)));
  return ((w0 >>> 0) * 2 ** 20 + ((w1 >>> 0) >>> 12)) / 2 ** 52;
}

/** A number in [0, 1) for (seed, stream name, index): independent streams, the same on every device. */
export function streamValue(seed: number, stream: string, k: number, version: RngVersion = RNG_VERSION_NEW): number {
  return version === 1 ? streamValueV1(seed, stream, k) : streamValueV2(seed, stream, k);
}
/** The round code of a round that has just started (no colour letters yet): v2 / v3 codes carry the marker `v2` / `v3`. */
export const baseCode = (levelId: string, seed: number, rng: RngVersion): string => `${levelId}-${rng === 1 ? '' : `v${rng}-`}${seed}`;

/** The balance after a win is paid (a free replay pays nothing; its end still shows what the real round paid). */
const paid = (r: Round, amount: number) => (r.free ? r.balance : money(r.balance + amount));
const money = (v: number) => Math.round(v * 10 ** CONFIG.money.currencyDecimals) / 10 ** CONFIG.money.currencyDecimals;

export function newRound(seed: number, balance: number = CONFIG.money.startingBalance, rng: RngVersion = RNG_VERSION_NEW): Round {
  const levelId = CONFIG.defaultLevel as LevelId;
  return { phase: 'betting', balance, bet: CONFIG.money.defaultBet, levelId, seed, rng, roundCode: '', ladder: ladderForLevel(levelId),
    step: 0, frame: null, end: null, history: [] };
}

/** RULES A.1: level and bet can only change before START. The bet is kept between minBet and maxBet. */
export function setLevel(r: Round, levelId: LevelId): Round {
  if (r.phase === 'decide') throw new Error('the level can only change before START');
  return { ...r, levelId, ladder: ladderForLevel(levelId) };
}
export function setBet(r: Round, bet: number): Round {
  if (r.phase === 'decide') throw new Error('the bet is locked after START');
  const b = Math.round(Math.min(CONFIG.money.maxBet, Math.max(CONFIG.money.minBet, bet)) / CONFIG.money.betStep) * CONFIG.money.betStep;
  return { ...r, bet: b };
}

/** The draw that decides step k: u from the seed, p from the ladder; success when u < p (RULES A.5). The developer
 *  panel shows it after each shot (owner 2026-11-25: the position plays no part). */
export const outcomeDraw = (r: Round, k: number): { u: number; p: number } => ({ u: streamValue(r.seed, 'outcome', k, r.rng), p: r.ladder[k - 1]!.p });
/** Did step k succeed? Only the seed and k decide (RULES A.5). */
export const stepSucceeds = (r: Round, k: number): boolean => { const d = outcomeDraw(r, k); return d.u < d.p; };

function pickFailure(r: Round, k: number): FailureLabel {
  const u = streamValue(r.seed, 'failureType', k, r.rng);
  let acc = 0;
  for (const [label, share] of Object.entries(CONFIG.failures.later) as [FailureLabel, number][]) {
    acc += share;
    if (u < acc) return label;
  }
  return 'plainMiss';
}

/** RULES B.1 / B.2 (owner 2026-11-27): START takes the bet and the opponent breaks; the round then waits at step 0
 *  for SHOOT (no CASH OUT: nothing won yet). Step 1 is decided here exactly as before (seed + step 1, the same
 *  library pick), so every old round code gives the same round. */
export function startRound(r: Round, provider: ShotProvider, table: TableGeometry): Round {
  if (r.phase !== 'betting' && r.phase !== 'over') throw new Error('START only between rounds');
  if (!r.free && r.balance < r.bet) throw new Error('balance too low for this bet');
  const reds = CONFIG.levels.find((l) => l.id === r.levelId)!.reds;
  const round: Round = { ...r, phase: 'decide', balance: r.free ? r.balance : money(r.balance - r.bet), step: 0, end: null, history: [], forced: false,
    roundCode: baseCode(r.levelId, r.seed, r.rng), frame: newFrame(reds, table) };
  const ok = stepSucceeds(round, 1);
  const outcome = ok ? 'success' : streamValue(r.seed, 'break', 1, r.rng) < CONFIG.failures.step1.plainMiss ? 'plainMiss' : 'snookered';
  const { afterBreak, step1, breakShot } = provider.breakAndStep1(r.levelId, outcome, streamValue(r.seed, 'variety', 0, r.rng), round.frame!, r.rng);
  return { ...round, frame: afterBreak, breakShot, step1: { outcome, planned: step1 } };
}

/** SHOOT at step 0: plays the step 1 shot planned at START (from the break-off library, no solve). */
function shootStep1(r: Round, table: TableGeometry): Round {
  const s = r.step1!;
  const rest: Round = { ...r };
  delete rest.step1;
  return playShot(rest, 'red', s.outcome, s.planned, table);
}

/** START and the first SHOOT in one call (the rounds of every test and bench; the same round as the game plays). */
export function start(r: Round, provider: ShotProvider, table: TableGeometry): Round {
  return shootStep1(startRound(r, provider, table), table);
}

/** The round as it will be after the step 1 SHOOT (the game page plans the next solve from it; never shown). */
export const peekStep1 = (r: Round, table: TableGeometry): Round => shootStep1(r, table);

/** True while the round waits for the SHOOT of step 1 (RULES B.2): no CASH OUT, no solve. */
export const awaitingStep1 = (r: Round): boolean => r.phase === 'decide' && r.step === 0 && !!r.step1;

/** Apply a planned shot to the round: success = one step up; failure = round over (bet lost). */
function playShot(r: Round, target: BallKind, outcome: 'success' | FailureLabel, planned: PlannedShot, table: TableGeometry): Round {
  const k = r.step + 1;
  if (outcome === 'success' && planned.reRack) {
    // RULES D.4: the pot counts, no shot is played, the round ends paid at the NEW multiplier
    const m = r.ladder[k - 1]!.multiplier;
    const amount = money(r.bet * m);
    return { ...r, phase: 'over', step: k, balance: paid(r, amount), end: { type: 'reRack', amount, multiplier: m },
      history: [...r.history, { step: k, target, outcome: 'reRack' }] };
  }
  const frame = applyShot(r.frame!, target, planned.result, table);
  const history = [...r.history, { step: k, target, outcome, shot: planned.shot, tried: planned.tried }];
  if (outcome !== 'success') {
    if (frame.phase !== 'lost') throw new Error('a failure outcome must be a failed shot');
    return { ...r, phase: 'over', frame, history, end: { type: 'failure', label: planned.label ?? outcome, step: k } };
  }
  if (frame.phase === 'lost') throw new Error('a success outcome must be a successful shot');
  if (k === r.ladder.length || frame.phase === 'cleared') {
    const m = r.ladder[r.ladder.length - 1]!.multiplier; // RULES A.4: clearing the table pays the top multiplier
    const amount = money(r.bet * m);
    return { ...r, phase: 'over', step: k, frame, history, balance: paid(r, amount), end: { type: 'clearance', amount, multiplier: m } };
  }
  return { ...r, step: k, frame, history };
}

/** The target of the next shot: red, else the chosen colour (until the colour-choice stage the game picks it, B.3:
 *  black, or pink / blue when black has no natural shot; black when no colour is given), else the next final colour. */
export function nextTarget(r: Round, colourChoice?: Colour): BallKind {
  const f = r.frame!;
  if (f.phase === 'red') return 'red';
  if (f.phase === 'colour') return colourChoice ?? (CONFIG.colourChoice.autoPickBeforeColourStage as Colour);
  return f.nextColour!;
}

/** The next shot's step, its decided outcome, and the failure type it would have (RULES A.5: only the seed and the
 *  step decide). The game page uses it to solve the next shot for both outcomes while the player decides (RULES D). */
export function nextOutcome(r: Round): { step: number; outcome: 'success' | FailureLabel; failure: FailureLabel } {
  const k = r.step + 1;
  const failure = pickFailure(r, k);
  return { step: k, outcome: stepSucceeds(r, k) ? 'success' : failure, failure };
}

/** RULES A.3: SHOOT. The outcome is decided first, then the provider finds a matching shot. */
export function shoot(r: Round, provider: ShotProvider, table: TableGeometry, colourChoice?: Colour): Round {
  if (awaitingStep1(r)) return shootStep1(r, table); // RULES B.2: the first SHOOT plays step 1
  if (r.phase !== 'decide' || r.step < 1) throw new Error('SHOOT is only possible during a round');
  const { step: k, outcome } = nextOutcome(r);
  const auto = !colourChoice && r.frame!.phase === 'colour' && provider.autoColour; // RULES B.3
  const target = nextTarget(r, auto ? provider.autoColour!(r.frame!, { roundCode: r.roundCode, step: k }) : colourChoice);
  const planned = provider.shot(r.frame!, target, outcome, { roundCode: r.roundCode, step: k });
  return playShot(r, target, outcome, planned, table);
}

/** Task P.2: the round as it would be if the next shot succeeds with this solved shot (the decided outcome is not
 *  looked at). The game page uses it to start solving the step after next while the player decides. */
export function successEnd(r: Round, target: BallKind, planned: PlannedShot, table: TableGeometry): Round {
  if (r.phase !== 'decide') throw new Error('no next shot');
  return playShot(r, target, 'success', planned, table);
}

/** RULES A.3: CASH OUT pays bet x current multiplier and ends the round (B.5: the next shot is never shown). */
export function cashOut(r: Round): Round {
  if (r.phase !== 'decide' || r.step < 1) throw new Error('CASH OUT is only possible after a successful step');
  const m = r.ladder[r.step - 1]!.multiplier;
  const amount = money(r.bet * m);
  return { ...r, phase: 'over', balance: paid(r, amount), end: { type: 'cashOut', amount, multiplier: m } };
}

// ---------------- developer test panel (task 5.3) ----------------
/** What the developer panel can force for the next shot. */
export type ForcedOutcome = 'success' | Exclude<FailureLabel, 'snookered'> | 'reRack';
export const FORCED_OUTCOMES: ForcedOutcome[] = ['success', 'plainMiss', 'jawRattle', 'inOff', 'wrongBallFirst', 'reRack'];

/**
 * DEVELOPER ONLY (task 5.3): SHOOT with a forced outcome instead of the decided one. The round and the shot are
 * marked `forced`, so the screen can say so. The game page offers this only in the developer menu of a dev build
 * (import.meta.env.DEV); the real game only ever calls shoot(). 'reRack' plays RULES D.4 as if no shot was found.
 */
export function shootForced(r: Round, provider: ShotProvider, table: TableGeometry, forced: ForcedOutcome, colourChoice?: Colour): Round {
  if (r.phase !== 'decide' || r.step < 1) throw new Error('SHOOT is only possible during a round, after step 1');
  const k = r.step + 1;
  const outcome: 'success' | FailureLabel = forced === 'reRack' ? 'success' : forced;
  const auto = !colourChoice && r.frame!.phase === 'colour' && provider.autoColour;
  const target = nextTarget(r, auto ? provider.autoColour!(r.frame!, { roundCode: r.roundCode, step: k }) : colourChoice);
  const planned: PlannedShot = forced === 'reRack' ? { result: { firstHit: null, potted: [], after: r.frame!.balls }, reRack: true }
    : provider.shot(r.frame!, target, outcome, { roundCode: r.roundCode, step: k });
  const next = playShot({ ...r, forced: true }, target, outcome, planned, table);
  const h = next.history.map((e, i) => (i === next.history.length - 1 ? { ...e, forced: true } : e));
  return { ...next, history: h };
}
