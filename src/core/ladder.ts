// Ladder calculator: success chance p(step) and cash-out multiplier per step, for one level.
// Pure maths, reads only the config. Formula (see game.config.ts):
//   p(1) = targetRtp / firstMultiplier, then linear down to pLast at the last step.
//   multiplier(k) = floor(targetRtp / (p1*...*pk) * 100) / 100, last step fixed to topMultiplier.

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
}

export function buildLadder(input: LadderInput): LadderStep[] {
  const { steps, pLast, topMultiplier, targetRtp, firstMultiplier } = input;
  if (steps < 2) throw new Error('a ladder needs at least 2 steps');
  const p1 = targetRtp / firstMultiplier;
  const ladder: LadderStep[] = [];
  let reach = 1;
  for (let k = 1; k <= steps; k++) {
    const p = p1 + ((pLast - p1) * (k - 1)) / (steps - 1);
    reach *= p;
    // tiny epsilon so values like 1.05 do not floor to 1.04 because of float rounding
    const multiplier = k === steps ? topMultiplier : Math.floor((targetRtp / reach) * 100 + 1e-9) / 100;
    ladder.push({ step: k, p, reach, multiplier, rtp: reach * multiplier });
  }
  return ladder;
}

/** Ladder for a level id from the config ('reds6' | 'reds10' | 'reds15'). */
export function ladderForLevel(levelId: string): LadderStep[] {
  const level = CONFIG.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`unknown level ${levelId}`);
  return buildLadder({
    steps: level.steps,
    pLast: level.pLast,
    topMultiplier: level.topMultiplier,
    targetRtp: CONFIG.ladder.targetRtp,
    firstMultiplier: CONFIG.ladder.firstMultiplier,
  });
}
