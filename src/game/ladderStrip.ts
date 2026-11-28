// The ladder strip's chips (pure: no DOM), so the truth check (bench/night8/truth.test.ts) reads exactly what the game
// shows. Owner 2026-11-28 (option C of mockups/chance/): under each chip's multiplier, the chance of that step, in whole
// percent, from the same p the game draws with (rulesText.ts chipPercent).
import { CONFIG } from '../config/game.config';
import type { LadderStep } from '../core/ladder';
import { formatMult } from './roundView';
import { chipPercent } from './rulesText';

/** The steps (1-based) of the chips shown at `step`: previous + current + next, kept inside the ladder. */
export function stripSteps(ladderLength: number, step: number): number[] {
  const { previous, next } = CONFIG.ui.ladderStrip;
  const count = previous + 1 + next;
  const first = Math.max(1, Math.min(ladderLength - count + 1, step - previous));
  return Array.from({ length: count }, (_, i) => first + i);
}

/** The ladder strip (inner HTML) at `step` (0 = before step 1). `between`: between rounds the first cell names the top multiplier. */
export function stripHtml(L: readonly LadderStep[], step: number, between = false): string {
  const chips = stripSteps(L.length, step).map((k) => {
    const cls = k < step ? 'prev' : k === step ? 'current' : k === step + 1 ? 'next' : '';
    return `<div class="chip ${cls}"><span>${formatMult(L[k - 1]!.multiplier)}</span><small class="pc">${chipPercent(L[k - 1]!.p)}</small></div>`;
  });
  // night 4 (Part 5): between rounds the first cell names the level's top multiplier instead of the step
  const first0 = between ? `<div class="step upto">UP TO<br>${formatMult(L[L.length - 1]!.multiplier)}</div>` : `<div class="step">STEP ${step}<br>/ ${L.length}</div>`;
  return `${first0}${chips.join('')}`;
}
