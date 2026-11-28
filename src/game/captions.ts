// Captions in the hint line (owner 2026-11-28, style B of mockups/captions/). Pure: no DOM, no randomness.
// BEFORE captions (shown while the game waits for SHOOT) read only the table and the score: never the round's seed or
// the outcome already drawn for the next shot, so they cannot give the result away (tests/captions.test.ts).
// AFTER captions are shown when the pot drops on screen. Left out on purpose (owner): MISSED / IN-OFF / FOUL /
// SNOOKERED (the ladder strip shows the result), MAXIMUM / TOTAL CLEARANCE (stay on the cloth, RULES B.4), ON THE COLOURS.
import { CONFIG } from '../config/game.config';
import { ballValue, opponentNeedsSnookers, pointsRemaining, type FrameState } from '../core/rules';
import type { BallKind } from '../core/types';
import type { Round } from '../core/round';

export type CaptionId = 'RE_RACK' | 'OPPONENT_NEEDS_SNOOKERS' | 'CENTURY' | 'FIFTY_BREAK' | 'FRAME_BALL' | 'MAXIMUM_IS_ON' | 'LAST_RED' | 'FLUKE';

export const CAPTION_TEXT: Record<CaptionId, string> = {
  RE_RACK: 'RE-RACK', OPPONENT_NEEDS_SNOOKERS: 'OPPONENT NEEDS SNOOKERS', CENTURY: 'CENTURY', FIFTY_BREAK: 'FIFTY BREAK',
  FRAME_BALL: 'FRAME BALL', MAXIMUM_IS_ON: 'MAXIMUM IS ON', LAST_RED: 'LAST RED', FLUKE: 'FLUKE',
};
export const CAPTION_IDS = Object.keys(CAPTION_TEXT) as CaptionId[];

/** Seconds an AFTER caption stays (BEFORE captions stay until SHOOT). Mockup table: RE-RACK 1.5 s, the rest 1.0 s. */
export const captionSeconds = (id: CaptionId): number => (id === 'RE_RACK' ? 1.5 : CONFIG.messages.durationSeconds);

/** Priority (lower = higher), from config messages.priority; RE-RACK ends the round, so it is never dropped. */
const rank = (id: CaptionId): number => (id === 'RE_RACK' ? -1 : (CONFIG.messages.priority as readonly string[]).indexOf(id));
const best = (ids: CaptionId[]): CaptionId | null => (ids.length ? ids.sort((a, b) => rank(a) - rank(b))[0]! : null);

const LOWEST_COLOUR = (Object.keys(CONFIG.ballValues) as BallKind[]).filter((k) => k !== 'red' && k !== 'cue')
  .reduce((a, k) => (ballValue(k) < ballValue(a) ? k : a));
/** The table after the next ball is potted (score and points remaining only; the balls are not needed). */
function afterPot(f: FrameState, ball: BallKind): FrameState {
  const score = f.score + ballValue(ball);
  if (f.phase === 'red') return { ...f, score, redsLeft: f.redsLeft - 1, phase: 'colour' };
  if (f.phase === 'colour') return { ...f, score, phase: f.redsLeft > 0 ? 'red' : 'final', nextColour: f.redsLeft > 0 ? null : CONFIG.finalColourOrder[0]! };
  const i = CONFIG.finalColourOrder.indexOf(f.nextColour!);
  const next = CONFIG.finalColourOrder[i + 1];
  return { ...f, score, nextColour: next ?? null, phase: next ? 'final' : 'cleared' };
}

/**
 * The BEFORE caption while the game waits for SHOOT, or null. Inputs: the table and score (`frame`), the level, and
 * the captions already shown this round (each shows once a round).
 * FRAME BALL: potting the next ball would make our score greater than the points remaining (RULES C.8); on a colour
 * step, potting the lowest colour would (so it never depends on which colour the game picks).
 * MAXIMUM IS ON: every red so far was followed by the black and at least config maximumIsOnFromRed reds are potted.
 * LAST RED: exactly one red is left and a red is next.
 */
export function beforeCaption(frame: FrameState, levelId: string, shown: ReadonlySet<CaptionId>): CaptionId | null {
  if (frame.phase !== 'red' && frame.phase !== 'colour' && frame.phase !== 'final') return null;
  const reds = CONFIG.levels.find((l) => l.id === levelId)!.reds;
  const c: CaptionId[] = [];
  // on a colour step the game's pick can differ from seed to seed, so the lowest colour is used: FRAME BALL only when
  // any colour would do it
  const ball: BallKind | null = frame.phase === 'colour' ? LOWEST_COLOUR : frame.phase === 'red' ? 'red' : frame.nextColour;
  if (ball && !opponentNeedsSnookers(frame)) {
    const a = afterPot(frame, ball);
    if (a.phase !== 'cleared' && a.score - a.opponentScore > pointsRemaining(a)) c.push('FRAME_BALL');
  }
  const from = (CONFIG.messages.maximumIsOnFromRed as Record<string, number>)[levelId] ?? Infinity;
  if (frame.phase === 'red' && frame.blackAfterEveryRed && reds - frame.redsLeft >= from) c.push('MAXIMUM_IS_ON');
  if (frame.phase === 'red' && frame.redsLeft === 1) c.push('LAST_RED');
  return best(c.filter((id) => !shown.has(id)));
}

/**
 * The AFTER caption for a successful pot from `before` to `after`, or null. `shotType` = the played shot's type
 * (a FLUKE is a pot in another pocket than the one aimed at, core/shotType.ts). A clearance shows none (its message
 * is on the cloth). Each shows once a round.
 */
export function afterCaption(before: FrameState, after: FrameState, shotType: string | null, shown: ReadonlySet<CaptionId>): CaptionId | null {
  if (after.phase !== 'red' && after.phase !== 'colour' && after.phase !== 'final') return null;
  const c: CaptionId[] = [];
  if (!opponentNeedsSnookers(before) && opponentNeedsSnookers(after)) c.push('OPPONENT_NEEDS_SNOOKERS');
  if (before.score < 100 && after.score >= 100) c.push('CENTURY');
  if (before.score < 50 && after.score >= 50) c.push('FIFTY_BREAK');
  if (shotType === 'fluke') c.push('FLUKE');
  return best(c.filter((id) => !shown.has(id)));
}

/** The BEFORE caption of a round. It passes on only the table and the level: the seed, the round
 *  code and the drawn outcomes are not read (tests/captions.test.ts proves the caption is the same for any seed). */
export const roundBeforeCaption = (r: Pick<Round, 'frame' | 'levelId'>, shown: ReadonlySet<CaptionId>): CaptionId | null =>
  (r.frame ? beforeCaption(r.frame, r.levelId, shown) : null);
