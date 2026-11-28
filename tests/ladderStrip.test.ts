// The ladder strip's chips with the chance of each step (owner 2026-11-28, option C of mockups/chance/).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { ladderForLevel } from '../src/core/ladder';
import { stripHtml, stripSteps } from '../src/game/ladderStrip';
import { chipPercent } from '../src/game/rulesText';

describe('ladder strip chips', () => {
  it('whole percent, half up, of the config p', () => {
    expect(chipPercent(0.8943661971830986)).toBe('89%');
    expect(chipPercent(0.8945)).toBe('89%');
    expect(chipPercent(0.895)).toBe('90%'); // half up
    expect(chipPercent(0.7492000000000001)).toBe('75%');
  });
  it('every chip of every strip shows its step multiplier and round(p) (every level, step 0..n, in and between rounds)', () => {
    for (const l of CONFIG.levels) {
      const lad = ladderForLevel(l.id);
      for (let step = 0; step <= lad.length; step++) for (const between of [false, true]) {
        const html = stripHtml(lad, step, between);
        const chips = [...html.matchAll(/<span>(x[\d.]+)<\/span><small class="pc">(\d+)%<\/small>/g)];
        const ks = stripSteps(lad.length, step);
        expect(chips.length).toBe(ks.length);
        ks.forEach((k, i) => {
          expect(chips[i]![1]).toBe(`x${lad[k - 1]!.multiplier.toFixed(2)}`);
          expect(Number(chips[i]![2])).toBe(Math.floor(l.p![k - 1]! * 100 + 0.5 + 1e-9));
        });
        expect(html.includes(between ? 'UP TO' : `STEP ${step}`)).toBe(true);
      }
    }
  });
});
