// Task 5.2: the texts the game page shows for a round (pure, tested): end-of-round line in the ladder strip, the hint
// above SHOOT, the clearance message, money and round codes. RULES B.4, D.4.

import { CONFIG } from '../config/game.config';
import { isMaximum } from '../core/rules';
import type { FailureLabel, LevelId, Round, RoundEnd } from '../core/round';
import { nextTarget } from '../core/round';

export const formatMoney = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: CONFIG.money.currencyDecimals,
  maximumFractionDigits: CONFIG.money.currencyDecimals });
export const formatMult = (m: number) => `x${m.toFixed(2)}`;

/** RULES B.4 / C.5 labels: a jaw rattle is a miss too. */
export const FAILURE_TEXT: Record<FailureLabel, string> = {
  plainMiss: 'MISSED', jawRattle: 'MISSED', inOff: 'IN-OFF', wrongBallFirst: 'FOUL', snookered: 'SNOOKERED',
};

/** The line shown in the ladder strip when the round is over (it stays until the next START). */
export function endLine(end: RoundEnd, bet: number): string {
  switch (end.type) {
    case 'cashOut': return `WON ${formatMoney(end.amount)} · ${formatMult(end.multiplier)}`;
    case 'clearance': return `CLEARED · WON ${formatMoney(end.amount)} · ${formatMult(end.multiplier)}`;
    case 'reRack': return CONFIG.reRack.stripText.replace('{amount}', formatMoney(end.amount)).replace('{multiplier}', end.multiplier.toFixed(2));
    case 'failure': return `${FAILURE_TEXT[end.label]} · LOST ${formatMoney(bet)}`;
  }
}

/** The hint above SHOOT: the ball due (black is picked by the game until the colour-choice stage) and the next step. */
export function hintText(r: Round): string {
  const next = r.ladder[r.step]; // multiplier after the next successful shot
  return `${nextTarget(r).toUpperCase()} · NEXT ${next ? formatMult(next.multiplier) : ''}`;
}

/** The big message on the empty cloth after a clearance (RULES B.4). */
export function clearanceText(r: Round): string {
  return r.frame && isMaximum(r.frame) ? `MAXIMUM ${r.frame.score}` : `TOTAL CLEARANCE ${r.frame?.score ?? ''}`;
}

/** "reds6-12345" or "12345" (then the level stays as it is). null if it is not a round code. */
export function parseRoundCode(text: string): { levelId: LevelId | null; seed: number } | null {
  const m = /^\s*(?:(reds\d+)\s*-\s*)?(\d{1,10})\s*$/.exec(text);
  if (!m) return null;
  const seed = Number(m[2]);
  if (seed > 0xffffffff) return null;
  const levelId = m[1] ? CONFIG.levels.find((l) => l.id === m[1])?.id ?? null : null;
  if (m[1] && !levelId) return null;
  return { levelId, seed };
}
