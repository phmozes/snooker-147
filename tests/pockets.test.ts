import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { checkSim, createSim, recordShot, strike } from '../src/core/physics/sim';
import { breakAim, runPocketRoll, type PocketRoll, type RollOutcome } from '../src/core/physics/testShots';
import { buildTable, type PocketId } from '../src/core/table/geometry';
import { rackBalls } from '../src/core/table/rack';

const table = buildTable();
const PT = CONFIG.dev.pocketTest;
const roll = (pocket: PocketId, angleDeg: number, offsetMm: number, speed = 2): PocketRoll =>
  ({ pocket, angleDeg, offset: offsetMm / 1000, speed, distance: PT.distance });

/** Pot map for one pocket: outcome for each (angle, offset). */
function potMap(pocket: PocketId, speed: number) {
  const out: RollOutcome[][] = [];
  const problems = { overlapsOrInsideCushion: 0, fallbackPots: 0 };
  for (let a = -60; a <= 60; a += 10) {
    const row: RollOutcome[] = [];
    for (let o = -60; o <= 60; o += 4) {
      const { outcome, sim } = runPocketRoll(table, roll(pocket, a, o, speed));
      row.push(outcome);
      if (sim) {
        const c = checkSim(sim);
        problems.overlapsOrInsideCushion += c.insideCushion;
        problems.fallbackPots += sim.events.filter((e) => e.type === 'pot' && e.fallback).length;
      }
    }
    out.push(row);
  }
  return { out, problems };
}

describe('pockets', () => {
  it.each(table.pockets.map((p) => [p.id] as const))('%s: a ball rolled straight at the middle of the mouth drops cleanly', (pocket) => {
    expect(runPocketRoll(table, roll(pocket, 0, 0)).outcome).toBe('clean');
  });

  it('a ball aimed at the jaw nose touches the jaw (rattle)', () => {
    const mouth = CONFIG.table.corner.mouth;
    const { outcome } = runPocketRoll(table, roll('topRight', 0, (mouth / 2) * 1000));
    expect(['rattleIn', 'rattleOut']).toContain(outcome);
  });

  it('every kind of result happens: clean pots, rattles that drop, rattles that come out', () => {
    for (const pocket of ['topRight', 'middleRight'] as const) {
      const seen = new Set(potMap(pocket, 2).out.flat());
      for (const o of ['clean', 'rattleIn', 'rattleOut'] as const) expect(seen, `${pocket} ${o}`).toContain(o);
    }
  });

  it('a ball aimed well wide of the pocket misses it (hits the cushion, no jaw)', () => {
    expect(runPocketRoll(table, { ...roll('middleRight', 0, 0), offset: -0.25 }).outcome).toBe('missed'); // hits the side cushion
    expect(runPocketRoll(table, roll('topRight', 0, 0, 0.3)).outcome).toBe('missed'); // too soft: stops short
  });

  it('the safety net is never needed and no ball ends up inside a jaw (pot maps at 3 speeds, 2 pockets)', () => {
    for (const pocket of ['topRight', 'middleRight'] as const) {
      for (const speed of [1, 2.5, 6]) {
        expect(potMap(pocket, speed).problems).toEqual({ overlapsOrInsideCushion: 0, fallbackPots: 0 });
      }
    }
  });

  it('mirror pockets behave as mirror images (topLeft vs topRight, middleLeft vs middleRight)', () => {
    for (const [a, b] of [['topLeft', 'topRight'], ['middleLeft', 'middleRight']] as const) {
      const left = potMap(a, 2).out;
      const right = potMap(b, 2).out;
      // the mirror image swaps the angle sign and the offset sign
      const mirrored = right.slice().reverse().map((row) => row.slice().reverse());
      const cells = left.flat().length;
      const differ = left.flat().filter((c, i) => c !== mirrored.flat()[i]).length;
      expect(differ / cells).toBeLessThan(0.02); // only knife-edge cases may differ by rounding
    }
  });

});

describe('recording', () => {
  it('records every ball at a steady frame rate, with events, and matches the final position', () => {
    const balls = rackBalls(15, table);
    const sim = createSim(balls, table);
    strike(sim, 'cue', breakAim(table, balls), CONFIG.physics.maxCueSpeed);
    const rec = recordShot(sim, 8);
    expect(rec.frameDt).toBeCloseTo(8 * CONFIG.physics.timestep, 12);
    expect(rec.ids).toHaveLength(balls.length);
    expect(rec.frames[0]).toEqual(balls.flatMap((b) => [b.pos.x, b.pos.y]));
    expect(rec.frames.length).toBeGreaterThanOrEqual(Math.floor(rec.duration / rec.frameDt));
    const last = rec.frames[rec.frames.length - 1]!;
    sim.balls.forEach((b, i) => {
      if (b.potted) expect(Number.isNaN(last[2 * i])).toBe(true);
      else expect([last[2 * i], last[2 * i + 1]]).toEqual([b.pos.x, b.pos.y]);
    });
    expect(rec.events.some((e) => e.type === 'ball')).toBe(true);
  });

  it('same shot = same recording', () => {
    const run = () => {
      const balls = rackBalls(10, table);
      const sim = createSim(balls, table);
      strike(sim, 'cue', breakAim(table, balls), CONFIG.physics.maxCueSpeed);
      return recordShot(sim);
    };
    expect(run()).toEqual(run());
  });
});
