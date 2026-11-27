// Owner 2026-11-27: six applause levels, from the weakest to the wildest (files public/sounds/applause-1 ... 6.mp3).
//   1 = CASH OUT or RE-RACK            4 = the break reaches 100
//   2 = the break reaches 50           5 = a clearance
//   3 = the opponent needs snookers    6 = the maximum of the level (75 / 107 / 147)
// Levels 2-4 are milestones: they play right after the pot that reaches them, during the round, each at most once a
// round. Several levels on the same shot: only the highest plays. Levels 1, 5 and 6 belong to the round's end
// (a clearance's last pot plays no milestone: its 5 or 6 comes with the big message). A failure plays nothing, and a
// free replay (no bet) plays nothing, as before. Sound only: it reads the round, never changes it.
import { isMaximum, opponentNeedsSnookers, type FrameState } from '../core/rules';
import type { Round } from '../core/round';

export type ApplauseLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** The milestone level (2-4) the pot from `before` to `after` reaches, or null. `played` = levels already heard this round. */
export function milestoneLevel(before: FrameState, after: FrameState, played: ReadonlySet<ApplauseLevel>): ApplauseLevel | null {
  if (after.phase !== 'red' && after.phase !== 'colour' && after.phase !== 'final') return null; // lost or cleared
  const reached: ApplauseLevel[] = [];
  if (before.score < 50 && after.score >= 50) reached.push(2);
  if (!opponentNeedsSnookers(before) && opponentNeedsSnookers(after)) reached.push(3);
  if (before.score < 100 && after.score >= 100) reached.push(4);
  const top = reached.filter((l) => !played.has(l)).pop();
  return top ?? null;
}

/** The level for the round's end (1, 5 or 6), or null (a failure, a free replay, no end yet). */
export function endLevel(r: Pick<Round, 'end' | 'free' | 'frame'>): ApplauseLevel | null {
  if (!r.end || r.free) return null;
  switch (r.end.type) {
    case 'cashOut': case 'reRack': return 1;
    case 'clearance': return r.frame && isMaximum(r.frame) ? 6 : 5;
    default: return null;
  }
}
