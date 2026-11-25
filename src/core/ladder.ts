// Ladder calculator: success chance p(step) and cash-out multiplier per step, for one level.
// Pure maths, reads only the config. Formula (see game.config.ts):
//   multipliers: from the original linear chance (p(1) = targetRtp / firstMultiplier, then linear down to pLast),
//     multiplier(k) = floor(targetRtp / (p1*...*pk) * 100) / 100, last step fixed to topMultiplier.
//   chances: the level's p table in the config (RTP option 3c, owner 2026-11-25), so cash-out RTP is 97.00% or a
//     little below at every step, never above. Without a p table the linear chance is used.

import { CONFIG } from '../config/game.config';

export interface LadderStep {
  step: number; // 1-based
  p: number; // chance this shot succeeds
  reach: number; // chance to have succeeded at steps 1..step (p1*...*pk)
  multiplier: number; // paid on cash out after this step (or on clearance at the last step)
  rtp: number; // reach * multiplier = return of a player who always cashes out here
}

export interface LadderInput {
  steps: number;
  pLast: number;
  topMultiplier: number;
  targetRtp: number;
  firstMultiplier: number;
  /** optional chance per step (overrides the linear chance; multipliers still come from the linear formula) */
  p?: readonly number[];
}

export function buildLadder(input: LadderInput): LadderStep[] {
  const { steps, pLast, topMultiplier, targetRtp, firstMultiplier, p: table } = input;
  if (steps < 2) throw new Error('a ladder needs at least 2 steps');
  if (table && table.length !== steps) throw new Error(`p table has ${table.length} entries, expected ${steps}`);
  const p1 = targetRtp / firstMultiplier;
  const ladder: LadderStep[] = [];
  let linearReach = 1;
  let reach = 1;
  for (let k = 1; k <= steps; k++) {
    const linearP = p1 + ((pLast - p1) * (k - 1)) / (steps - 1);
    linearReach *= linearP;
    // tiny epsilon so values like 1.05 do not floor to 1.04 because of float rounding
    const multiplier = k === steps ? topMultiplier : Math.floor((targetRtp / linearReach) * 100 + 1e-9) / 100;
    const p = table ? table[k - 1]! : linearP;
    reach *= p;
    ladder.push({ step: k, p, reach, multiplier, rtp: reach * multiplier });
  }
  return ladder;
}

function levelById(levelId: string) {
  const level = CONFIG.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`unknown level ${levelId}`);
  return level;
}

const inputFor = (levelId: string): LadderInput => {
  const level = levelById(levelId);
  return {
    steps: level.steps,
    pLast: level.pLast,
    topMultiplier: level.topMultiplier,
    targetRtp: CONFIG.ladder.targetRtp,
    firstMultiplier: CONFIG.ladder.firstMultiplier,
    p: level.p,
  };
};

/** Ladder for a level id from the config ('reds6' | 'reds10' | 'reds15'). */
export function ladderForLevel(levelId: string): LadderStep[] {
  return buildLadder(inputFor(levelId));
}

/** The multipliers of a level (they come from the linear formula only, the p table does not change them). */
export function linearMultipliers(levelId: string): number[] {
  return buildLadder({ ...inputFor(levelId), p: undefined }).map((s) => s.multiplier);
}

/** The ladder before RTP option 3c (linear chance). Only to replay weird-shot marks made before 2026-11-25. */
export function linearLadderForLevel(levelId: string): LadderStep[] {
  return buildLadder({ ...inputFor(levelId), p: undefined });
}

/** Lowest cash-out RTP over all steps of a level (exact, from the config). */
export function lowestRtp(levelId: string): number {
  return Math.min(...ladderForLevel(levelId).map((s) => s.rtp));
}

/** Player text (RULES A.6): "RTP 97% (between X% and 97%, depending on the cash-out step)". X rounded down, 2 decimals. */
export function rtpText(levelId: string): string {
  const top = CONFIG.ladder.targetRtp * 100;
  const low = Math.floor(lowestRtp(levelId) * 10000 + 1e-9) / 100;
  if (low >= top) return `RTP ${top}% at every cash-out step`;
  return `RTP ${top}% (between ${low.toFixed(2)}% and ${top}%, depending on the cash-out step)`;
}
