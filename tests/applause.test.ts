// Owner 2026-11-27: which applause level plays when (src/game/applause.ts).
import { describe, expect, it } from 'vitest';
import { endLevel, milestoneLevel, type ApplauseLevel } from '../src/game/applause';
import type { FrameState } from '../src/core/rules';

const f = (o: Partial<FrameState>): FrameState => ({ phase: 'red', redsLeft: 15, nextColour: null, balls: [], lastFailure: null,
  failedIn: null, score: 0, opponentScore: 0, blackAfterEveryRed: true, ...o });
const none = new Set<ApplauseLevel>();

describe('applause milestones (levels 2-4)', () => {
  it('break reaches 50: level 2, once', () => {
    expect(milestoneLevel(f({ score: 48, redsLeft: 9 }), f({ score: 49, redsLeft: 8, phase: 'colour' }), none)).toBeNull();
    expect(milestoneLevel(f({ score: 49, redsLeft: 8, phase: 'colour' }), f({ score: 56, redsLeft: 8 }), none)).toBe(2);
    expect(milestoneLevel(f({ score: 49, redsLeft: 8, phase: 'colour' }), f({ score: 56, redsLeft: 8 }), new Set([2 as const]))).toBeNull();
    expect(milestoneLevel(f({ score: 56, redsLeft: 8 }), f({ score: 57, redsLeft: 7, phase: 'colour' }), none)).toBeNull();
  });
  it('opponent needs snookers: level 3 (lead > points remaining)', () => {
    // 6 reds: 4 reds left in the red phase = 4 x 8 + 27 = 59 remaining
    expect(milestoneLevel(f({ score: 16, redsLeft: 5, phase: 'colour' }), f({ score: 23, redsLeft: 5 }), none)).toBeNull();
    // final colours from pink: 6 + 7 = 13 remaining; 10 in, then the blue makes it 15 > 13
    expect(milestoneLevel(f({ phase: 'final', redsLeft: 0, nextColour: 'blue', score: 10 }),
      f({ phase: 'final', redsLeft: 0, nextColour: 'pink', score: 15 }), none)).toBe(3);
  });
  it('break reaches 100: level 4; same shot as needs-snookers: only the highest', () => {
    expect(milestoneLevel(f({ score: 96, redsLeft: 2 }), f({ score: 97, redsLeft: 1, phase: 'colour' }), none)).toBeNull();
    expect(milestoneLevel(f({ score: 97, redsLeft: 1, phase: 'colour' }), f({ score: 104, redsLeft: 1 }), none)).toBe(4);
    // 3 reds left, black potted: 49 -> 56, remaining 3 x 8 + 27 + 7 = 58 -> 3 x 8 + 27 = 51. 50 and needs-snookers
    // on the same pot: only 3 plays (and 2 if 3 was somehow heard already)
    const b = f({ phase: 'colour', redsLeft: 3, score: 49 }), a = f({ phase: 'red', redsLeft: 3, score: 56 });
    expect(milestoneLevel(b, a, none)).toBe(3);
    expect(milestoneLevel(b, a, new Set([3 as const]))).toBe(2);
  });
  it('the last pot (cleared) and a failure play no milestone', () => {
    expect(milestoneLevel(f({ phase: 'final', redsLeft: 0, nextColour: 'black', score: 98 }), f({ phase: 'cleared', redsLeft: 0, score: 105 }), none)).toBeNull();
    expect(milestoneLevel(f({ score: 49 }), f({ phase: 'lost', score: 49 }), none)).toBeNull();
  });
});

describe('applause at the end (levels 1, 5, 6)', () => {
  const end = (type: string, extra: Partial<FrameState> = {}, free = false) =>
    endLevel({ end: { type, amount: 1, multiplier: 1 } as never, free, frame: f(extra) });
  it('CASH OUT and RE-RACK = 1, clearance = 5, maximum = 6, failure and free replay = nothing', () => {
    expect(end('cashOut')).toBe(1);
    expect(end('reRack')).toBe(1);
    expect(end('clearance', { phase: 'cleared', blackAfterEveryRed: false })).toBe(5);
    expect(end('clearance', { phase: 'cleared', blackAfterEveryRed: true })).toBe(6);
    expect(endLevel({ end: { type: 'failure', label: 'noPot', step: 3 } as never, frame: f({}) })).toBeNull();
    expect(end('cashOut', {}, true)).toBeNull();
    expect(endLevel({ end: null, frame: null })).toBeNull();
  });
});
