import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createSim, recordShot, strike } from '../src/core/physics/sim';
import { breakOffShot, potRedShot, type ShotSetup } from '../src/core/physics/testShots';
import { buildTable } from '../src/core/table/geometry';
import { positionsAt } from '../src/view/playback';

const table = buildTable();
const record = (s: ShotSetup) => {
  const sim = createSim(s.balls, table);
  strike(sim, 'cue', s.dir, s.speed, s.spin);
  return { rec: recordShot(sim), sim };
};

describe('task 2.1: recorded check shots and playback', () => {
  it('"Pot a red" pots the red and nothing else, and is the same every time', () => {
    const a = potRedShot(table);
    expect(potRedShot(table)).toEqual(a);
    const { sim } = record(a);
    expect(sim.balls.filter((b) => b.potted).map((b) => b.id)).toEqual(['red1']);
  });

  it('playback gives the recorded frames exactly, blends between them, and hides a ball once it drops', () => {
    const { rec, sim } = record(potRedShot(table));
    const i = rec.ids.indexOf('red1');
    const f = 10;
    const at = positionsAt(rec, f * rec.frameDt)[i]!;
    expect(at.x).toBe(rec.frames[f]![2 * i]);
    const half = positionsAt(rec, (f + 0.5) * rec.frameDt)[i]!;
    expect(half.x).toBeCloseTo((rec.frames[f]![2 * i]! + rec.frames[f + 1]![2 * i]!) / 2, 12);
    expect(positionsAt(rec, 1e9)[i]).toBeNull(); // potted at the end
    // the cue ball's last playback position is where the simulation left it
    const end = positionsAt(rec, 1e9)[rec.ids.indexOf('cue')]!;
    expect(end).toEqual(sim.balls.find((b) => b.id === 'cue')!.pos);
  });

  it('the main camera from the config shows the whole table on a portrait phone screen', () => {
    const c = CONFIG.camera.main;
    for (const aspect of [9 / 19.5, 9 / 16]) {
      const cam = new PerspectiveCamera(c.fov, aspect, 0.05, 50);
      cam.up.set(0, 0, 1);
      cam.position.set(...c.position);
      cam.lookAt(new Vector3(...c.lookAt));
      cam.updateMatrixWorld();
      const hw = table.halfWidth;
      const hl = table.halfLength;
      for (const [x, y] of [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]] as const) {
        const p = new Vector3(x, y, 0).project(cam);
        expect(Math.abs(p.x)).toBeLessThan(1);
        expect(Math.abs(p.y)).toBeLessThan(1);
      }
    }
  });

  it('the break-off recordings exist for 6 and 15 reds', () => {
    for (const reds of [6, 15]) expect(record(breakOffShot(table, reds)).rec.frames.length).toBeGreaterThan(60);
  });
});
