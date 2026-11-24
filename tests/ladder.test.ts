import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { buildLadder, ladderForLevel } from '../src/core/ladder';

// Fixtures: the expected multipliers, worked out once with a separate script from the formula in the config.
// If someone changes the config numbers, these tests fail on purpose: the owner must approve new ladders.
const FIXTURES: Record<string, number[]> = {
  reds6: [1.05, 1.14, 1.27, 1.42, 1.61, 1.85, 2.14, 2.51, 2.99, 3.59, 4.38, 5.4, 6.75, 8.54, 10.95, 14.22, 18.73, 25],
  reds10: [
    1.05, 1.14, 1.25, 1.37, 1.52, 1.69, 1.89, 2.13, 2.42, 2.75, 3.15, 3.64, 4.22, 4.92, 5.77, 6.81, 8.08, 9.65, 11.6,
    14.03, 17.07, 20.9, 25.75, 31.92, 39.82, 50,
  ],
  reds15: [
    1.05, 1.13, 1.24, 1.35, 1.48, 1.62, 1.78, 1.97, 2.18, 2.42, 2.69, 3.01, 3.37, 3.78, 4.26, 4.8, 5.44, 6.18, 7.03,
    8.03, 9.2, 10.56, 12.17, 14.06, 16.29, 18.93, 22.06, 25.78, 30.22, 35.54, 41.91, 49.57, 58.81, 69.98, 83.53, 100,
  ],
};

const { rtpTestMin, rtpTestMax, firstMultiplier } = CONFIG.ladder;
const EPS = 1e-9; // float tolerance only

describe.each(CONFIG.levels.map((l) => [l.id, l] as const))('ladder %s', (id, level) => {
  const ladder = ladderForLevel(id);

  it('has one entry per step', () => {
    expect(ladder).toHaveLength(level.steps);
    expect(ladder.map((s) => s.step)).toEqual(Array.from({ length: level.steps }, (_, i) => i + 1));
  });

  it('matches the fixture multipliers exactly', () => {
    expect(ladder.map((s) => s.multiplier)).toEqual(FIXTURES[id]);
  });

  it('starts at the first multiplier and ends at the top multiplier', () => {
    expect(ladder[0]!.multiplier).toBe(firstMultiplier);
    expect(ladder[ladder.length - 1]!.multiplier).toBe(level.topMultiplier);
  });

  it('p is strictly decreasing and always a real chance (0 < p < 1)', () => {
    for (let i = 0; i < ladder.length; i++) {
      expect(ladder[i]!.p).toBeGreaterThan(0);
      expect(ladder[i]!.p).toBeLessThan(1);
      if (i > 0) expect(ladder[i]!.p).toBeLessThan(ladder[i - 1]!.p);
    }
    expect(ladder[ladder.length - 1]!.p).toBeCloseTo(level.pLast, 12);
  });

  it('multipliers strictly increase', () => {
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!.multiplier).toBeGreaterThan(ladder[i - 1]!.multiplier);
  });

  it(`RTP is between ${rtpTestMin} and ${rtpTestMax} at every step`, () => {
    for (const s of ladder) {
      expect(s.rtp, `step ${s.step}`).toBeGreaterThanOrEqual(rtpTestMin - EPS);
      expect(s.rtp, `step ${s.step}`).toBeLessThanOrEqual(rtpTestMax + EPS);
    }
  });
});

describe('buildLadder', () => {
  it('refuses a ladder with fewer than 2 steps', () => {
    expect(() => buildLadder({ steps: 1, pLast: 0.8, topMultiplier: 2, targetRtp: 0.97, firstMultiplier: 1.05 })).toThrow();
  });

  it('refuses an unknown level', () => {
    expect(() => ladderForLevel('reds99')).toThrow();
  });
});
