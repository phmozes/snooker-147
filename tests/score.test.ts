// Task 3.2: score, points remaining, "opponent needs snookers" and the maximum. One plain-English case per test;
// "[C.n]" = the section of docs/RULES.md. docs/RULES-CHECK.md is built from these names (npm run rules-check).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { applyShot, isMaximum, newFrame, opponentNeedsSnookers, pointsRemaining, type FrameState } from '../src/core/rules';
import { buildTable } from '../src/core/table/geometry';
import type { BallKind, Colour } from '../src/core/types';

const table = buildTable();

/** Pot `id` cleanly with `target` as the target (the other balls stay where they are). */
const pot = (s: FrameState, target: BallKind, id: string) =>
  applyShot(s, target, { firstHit: id, potted: [id], after: s.balls.filter((b) => b.id !== id) }, table);
/** A round with `n` reds potted, each followed by `colour` (black unless told otherwise). */
function play(reds: number, n: number, colour: Colour = 'black'): FrameState {
  let s = newFrame(reds, table);
  for (let i = 1; i <= n; i++) { s = pot(s, 'red', `red${i}`); s = pot(s, colour, colour); }
  return s;
}
/** Pot the final colours in order. */
function clearColours(s: FrameState): FrameState {
  while (s.phase === 'final') { const c = s.nextColour!; s = pot(s, c, c); }
  return s;
}

describe('Score and ball values', () => {
  it('[C.6] a new round starts at 0 points for both players', () => {
    const s = newFrame(6, table);
    expect([s.score, s.opponentScore]).toEqual([0, 0]);
  });
  it('[C.6] each pot scores its value: red 1, yellow 2, green 3, brown 4, blue 5, pink 6, black 7', () => {
    let s = newFrame(6, table);
    const gained: number[] = [];
    const colours = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'] as const;
    colours.forEach((c, i) => {
      let before = s.score;
      s = pot(s, 'red', `red${i + 1}`); gained.push(s.score - before);
      before = s.score;
      s = pot(s, c, c); gained.push(s.score - before);
    });
    expect(gained).toEqual([1, 2, 1, 3, 1, 4, 1, 5, 1, 6, 1, 7]);
  });
  it('[C.6] the final colours add 2 + 3 + 4 + 5 + 6 + 7 = 27', () => {
    const s = play(6, 6);
    expect(clearColours(s).score - s.score).toBe(27);
  });
  it('[C.6] the opponent score stays 0 for the whole round', () => {
    expect(clearColours(play(15, 15)).opponentScore).toBe(0);
  });
  it('[C.6] a failed shot scores nothing', () => {
    const s = play(6, 2);
    const lost = applyShot(s, 'red', { firstHit: 'red3', potted: [], after: s.balls }, table);
    expect(lost.phase).toBe('lost');
    expect(lost.score).toBe(s.score);
  });
});

describe('Points remaining', () => {
  it('[C.7] before any shot, points remaining = 8 x reds + 27: 75 (6 reds), 107 (10 reds), 147 (15 reds)', () => {
    expect([6, 10, 15].map((n) => pointsRemaining(newFrame(n, table)))).toEqual([75, 107, 147]);
  });
  it('[C.7] after a red, before its colour, points remaining = 8 x reds left + 27 + 7', () => {
    expect(pointsRemaining(pot(newFrame(6, table), 'red', 'red1'))).toBe(8 * 5 + 27 + 7);
  });
  it('[C.7] in the final colours, points remaining = the colours still on the table (27, 25, 22, 18, 13, 7, then 0)', () => {
    let s = play(6, 6);
    const left: number[] = [];
    while (s.phase === 'final') { left.push(pointsRemaining(s)); const c = s.nextColour!; s = pot(s, c, c); }
    expect([...left, pointsRemaining(s)]).toEqual([27, 25, 22, 18, 13, 7, 0]);
  });
  it('[C.7] with black after every red, score + points remaining stays at the starting total after every shot', () => {
    for (const reds of [6, 10, 15]) {
      let s = newFrame(reds, table);
      const total = pointsRemaining(s);
      for (let i = 1; i <= reds; i++) {
        s = pot(s, 'red', `red${i}`); expect(s.score + pointsRemaining(s)).toBe(total);
        s = pot(s, 'black', 'black'); expect(s.score + pointsRemaining(s)).toBe(total);
      }
      expect(clearColours(s).score).toBe(total);
    }
  });
  it('[C.7] after a failure, points remaining are those of the shot that failed', () => {
    const s = pot(newFrame(6, table), 'red', 'red1'); // colour due: 8 x 5 + 27 + 7 = 74
    const lost = applyShot(s, 'black', { firstHit: 'blue', potted: [], after: s.balls }, table);
    expect(pointsRemaining(lost)).toBe(74);
  });
});

describe('Opponent needs snookers', () => {
  // known facts from the owner: reds, reds and blacks potted, score, points remaining, snookers needed
  const facts: [number, number, number, number, boolean][] = [
    [6, 4, 32, 43, false], [6, 5, 40, 35, true],
    [10, 6, 48, 59, false], [10, 7, 56, 51, true],
    [15, 9, 72, 75, false], [15, 10, 80, 67, true],
  ];
  for (const [reds, n, score, left, needed] of facts) {
    it(`[C.8] ${reds} reds, after ${n} reds and ${n} blacks: score ${score}, ${left} remaining, snookers ${needed ? 'ARE' : 'are NOT'} needed`, () => {
      const s = play(reds, n);
      expect(s.score).toBe(score);
      expect(pointsRemaining(s)).toBe(left);
      expect(opponentNeedsSnookers(s)).toBe(needed);
    });
  }
  it('[C.8] score equal to points remaining means snookers are NOT needed (it must be strictly greater)', () => {
    const equal: FrameState = { ...newFrame(6, table), redsLeft: 2, score: 43 }; // 8 x 2 + 27 = 43 remaining
    expect(pointsRemaining(equal)).toBe(43);
    expect(opponentNeedsSnookers(equal)).toBe(false);
    expect(opponentNeedsSnookers({ ...equal, score: 44 })).toBe(true);
  });
});

describe('Maximum', () => {
  it('[C.9] black after every red, then all the colours, is a maximum: 75 (6 reds), 107 (10 reds), 147 (15 reds)', () => {
    for (const [reds, max] of [[6, 75], [10, 107], [15, 147]] as const) {
      const s = clearColours(play(reds, reds));
      expect([s.phase, s.score, isMaximum(s)]).toEqual(['cleared', max, true]);
    }
  });
  it('[C.9] the maximum of every level matches the config (maximumBreak)', () => {
    for (const l of CONFIG.levels) expect(clearColours(play(l.reds, l.reds)).score).toBe(l.maximumBreak);
  });
  it('[C.9] one pink instead of a black: the table can still be cleared (74 with 6 reds) but it is not a maximum', () => {
    let s = newFrame(6, table);
    for (let i = 1; i <= 6; i++) { const c = i === 3 ? 'pink' : 'black'; s = pot(s, 'red', `red${i}`); s = pot(s, c, c); }
    s = clearColours(s);
    expect([s.phase, s.score, isMaximum(s)]).toEqual(['cleared', 74, false]);
  });
  it('[C.9] a round that is not finished is not a maximum, even with black after every red so far', () => {
    expect(isMaximum(play(6, 6))).toBe(false);
  });
});
