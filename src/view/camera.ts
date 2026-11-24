// Main camera fit: a preset gives the angle above the cloth and the lens; this finds the distance and the aim point
// so the whole table (plus CONFIG.camera.fitEdge) is in view, centred, and as large as possible on this screen.
// Pure maths (Three.js camera only, no drawing), so it is tested in Node.

import { PerspectiveCamera, Vector3 } from 'three';
import { CONFIG } from '../config/game.config';
import type { TableGeometry } from '../core/table/geometry';

export type PresetId = keyof typeof CONFIG.camera.presets;
export interface CameraFit { position: [number, number, number]; lookAt: [number, number, number]; fov: number }

function place(cam: PerspectiveCamera, elevationDeg: number, distance: number, lookY: number) {
  const e = (elevationDeg * Math.PI) / 180;
  cam.up.set(0, 0, 1);
  cam.position.set(0, lookY - distance * Math.cos(e), distance * Math.sin(e));
  cam.lookAt(new Vector3(0, lookY, 0));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
}

/** Screen extents (-1..1) of the four outer corners: [biggest |x|, top y, bottom y]. */
function extents(cam: PerspectiveCamera, hw: number, hl: number): [number, number, number] {
  let mx = 0;
  let top = -Infinity;
  let bottom = Infinity;
  for (const [x, y] of [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]] as const) {
    const p = new Vector3(x, y, 0).project(cam);
    mx = Math.max(mx, Math.abs(p.x));
    top = Math.max(top, p.y);
    bottom = Math.min(bottom, p.y);
  }
  return [mx, top, bottom];
}

export function fitCamera(table: TableGeometry, preset: PresetId, aspect: number): CameraFit {
  const P = CONFIG.camera.presets[preset];
  const hw = table.halfWidth + CONFIG.camera.fitEdge;
  const hl = table.halfLength + CONFIG.camera.fitEdge;
  const cam = new PerspectiveCamera(P.fov, aspect, 0.05, 100);
  const limit = 1 - CONFIG.camera.fitMargin;
  // for a distance: aim point that centres the table vertically (bisection), then its size on screen
  const centred = (d: number) => {
    let lo = -hl;
    let hi = hl;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      place(cam, P.elevationDeg, d, mid);
      const [, top, bottom] = extents(cam, hw, hl);
      if (top + bottom > 0) lo = mid; else hi = mid; // table sits too high on screen: aim further up the table
    }
    place(cam, P.elevationDeg, d, (lo + hi) / 2);
    const [mx, top, bottom] = extents(cam, hw, hl);
    return { lookY: (lo + hi) / 2, size: Math.max(mx, top, -bottom) };
  };
  let lo = 0.5;
  let hi = 40;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (centred(mid).size > limit) lo = mid; else hi = mid; // too big: move back
  }
  const { lookY } = centred(hi);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return { position: [0, r(cam.position.y), r(cam.position.z)], lookAt: [0, r(lookY), 0], fov: P.fov };
}
