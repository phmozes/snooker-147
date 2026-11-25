// Task 5.4: the round code reproduces the whole round (bench/roundCode.test.ts does 100 rounds per level).
import reds6Raw from '../public/breaks/reds6.json?raw';
import { describe, expect, it } from 'vitest';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { cashOut, newRound, setLevel, shoot, start } from '../src/core/round';
import { parseRoundCode, replayRound, roundCodeOf } from '../src/core/roundCode';
import { buildTable } from '../src/core/table/geometry';
import { playRandomRound, recording } from './roundCodeLib';

const table = buildTable();
const lib = JSON.parse(reds6Raw);
const provider = () => recording(createPhysicsProvider(table, { reds6: lib }), table, 'reds6');

describe('task 5.4: round code', () => {
  it('the code has the seed, the colour letters and the cash-out step', () => {
    let r = start(setLevel(newRound(4242), 'reds6'), provider(), table);
    expect(roundCodeOf(r)).toBe('reds6-4242');
    const p = provider();
    r = start(setLevel(newRound(4242), 'reds6'), p, table);
    while (r.phase === 'decide' && r.step < 4) r = shoot(r, p, table);
    if (r.phase === 'decide') {
      r = cashOut(r);
      expect(roundCodeOf(r)).toMatch(/^reds6-4242-[YGNBPK]+-C4$/);
    }
  });

  it('replaying a code gives the same trajectories, end and balance (random choices, a few rounds)', () => {
    for (let i = 0; i < 4; i++) {
      const pa = provider();
      const a = playRandomRound('reds6', 9_100_000 + i * 31, pa, table, i);
      const code = roundCodeOf(a.round);
      const pb = provider();
      const b = replayRound(parseRoundCode(code)!, pb, table);
      expect(pb.tracks).toEqual(pa.tracks);
      expect(b.end).toEqual(a.round.end);
      expect(b.balance).toBe(a.round.balance);
      expect(roundCodeOf(b)).toBe(code);
    }
  }, 600_000);

  it('an old code without letters replays with the automatic colours', () => {
    const pa = provider();
    let a = start(setLevel(newRound(77), 'reds6'), pa, table);
    while (a.phase === 'decide') a = shoot(a, pa, table);
    const pb = provider();
    const b = replayRound(parseRoundCode('reds6-77')!, pb, table);
    expect(pb.tracks).toEqual(pa.tracks);
    expect(b.end).toEqual(a.end);
  }, 600_000);
});
