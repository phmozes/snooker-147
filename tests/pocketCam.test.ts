// Small task 2 (2026-11-27): the pocket-camera cut (src/view/pocketCam.ts). Visual only; these check the placement for
// all 6 pockets, the P1b/P2 pick from the visual stream, and that pots and rattles get the same cut rule.
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createSim, recordShot, strike } from '../src/core/physics/sim';
import { pocketRollStart, classifyRoll } from '../src/core/physics/testShots';
import { streamValue } from '../src/core/round';
import { buildTable, type PocketId } from '../src/core/table/geometry';
import { addedSeconds, cutRateAt, pickView, planCut, pocketCamPose, type PocketView } from '../src/view/pocketCam';

const table = buildTable();
const PHONE = 390 / 844;

function cam(pose: ReturnType<typeof pocketCamPose>) {
  const c = new PerspectiveCamera(pose.fov, PHONE, 0.05, 50);
  c.up.set(0, 0, 1);
  c.position.set(...pose.position);
  c.lookAt(new Vector3(...pose.lookAt));
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}
const inView = (c: PerspectiveCamera, x: number, y: number, z: number) => {
  const q = new Vector3(x, y, z).project(c);
  return Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1 && q.z < 1;
};

describe('pocket camera placement (all 6 pockets)', () => {
  for (const view of ['P1b', 'P2'] as PocketView[]) {
    it(`${view}: the mouth middle and the drop circle are on screen (phone shape), for every pocket`, () => {
      for (const p of table.pockets) {
        const c = cam(pocketCamPose(p, view));
        expect(inView(c, p.mouthMid.x, p.mouthMid.y, 0), `${view} ${p.id} mouth`).toBe(true);
        expect(inView(c, p.captureCentre.x, p.captureCentre.y, 0), `${view} ${p.id} drop`).toBe(true);
      }
    });
  }
  it('the 6 poses are mirror images of each other (same height, same distance from the mouth)', () => {
    for (const view of ['P1b', 'P2'] as PocketView[]) {
      const tl = pocketCamPose(table.pockets.find((p) => p.id === 'topLeft')!, view);
      const tr = pocketCamPose(table.pockets.find((p) => p.id === 'topRight')!, view);
      const br = pocketCamPose(table.pockets.find((p) => p.id === 'bottomRight')!, view);
      expect(tr.position[0]).toBeCloseTo(-tl.position[0], 9);
      expect(tr.position[1]).toBeCloseTo(tl.position[1], 9);
      expect(br.position[1]).toBeCloseTo(-tr.position[1], 9);
      expect(br.position[2]).toBeCloseTo(tl.position[2], 9);
    }
  });
  it('P1b looks 20 degrees down, from 40 cm high, 60 cm behind the mouth', () => {
    const p = table.pockets[0]!, pose = pocketCamPose(p, 'P1b');
    const d = new Vector3(pose.lookAt[0] - pose.position[0], pose.lookAt[1] - pose.position[1], pose.lookAt[2] - pose.position[2]).normalize();
    expect(Math.asin(-d.z) * 180 / Math.PI).toBeCloseTo(20, 6);
    expect(pose.position[2]).toBe(0.40);
    expect(Math.hypot(pose.position[0] - p.mouthMid.x, pose.position[1] - p.mouthMid.y)).toBeCloseTo(0.60, 9);
  });
});

describe('P1b / P2 pick: visual-only stream', () => {
  it('about 70 / 30, the same every time for the same round and step, and not the outcome stream', () => {
    let p1b = 0, differ = 0;
    const N = 4000;
    for (let s = 1; s <= N; s++) {
      const v = pickView(s * 7919, 3, 3);
      if (v === 'P1b') p1b++;
      expect(pickView(s * 7919, 3, 3)).toBe(v);
      if (streamValue(s * 7919, 'outcome', 3, 3) !== streamValue(s * 7919, CONFIG.pocketCut.stream, 3, 3)) differ++;
    }
    expect(p1b / N).toBeGreaterThan(0.67);
    expect(p1b / N).toBeLessThan(0.73);
    expect(differ).toBe(N);
  });
});

/** A red rolled at a pocket from 1 m away (offset across the mouth), recorded as a shot. */
function roll(pocket: PocketId, offset: number, angleDeg = 0) {
  const st = pocketRollStart(table, { pocket, angleDeg, offset, speed: 1.6, distance: 1.0 })!;
  const sim = createSim([{ id: 'red1', kind: 'red', pos: st.pos }], table);
  strike(sim, 'red1', st.dir, 1.6, 0);
  const rec = recordShot(sim);
  return { rec, outcome: classifyRoll(sim, 'red1') };
}

describe('the cut: same rule for a pot and a rattle', () => {
  it('both get a cut that starts 0.5 s before arrival, at the same distance from the mouth', () => {
    for (const id of ['topRight', 'middleLeft'] as PocketId[]) {
      const pot = roll(id, 0);
      let rattle = null as ReturnType<typeof roll> | null;
      for (const off of [0.03, 0.035, 0.04, 0.045, 0.05, 0.055, 0.06]) { const r = roll(id, off); if (r.outcome === 'rattleOut') { rattle = r; break; } }
      expect(pot.outcome === 'clean' || pot.outcome === 'rattleIn').toBe(true);
      expect(rattle, `a rattle at ${id}`).not.toBeNull();
      const a = planCut(pot.rec, table, 'red1', id, 'P1b')!, b = planCut(rattle!.rec, table, 'red1', id, 'P1b')!;
      for (const c of [a, b]) {
        expect(c.from).toBeCloseTo(c.arrival - CONFIG.pocketCut.secondsBeforeArrival, 9);
        expect(c.to - c.from).toBeLessThanOrEqual(CONFIG.pocketCut.maxSeconds * CONFIG.camera.slowMotionScale + 1e-9);
        expect(cutRateAt((c.from + c.to) / 2, c)).toBe(CONFIG.camera.slowMotionScale);
        expect(cutRateAt(c.to + 0.01, c)).toBe(1);
      }
      expect(Math.abs(a.arrival - b.arrival)).toBeLessThan(0.05); // same speed and distance: arrives at about the same time
      expect(addedSeconds(a)).toBeCloseTo(addedSeconds(b), 9); // the same slow motion, pot or rattle
      expect(pot.rec.duration).toBeLessThan(rattle!.rec.duration); // although the pot ends sooner
    }
  });
  it('no cut when the ball never comes near that pocket', () => {
    const r = roll('topRight', 0);
    expect(planCut(r.rec, table, 'red1', 'bottomLeft', 'P2')).toBeNull();
  });
});
