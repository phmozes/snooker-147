// Captions in the hint line (owner 2026-11-28, src/game/captions.ts).
import { describe, expect, it } from 'vitest';
import { afterCaption, beforeCaption, captionSeconds, roundBeforeCaption, type CaptionId } from '../src/game/captions';
import { newFrame, type FrameState } from '../src/core/rules';
import { buildTable } from '../src/core/table/geometry';
import { newRound, setLevel, stepSucceeds, type Round } from '../src/core/round';
import { CONFIG } from '../src/config/game.config';

const table = buildTable();
const frame = (reds: number, f: Partial<FrameState>): FrameState => ({ ...newFrame(reds, table), ...f });
const none = new Set<CaptionId>();

describe('BEFORE captions depend only on the table and the score', () => {
  it('the same table state with different seeds (and different drawn outcomes) gives the same caption', () => {
    const states: { level: 'reds6' | 'reds10' | 'reds15'; f: FrameState; next: 'red' | 'yellow' | 'black' }[] = [
      { level: 'reds6', f: frame(6, { redsLeft: 1, score: 40 }), next: 'red' }, // LAST RED
      { level: 'reds6', f: frame(6, { redsLeft: 3, score: 24 }), next: 'red' }, // MAXIMUM IS ON
      { level: 'reds6', f: frame(6, { redsLeft: 0, phase: 'final', nextColour: 'yellow', score: 26, blackAfterEveryRed: false }), next: 'yellow' }, // FRAME BALL
      { level: 'reds15', f: frame(15, { redsLeft: 9, score: 20, blackAfterEveryRed: false }), next: 'red' }, // none
    ];
    for (const s of states) {
      const seen = new Set<string>();
      const outcomes = new Set<boolean>();
      for (let seed = 1; seed <= 300; seed++) for (const rng of [3, 4] as const) {
        const base = setLevel(newRound(seed, 1000, rng), s.level);
        const r: Round = { ...base, phase: 'decide', step: 5, frame: s.f, roundCode: `${s.level}-${seed}` };
        outcomes.add(stepSucceeds(r, 6));
        seen.add(String(roundBeforeCaption(r, none)));
      }
      expect(outcomes.size).toBe(2); // the drawn next outcome really differs between these seeds
      expect(seen.size).toBe(1); // ... and the caption does not
    }
  });
  it('LAST RED, MAXIMUM IS ON, FRAME BALL and their priority', () => {
    expect(beforeCaption(frame(6, { redsLeft: 1, score: 40, blackAfterEveryRed: false }), 'reds6', none)).toBe('LAST_RED');
    expect(beforeCaption(frame(6, { redsLeft: 3, score: 24 }), 'reds6', none)).toBe('MAXIMUM_IS_ON');
    expect(beforeCaption(frame(6, { redsLeft: 4, score: 16 }), 'reds6', none)).toBeNull(); // 2 reds < 3 (config)
    expect(beforeCaption(frame(10, { redsLeft: 7, score: 24 }), 'reds10', none)).toBeNull(); // 3 reds < 4
    expect(beforeCaption(frame(6, { redsLeft: 0, phase: 'final', nextColour: 'yellow', score: 26, blackAfterEveryRed: false }), 'reds6', none)).toBe('FRAME_BALL');
    // MAXIMUM IS ON (7) beats LAST RED (8): 5 reds with blacks, 1 left
    expect(beforeCaption(frame(6, { redsLeft: 1, score: 40 }), 'reds6', none)).toBe('MAXIMUM_IS_ON');
    // once a round: when shown, the next one in priority is used
    expect(beforeCaption(frame(6, { redsLeft: 1, score: 40 }), 'reds6', new Set<CaptionId>(['MAXIMUM_IS_ON']))).toBe('LAST_RED');
    // a colour step: decided with the lowest colour (yellow 2), never the colour the game picks. 6 reds, 1 red left,
    // red just potted: remaining 8 + 27 + 7 = 42 now; after a yellow 8 + 27 = 35: score 33 -> 35 is not > 35, 34 -> 36 is
    expect(beforeCaption(frame(6, { phase: 'colour', redsLeft: 1, score: 33, blackAfterEveryRed: false }), 'reds6', none)).toBeNull();
    expect(beforeCaption(frame(6, { phase: 'colour', redsLeft: 1, score: 34, blackAfterEveryRed: false }), 'reds6', none)).toBe('FRAME_BALL');
    // the opponent already needs snookers: no FRAME BALL
    expect(beforeCaption(frame(6, { redsLeft: 0, phase: 'final', nextColour: 'yellow', score: 30, blackAfterEveryRed: false }), 'reds6', none)).toBeNull();
  });
});

describe('AFTER captions', () => {
  const b = (score: number, f: Partial<FrameState> = {}) => frame(15, { redsLeft: 5, score, blackAfterEveryRed: false, ...f });
  it('CENTURY, FIFTY BREAK, OPPONENT NEEDS SNOOKERS, FLUKE, by priority', () => {
    expect(afterCaption(b(45), b(52), 'straight', none)).toBe('FIFTY_BREAK');
    expect(afterCaption(b(95), b(102), 'straight', none)).toBe('CENTURY');
    expect(afterCaption(b(30), b(31), 'fluke', none)).toBe('FLUKE');
    expect(afterCaption(b(30), b(31), 'straight', none)).toBeNull();
    // 6 reds, final colours: 22 -> 24 after yellow; remaining green..black 25 -> no; 26 -> 28 > 25 -> yes
    const f6 = (score: number, nextColour: 'yellow' | 'green') => frame(6, { redsLeft: 0, phase: 'final', nextColour, score, blackAfterEveryRed: false });
    expect(afterCaption(f6(26, 'yellow'), f6(28, 'green'), 'straight', none)).toBe('OPPONENT_NEEDS_SNOOKERS');
    // OPPONENT NEEDS SNOOKERS (3) beats FIFTY BREAK (5)
    // 10 reds, a black after a red with 3 reds left: 45 -> 52 (remaining 58 -> 51): both at once
    const c10 = frame(10, { phase: 'colour', redsLeft: 3, score: 45, blackAfterEveryRed: false });
    const r10 = frame(10, { phase: 'red', redsLeft: 3, score: 52, blackAfterEveryRed: false });
    expect(afterCaption(c10, r10, 'straight', none)).toBe('OPPONENT_NEEDS_SNOOKERS');
    expect(afterCaption(c10, r10, 'straight', new Set<CaptionId>(['OPPONENT_NEEDS_SNOOKERS']))).toBe('FIFTY_BREAK');
  });
  it('a clearance shows no caption (its message stays on the cloth); no failure captions exist', () => {
    expect(afterCaption(b(95), frame(15, { phase: 'cleared', redsLeft: 0, score: 102 }), 'straight', none)).toBeNull();
    expect(afterCaption(b(95), frame(15, { phase: 'lost', redsLeft: 5, score: 95, failedIn: 'red' }), 'straight', none)).toBeNull();
  });
  it('timing from the mockup table: RE-RACK 1.5 s, the rest config messages.durationSeconds', () => {
    expect(captionSeconds('RE_RACK')).toBe(1.5);
    expect(captionSeconds('CENTURY')).toBe(CONFIG.messages.durationSeconds);
  });
});
