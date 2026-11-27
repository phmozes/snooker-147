import { describe, expect, it } from 'vitest';
import { baulkLineStart, buildBreaks, isSnookered } from '../src/core/breakLibrary';
import { CONFIG } from '../src/config/game.config';
import oldReds6 from '../public/breaks/reds6.json';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { judgeShot, newFrame } from '../src/core/rules';
import { buildTable } from '../src/core/table/geometry';
import { rackBalls } from '../src/core/table/rack';

const table = buildTable();

function replay(balls: Parameters<typeof createSim>[0], s: { dir: { x: number; y: number }; speed: number; spin: number }) {
  const sim = createSim(balls, table);
  strike(sim, 'cue', s.dir, s.speed, s.spin);
  runUntilStill(sim);
  const first = sim.events.find((e) => e.type === 'ball');
  const firstHit = first && first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
  return { sim, firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id) };
}

describe('task 4.6: break-off library', () => {
  it('the same seed builds the same breaks', () => {
    expect(buildBreaks(6, 'redPottable', 2, table, 5).entries).toEqual(buildBreaks(6, 'redPottable', 2, table, 5).entries);
  });
  it('a red-pottable break: replaying it gives the stored table; its step-1 success pots a red and its miss is a plain miss (D.1)', () => {
    const [e] = buildBreaks(10, 'redPottable', 1, table, 9).entries;
    const rack = rackBalls(10, table).map((b) => (b.kind === 'cue' ? { ...b, pos: { ...e!.cueStart } } : b));
    const brk = replay(rack, e!.breakShot);
    expect(brk.potted).toEqual([]);
    for (const b of e!.after) {
      const p = brk.sim.balls.find((x) => x.id === b.id)!.pos;
      expect(Math.abs(p.x - b.pos.x) + Math.abs(p.y - b.pos.y)).toBeLessThan(1e-5);
    }
    const state = { ...newFrame(10, table), balls: e!.after };
    const ok = replay(e!.after, e!.step1Success!);
    expect(judgeShot(state, 'red', { firstHit: ok.firstHit, potted: ok.potted, after: [] }).result).toBe('success');
    const miss = replay(e!.after, e!.step1Miss!);
    expect(judgeShot(state, 'red', { firstHit: miss.firstHit, potted: miss.potted, after: [] })).toEqual({ result: 'failure', type: 'noPot' });
  }, 60_000);
  it('a snookered break leaves no red to hit straight, and its stored escape fails without potting a ball', () => {
    const [e] = buildBreaks(15, 'snookered', 1, table, 4).entries;
    const state = { ...newFrame(15, table), balls: e!.after };
    expect(isSnookered(state, table)).toBe(true);
    const esc = replay(e!.after, e!.step1Escape!);
    const v = judgeShot(state, 'red', { firstHit: esc.firstHit, potted: esc.potted, after: [] });
    expect(v.result).toBe('failure');
    expect(esc.potted.filter((id) => id !== 'cue')).toEqual([]);
  }, 60_000);
  it('night 6: the break-off starts on the baulk line between the brown and the yellow / green (both sides)', () => {
    const S = CONFIG.breakLibrary.baulkStart;
    for (const [u, side] of [[0, 0.9], [1 - 1e-12, 0.9], [0.5, 0.1], [0, 0.4]] as const) {
      const p = baulkLineStart(u, side, table);
      expect(p.y).toBe(table.baulkY);
      expect(Math.abs(p.x)).toBeGreaterThanOrEqual(S.xMin);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(S.xMax);
      expect(Math.sign(p.x)).toBe(side < 0.5 ? -1 : 1);
    }
    const [e] = buildBreaks(6, 'redPottable', 1, table, 21).entries;
    expect(e!.cueStart.y).toBe(table.baulkY);
  }, 60_000);
  it("night 6: start 'd' still rebuilds the old library exactly (its first reds6 break, seed included)", () => {
    const [e] = buildBreaks(6, 'redPottable', 1, table, CONFIG.breakLibrary.seed + 6, undefined, undefined, 'd').entries;
    expect(e).toEqual(oldReds6.redPottable[0]);
  }, 120_000);
});
