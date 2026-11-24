// Round state machine (task 5.1, RULES A and B). Headless and pure: no rendering, no Math.random.
// Outcome first (RULES A.5): before a shot is shown, the seeded stream decides success or failure with p(step) from the
// ladder. Only then is a shot asked for, from a ShotProvider (the real one uses the break library and the solver;
// tests use a fast fake). Nothing visual (ball, colour choice, pocket, failure type) ever changes the outcome stream.

import { CONFIG } from '../config/game.config';
import { ladderForLevel, type LadderStep } from './ladder';
import { mulberry32 } from './rng';
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
  breakAndStep1(levelId: LevelId, outcome: 'success' | 'plainMiss' | 'snookered', pick: number, frame: FrameState):
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
  roundCode: string;
  ladder: LadderStep[];
  step: number; // successful pots so far (0 = before step 1)
  frame: FrameState | null;
  end: RoundEnd | null;
  history: { step: number; target: BallKind; outcome: 'success' | FailureLabel | 'reRack'; shot?: unknown; tried?: number }[];
  breakShot?: unknown; // the opponent's break-off of this round (opaque, for playback)
}

// ---------------- seeded streams (RULES A.5, config rng.streams) ----------------

/** A number in [0, 1) for (seed, stream name, index): independent streams, the same on every device. */
export function streamValue(seed: number, stream: string, k: number): number {
  let h = 2166136261 ^ seed;
  for (const ch of `${stream}#${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return mulberry32(h >>> 0)();
}

const money = (v: number) => Math.round(v * 10 ** CONFIG.money.currencyDecimals) / 10 ** CONFIG.money.currencyDecimals;

export function newRound(seed: number, balance: number = CONFIG.money.startingBalance): Round {
  const levelId = CONFIG.defaultLevel as LevelId;
  return { phase: 'betting', balance, bet: CONFIG.money.defaultBet, levelId, seed, roundCode: '', ladder: ladderForLevel(levelId),
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

/** Did step k succeed? Only the seed and k decide (RULES A.5). */
export const stepSucceeds = (r: Round, k: number): boolean => streamValue(r.seed, 'outcome', k) < r.ladder[k - 1]!.p;

function pickFailure(r: Round, k: number): FailureLabel {
  const u = streamValue(r.seed, 'failureType', k);
  let acc = 0;
  for (const [label, share] of Object.entries(CONFIG.failures.later) as [FailureLabel, number][]) {
    acc += share;
    if (u < acc) return label;
  }
  return 'plainMiss';
}

/** RULES B.1 / B.2: START takes the bet, the opponent breaks, step 1 is played automatically. */
export function start(r: Round, provider: ShotProvider, table: TableGeometry): Round {
  if (r.phase !== 'betting' && r.phase !== 'over') throw new Error('START only between rounds');
  if (r.balance < r.bet) throw new Error('balance too low for this bet');
  const reds = CONFIG.levels.find((l) => l.id === r.levelId)!.reds;
  let round: Round = { ...r, phase: 'decide', balance: money(r.balance - r.bet), step: 0, end: null, history: [],
    roundCode: `${r.levelId}-${r.seed}`, frame: newFrame(reds, table) };
  const ok = stepSucceeds(round, 1);
  const outcome = ok ? 'success' : streamValue(r.seed, 'break', 1) < CONFIG.failures.step1.plainMiss ? 'plainMiss' : 'snookered';
  const { afterBreak, step1, breakShot } = provider.breakAndStep1(r.levelId, outcome, streamValue(r.seed, 'variety', 0), round.frame!);
  round = { ...round, frame: afterBreak, breakShot };
  return playShot(round, 'red', ok ? 'success' : outcome, step1, table);
}

/** Apply a planned shot to the round: success = one step up; failure = round over (bet lost). */
function playShot(r: Round, target: BallKind, outcome: 'success' | FailureLabel, planned: PlannedShot, table: TableGeometry): Round {
  const k = r.step + 1;
  if (outcome === 'success' && planned.reRack) {
    // RULES D.4: the pot counts, no shot is played, the round ends paid at the NEW multiplier
    const m = r.ladder[k - 1]!.multiplier;
    const amount = money(r.bet * m);
    return { ...r, phase: 'over', step: k, balance: money(r.balance + amount), end: { type: 'reRack', amount, multiplier: m },
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
    return { ...r, phase: 'over', step: k, frame, history, balance: money(r.balance + amount), end: { type: 'clearance', amount, multiplier: m } };
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
  if (r.phase !== 'decide' || r.step < 1) throw new Error('SHOOT is only possible during a round, after step 1');
  const { step: k, outcome } = nextOutcome(r);
  const auto = !colourChoice && r.frame!.phase === 'colour' && provider.autoColour; // RULES B.3
  const target = nextTarget(r, auto ? provider.autoColour!(r.frame!, { roundCode: r.roundCode, step: k }) : colourChoice);
  const planned = provider.shot(r.frame!, target, outcome, { roundCode: r.roundCode, step: k });
  return playShot(r, target, outcome, planned, table);
}

/** RULES A.3: CASH OUT pays bet x current multiplier and ends the round (B.5: the next shot is never shown). */
export function cashOut(r: Round): Round {
  if (r.phase !== 'decide' || r.step < 1) throw new Error('CASH OUT is only possible after a successful step');
  const m = r.ladder[r.step - 1]!.multiplier;
  const amount = money(r.bet * m);
  return { ...r, phase: 'over', balance: money(r.balance + amount), end: { type: 'cashOut', amount, multiplier: m } };
}
