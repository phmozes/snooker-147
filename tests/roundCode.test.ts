// Task 5.4: the round code reproduces the whole round (bench/roundCode.test.ts does 100 rounds per level).
import reds6Raw from '../public/breaks/reds6.json?raw';
import reds6V3Raw from '../public/breaks-v3/reds6.json?raw';
import { describe, expect, it } from 'vitest';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { cashOut, newRound, setLevel, shoot, start, type RngVersion } from '../src/core/round';
import { parseRoundCode, replayRound, roundCodeOf } from '../src/core/roundCode';
import { buildTable } from '../src/core/table/geometry';
import { playRandomRound, recording } from './roundCodeLib';

const table = buildTable();
const oldLib = JSON.parse(reds6Raw); // v1 / v2 codes
const v3Lib = JSON.parse(reds6V3Raw); // night 6: every new round (v3)
const provider = (rng: RngVersion = 3) => recording(createPhysicsProvider(table, { reds6: rng === 3 ? v3Lib : oldLib }), table, 'reds6');

describe('task 5.4: round code', () => {
  it('the code has the seed, the colour letters and the cash-out step', () => {
    let r = start(setLevel(newRound(4242), 'reds6'), provider(), table);
    expect(roundCodeOf(r)).toBe('reds6-v3-4242'); // night 6: new rounds are v3 (v2 generator + v3 library), marker in the code
    const p = provider();
    r = start(setLevel(newRound(4242), 'reds6'), p, table);
    while (r.phase === 'decide' && r.step < 4) r = shoot(r, p, table);
    if (r.phase === 'decide') {
      r = cashOut(r);
      expect(roundCodeOf(r)).toMatch(/^reds6-v3-4242-[YGNBPK]+-C4$/);
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

  it('an old code without letters (and without the v2 marker: generator v1) replays with the automatic colours', () => {
    const pa = provider(1);
    let a = start(setLevel(newRound(77, undefined, 1), 'reds6'), pa, table);
    while (a.phase === 'decide') a = shoot(a, pa, table);
    const pb = provider(1);
    const b = replayRound(parseRoundCode('reds6-77')!, pb, table);
    expect(pb.tracks).toEqual(pa.tracks);
    expect(b.end).toEqual(a.end);
  }, 600_000);

  it('night 6: a v2 code plays the old library, a v3 code the new one; a tagged library refuses the other version', () => {
    expect(parseRoundCode('reds6-v3-4242-BK-C3')).toEqual({ levelId: 'reds6', seed: 4242, rng: 3, colours: ['blue', 'black'], cashOutAfter: 3 });
    const v2 = start(setLevel(newRound(4242, undefined, 2), 'reds6'), provider(2), table);
    const v3 = start(setLevel(newRound(4242, undefined, 3), 'reds6'), provider(3), table);
    expect(v2.roundCode).toBe('reds6-v2-4242');
    expect((v2.breakShot as { cueStart: { y: number } }).cueStart.y).toBeLessThan(table.baulkY); // old: behind the line
    expect((v3.breakShot as { cueStart: { y: number } }).cueStart.y).toBe(table.baulkY); // v3: on the baulk line
    // the same generator: the same outcome draws, only the break-off differs
    expect(v3.history.map((h) => h.outcome === 'success')).toEqual(v2.history.map((h) => h.outcome === 'success'));
    for (const rng of [1, 2] as const) expect(() => start(setLevel(newRound(5, undefined, rng), 'reds6'),
      createPhysicsProvider(table, { reds6: v3Lib }), table)).toThrow(/cannot play a v/);
  }, 120_000);
});
