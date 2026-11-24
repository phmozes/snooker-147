import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createSim, recordShot, strike } from '../src/core/physics/sim';
import { breakOffShot, potRedShot, type ShotSetup } from '../src/core/physics/testShots';
import { buildTable } from '../src/core/table/geometry';
import { fitCamera, type PresetId } from '../src/view/camera';
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

  it('every camera preset shows the whole table, centred and filling the view, on any portrait screen', () => {
    const L = CONFIG.layout;
    const tableArea = (L.phoneAspect * (1 - 2 * L.sidePad)) / (L.table[1] - L.table[0]); // the game's table area
    for (const preset of Object.keys(CONFIG.camera.presets) as PresetId[]) {
      for (const aspect of [9 / 19.5, 9 / 16, tableArea, 0.25]) {
        const f = fitCamera(table, preset, aspect);
        const cam = new PerspectiveCamera(f.fov, aspect, 0.05, 100);
        cam.up.set(0, 0, 1);
        cam.position.set(...f.position);
        cam.lookAt(new Vector3(...f.lookAt));
        cam.updateMatrixWorld();
        const e = CONFIG.camera.fitEdge;
        const hw = table.halfWidth + e;
        const hl = table.halfLength + e;
        const ps = ([[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]] as const).map(([x, y]) => new Vector3(x, y, 0).project(cam));
        const most = Math.max(...ps.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));
        expect(most).toBeLessThanOrEqual(1 - CONFIG.camera.fitMargin + 1e-3); // whole table inside
        expect(most).toBeGreaterThan(1 - CONFIG.camera.fitMargin - 0.01); // and as large as it can be
        const ys = ps.map((p) => p.y);
        expect(Math.max(...ys) + Math.min(...ys)).toBeCloseTo(0, 2); // centred top to bottom
        // the angle above the cloth is the preset's
        const d = { y: f.lookAt[1] - f.position[1], z: f.position[2] };
        expect((Math.atan2(d.z, d.y) * 180) / Math.PI).toBeCloseTo(CONFIG.camera.presets[preset].elevationDeg, 0);
      }
    }
  });

  it('the break-off recordings exist for 6 and 15 reds', () => {
    for (const reds of [6, 15]) expect(record(breakOffShot(table, reds)).rec.frames.length).toBeGreaterThan(60);
  });
});
