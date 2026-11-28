// The Rules box text (pure: no DOM), so the truth check (bench/night8/truth.test.ts) reads exactly what the game shows.
import { CONFIG } from '../config/game.config';
import { ladderForLevel, rtpText } from '../core/ladder';
import { formatMult } from './roundView';

/** RULES E: this exact sentence must be in the in-game rules text. */
export const RERACK_SENTENCE = "In the rare case of a stalemate (re-rack), the round ends and you are paid the next step's multiplier.";
export const CHANCE_NOTE = 'The chance depends only on the step, never on the ball or where the balls lie.';

/** The Rules box lines (plain text). */
export const RULE_LINES: readonly string[] = [
  'Pick a level and a bet, then START. The opponent breaks off, then you press SHOOT for your first shot.',
  'Each SHOOT plays the next ball in snooker order: a red, then a colour, and so on. A pot moves you one step up the ladder.',
  'CASH OUT after any pot to take bet × the current multiplier. A miss, a foul or an in-off ends the round and the bet is lost.',
  `Clearing the table pays the top multiplier. ${RERACK_SENTENCE}`,
  'Every outcome is decided before the shot is shown and does not depend on where the balls lie.',
];

/** The chance shown for one step: the same p the game draws against (config levels[].p), in % with 1 decimal. */
export const chanceText = (p: number): string => `${(p * 100).toFixed(1)}%`;

/** The chance under a ladder chip (owner 2026-11-28, option C): whole percent, half up, of the same p. */
export const chipPercent = (p: number): string => `${Math.floor(p * 100 + 0.5 + 1e-9)}%`;

/** One row per step of a level: step, multiplier after a pot, chance that this step's shot is potted. */
export function chanceRows(levelId: string): { step: number; mult: string; chance: string; p: number }[] {
  return ladderForLevel(levelId).map((s) => ({ step: s.step, mult: formatMult(s.multiplier), chance: chanceText(s.p), p: s.p }));
}

/** The whole Rules box (inner HTML) for the chosen level. */
export function rulesHtml(levelId: string): string {
  const lvl = CONFIG.levels.find((l) => l.id === levelId)!;
  const rtps = CONFIG.levels.map((l) => {
    const top = Math.max(...ladderForLevel(l.id).map((x) => x.multiplier));
    return `<li><b>${l.reds} reds</b> (up to ${formatMult(top)}): ${rtpText(l.id)}</li>`;
  }).join('');
  const rows = chanceRows(levelId).map((r) => `<tr><td>${r.step}</td><td>${r.mult}</td><td>${r.chance}</td></tr>`).join('');
  return `<div class="box"><h2>Rules</h2>
    <ul>${RULE_LINES.map((t) => `<li>${t}</li>`).join('')}</ul>
    <h2>Chance of each step (${lvl.reds} reds)</h2>
    <p class="note">${CHANCE_NOTE}</p>
    <table class="chances"><thead><tr><th>Step</th><th>Pays</th><th>Chance</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Return to player (RTP)</h2><ul>${rtps}</ul>
    <button class="close" id="rulesClose">Close</button></div>`;
}
