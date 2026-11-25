// Task 5.2: the texts the game page shows for a round (pure, tested): end-of-round line in the ladder strip, the hint
// above SHOOT, the clearance message, money and round codes. RULES B.4, D.4.

import { CONFIG } from '../config/game.config';
import { isMaximum } from '../core/rules';
import type { FailureLabel, LevelId, Round, RoundEnd } from '../core/round';
import { nextTarget } from '../core/round';
import type { BallKind } from '../core/types';

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

/** The hint above SHOOT: the ball due and the next step. On a colour step the game picks the colour (RULES B.3:
 *  black, or pink / blue when black has no natural shot); until it is known the hint says COLOUR. */
export function hintText(r: Round, picked: BallKind | null = null): string {
  const next = r.ladder[r.step]; // multiplier after the next successful shot
  const ball = r.frame?.phase === 'colour' ? picked ?? 'colour' : nextTarget(r);
  return `${ball.toUpperCase()} · NEXT ${next ? formatMult(next.multiplier) : ''}`;
}

/** The big message on the empty cloth after a clearance (RULES B.4). */
export function clearanceText(r: Round): string {
  return r.frame && isMaximum(r.frame) ? `MAXIMUM ${r.frame.score}` : `TOTAL CLEARANCE ${r.frame?.score ?? ''}`;
}

/** Round codes (task 5.4) live in the core: `reds6-12345`, `12345`, `reds6-12345-BKP-C7`. */
export { parseRoundCode, roundCodeOf } from '../core/roundCode';
