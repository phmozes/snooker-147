// @ts-nocheck -- moved as it was from the approved cue mockup (docs/cue-options.html, owner chose C1, night 4).
// ONE piece of code for the cue in the mockup page and in the game. Drawn in code only (canvas skin, no image files).
// The cue is visual only: its direction comes from the planned shot's cue direction (never from the outcome), its
// elevation from where the balls lie (raised-butt rule: it clears the cushion, the rail and any ball under it).
import * as THREE from 'three';
import { CONFIG } from '../config/game.config';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const unit = (a) => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };
const RS = (table) => table.ballRadius * CONFIG.view3d.ballScale; // drawn ball radius

// MOTION AND TIMING: approved by the owner with C1. Do not change these numbers.
export const CUE = {
  length: 1.47, tipR: 0.0065, buttR: 0.019,      // m. The OLD cue's thickness. Also used for the raised-butt angle of both cues.
  minElevation: 4, maxElevation: 40, clear: 0.006, // degrees; `clear` = air (m) between the cue and a rail or ball under it
  pull: 0.10,                                    // tip starts this far (m) behind the cue ball
  follow: 0.03, followTime: 0.12,                // tip goes on this far after the hit
  fadeOutDelay: 0.05, fadeOut: 0.35,             // after the hit, while the balls roll
};
// LOOK of the new cue: every number is here.
export const LOOK = {
  // Real cue: 147 cm long, 9.5 mm tip, 29 mm butt end, even taper. Lengths are real; only the thickness is multiplied.
  scale: 1.8,                        // thickness against the real cue. Old cue was about 1.3x.
  tipD: 0.0095, buttD: 0.029,        // real diameters (m)
  tip: 0.005, ferrule: 0.012,        // m from the tip end: blue leather tip 5 mm, then a 7 mm brass ferrule
  pointsTop: 1.04, pointsBase: 1.25, // ebony butt = the last 43 cm: four points from `pointsBase` up to `pointsTop` (m from the tip)
  ring: [1.385, 1.407], cap: 1.452,  // brass ring (22 mm, wide enough for the name) and the dark end cap
  logo: 'Adraba', logoHeight: 0.72, logoFlip: true, // name on the ring: letter size as a share of the ring width
  glow: 0.10, rim: 0.55,             // own light of the wood (so the butt never goes black) and the lighter edge
  shadow: { dark: 0.55, blur: 0.004, spread: 0.07 }, // darkness at the cloth, soft edge (m), extra soft edge per metre of height
};
export const DIM = { old: { tipR: CUE.tipR, buttR: CUE.buttR }, new: { tipR: LOOK.tipD / 2 * LOOK.scale, buttR: LOOK.buttD / 2 * LOOK.scale } };
export const radiusAt = (kind, s) => DIM[kind].tipR + (DIM[kind].buttR - DIM[kind].tipR) * Math.min(1, s / CUE.length);
export const VARIANTS = {
  C0: { label: 'C0', name: 'Nothing (today)', line: 'The cue ball just starts to move.', appear: 0, stroke: 0 },
  C1old: { label: 'C1 old', name: 'Full cue, first drawing', line: 'The thin pale cue from the last round, for comparison.', appear: 0.06, stroke: 0.19, cue: 'old' },
  C1: { label: 'C1 new', name: 'Full cue, new look', line: 'Real cue sizes (147 cm, 9.5 mm tip, 29 mm butt, 7 mm brass ferrule, 43 cm ebony butt with four points), drawn 1.8x thick. Ash with dark grain, textured ebony, the name Adraba on the brass ring, soft shadow. Same motion and timing.', appear: 0.06, stroke: 0.19, cue: 'new' },
};
for (const v of Object.values(VARIANTS)) { v.added = v.appear + v.stroke; if (v.added > 0.2501) throw new Error('cue action longer than 0.25 s'); }

// OLD cue (last round, unchanged): one turned shape coloured per point.
export function makeOldCue(scene) {
  const L = CUE.length, e = 0.0002, rAt = (s) => radiusAt('old', s);
  const stops = [0, 0.009 - e, 0.009 + e, 0.034 - e, 0.034 + e];
  for (let s = 0.06; s < L - 0.01; s += 0.03) stops.push(s);
  stops.push(1.02 - e, 1.02 + e, 1.035 - e, 1.035 + e);
  stops.sort((a, b) => a - b); stops.push(L);
  const pts = [new THREE.Vector2(0, 0), ...stops.map((s) => new THREE.Vector2(rAt(s) * (s === 0 ? 0.8 : 1), s)), new THREE.Vector2(0, L)];
  const geo = new THREE.LatheGeometry(pts, 16);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 4), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getY(i);
    c.set(s < 0.009 ? '#3f6f8f' : s < 0.034 ? '#f1ead6' : s > 1.035 ? '#22130c' : s > 1.02 ? '#c9a24a' : '#dcb878');
    col.set([c.r, c.g, c.b, 1], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.35, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 5; scene.add(m); return m;
}

// NEW cue. Its skin is painted in code: across the picture = round the cue, down the picture = from the tip to the butt.
export function cueSkin(renderer) {
  const W = 256, Hh = 4096, c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const g = c.getContext('2d'), y = (s) => s / CUE.length * Hh, kx = W / 128, ky = Hh / 2048;
  let seed = 777; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const streaks = (n, y0, y1, rgb, a0, a1, l0, l1, wide = 1) => { for (let i = 0; i < n; i++) {
    const x = rnd() * W, ys = y0 + rnd() * (y1 - y0), l = (l0 + rnd() * (l1 - l0)) * ky;
    g.strokeStyle = `rgba(${rgb},${(a0 + rnd() * (a1 - a0)).toFixed(3)})`; g.lineWidth = (0.6 + rnd() * 1.4) * kx * wide;
    g.beginPath(); g.moveTo(x, ys); g.lineTo(x + (rnd() - 0.5) * 4 * kx, Math.min(y1, ys + l)); g.stroke(); } };
  // shaft: pale ash with clearly visible dark grain: long lines, and the dark arrow marks ash is known for
  g.fillStyle = '#e6c98f'; g.fillRect(0, 0, W, Hh);
  streaks(260, 0, Hh, '150,100,45', 0.14, 0.38, 80, 420);
  streaks(70, 0, Hh, '96,60,24', 0.30, 0.60, 120, 520, 0.8);
  streaks(60, 0, Hh, '255,240,205', 0.10, 0.25, 60, 300);
  for (let k = 0; k < 26; k++) {
    const cx = rnd() * W, cy = y(0.06) + rnd() * (y(LOOK.pointsTop) - y(0.06)), w = (6 + rnd() * 7) * kx, h = (16 + rnd() * 26) * ky;
    g.strokeStyle = `rgba(96,60,24,${(0.45 + rnd() * 0.3).toFixed(2)})`; g.lineWidth = 1.3 * kx;
    for (let j = 0; j < 3; j++) { g.beginPath(); g.moveTo(cx - w, cy + j * 9 * ky); g.lineTo(cx, cy + j * 9 * ky - h); g.lineTo(cx + w, cy + j * 9 * ky); g.stroke(); }
  }
  // butt: ebony, with four points running up into the ash, each edged with a thin lighter veneer line
  const base = y(LOOK.pointsBase), apex = y(LOOK.pointsTop), q = W / 4;
  g.beginPath();
  for (let k = 0; k < 4; k++) { g.moveTo(k * q, base + 1); g.lineTo((k + 0.5) * q, apex); g.lineTo((k + 1) * q, base + 1); }
  g.rect(0, base, W, Hh - base);
  g.fillStyle = '#2a1a13'; g.fill();
  // wood figure inside the ebony only: brown bands, long grain lines of several browns, near-black lines and small pores
  g.save(); g.beginPath();
  for (let k = 0; k < 4; k++) { g.moveTo(k * q + 3 * kx, base + 1); g.lineTo((k + 0.5) * q, apex + 24 * ky); g.lineTo((k + 1) * q - 3 * kx, base + 1); }
  g.rect(0, base, W, Hh - base); g.clip();
  for (let i = 0; i < 9; i++) { const x = rnd() * W, w = (5 + rnd() * 12) * kx, gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(110,68,38,0)'); gr.addColorStop(0.5, `rgba(110,68,38,${(0.22 + rnd() * 0.25).toFixed(2)})`); gr.addColorStop(1, 'rgba(110,68,38,0)');
    g.fillStyle = gr; g.fillRect(x - w, apex, 2 * w, Hh - apex); }
  streaks(170, apex, Hh, '142,96,60', 0.16, 0.42, 60, 360);
  streaks(60, apex, Hh, '186,132,84', 0.12, 0.30, 30, 160, 0.6);
  streaks(90, apex, Hh, '10,6,4', 0.30, 0.65, 80, 420);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '170,120,80' : '8,5,3'},${(0.2 + rnd() * 0.35).toFixed(2)})`; g.fillRect(rnd() * W, apex + rnd() * (Hh - apex), 1.2, (2 + rnd() * 6) * ky); }
  g.restore();
  g.strokeStyle = 'rgba(176,112,52,0.95)'; g.lineWidth = 2.2 * kx; g.beginPath();
  for (let k = 0; k < 4; k++) { g.moveTo(k * q, base); g.lineTo((k + 0.5) * q, apex); g.lineTo((k + 1) * q, base); }
  g.stroke();
  // brass ring near the end with the name engraved on it, and the dark end cap
  const band = (s0, s1, stops) => { const gr = g.createLinearGradient(0, y(s0), 0, y(s1)); stops.forEach(([t, col]) => gr.addColorStop(t, col)); g.fillStyle = gr; g.fillRect(0, y(s0), W, y(s1) - y(s0)); };
  band(LOOK.ring[0], LOOK.ring[1], [[0, '#7c5c1c'], [0.1, '#e4c672'], [0.5, '#d9b558'], [0.9, '#c9a244'], [1, '#6d5220']]);
  { // the name runs round the ring, in the ebony's own dark brown (cut into the brass), with a thin light lower edge
    const y0 = y(LOOK.ring[0]), y1 = y(LOOK.ring[1]), hPx = (y1 - y0) * LOOK.logoHeight, circ = 2 * Math.PI * radiusAt('new', LOOK.ring[0]);
    const sx = (W / circ) / (Hh / CUE.length); // the picture is stretched round the cue: squeeze the letters so they come out true
    g.save(); g.translate(W / 2, (y0 + y1) / 2); g.scale(LOOK.logoFlip ? -sx : sx, 1);
    g.font = `800 ${hPx.toFixed(1)}px "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,238,170,0.75)'; g.fillText(LOOK.logo, 0, hPx * 0.09);
    g.fillStyle = '#2a1a13'; g.fillText(LOOK.logo, 0, hPx * 0.04);
    g.restore();
  }
  band(LOOK.cap, CUE.length, [[0, '#6a5444'], [0.12, '#3a2c24'], [1, '#2c211b']]);
  // tip end: the blue chalked leather tip, then the short brass ferrule
  band(LOOK.tip, LOOK.ferrule, [[0, '#6d5220'], [0.15, '#ecd183'], [0.55, '#d6b052'], [0.88, '#b8913a'], [1, '#5f4718']]);
  g.fillStyle = '#3f84c4'; g.fillRect(0, 0, W, y(LOOK.tip));
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(190,222,248,${(0.25 + rnd() * 0.5).toFixed(2)})`; g.fillRect(rnd() * W, rnd() * y(LOOK.tip), 2, 2); }
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
export function makeNewCue(scene, renderer) {
  const L = CUE.length, rAt = (s) => radiusAt('new', s), tipR = DIM.new.tipR, buttR = DIM.new.buttR;
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(tipR * 0.55, 0.0006), new THREE.Vector2(tipR * 0.9, 0.003)]; // domed tip
  for (let s = 0.006; s < L - 0.012; s += 0.02) pts.push(new THREE.Vector2(rAt(s), s));
  pts.push(new THREE.Vector2(buttR, L - 0.012), new THREE.Vector2(buttR * 0.93, L - 0.004), new THREE.Vector2(buttR * 0.7, L), new THREE.Vector2(0, L)); // rounded end
  const geo = new THREE.LatheGeometry(pts, 28);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, pos.getY(i) / L); // the skin runs by true distance from the tip
  const skin = cueSkin(renderer);
  const mat = new THREE.MeshPhysicalMaterial({ map: skin, roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.22, transparent: true, side: THREE.DoubleSide,
    emissive: '#ffffff', emissiveMap: skin, emissiveIntensity: LOOK.glow });
  mat.onBeforeCompile = (sh) => { // a slightly lighter edge all along the cue, so the dark butt stands out against a black background
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(0.62, 0.47, 0.33) * ${LOOK.rim.toFixed(3)} * pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);`);
  };
  const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 5; scene.add(m); return m;
}

/** The soft shadow of the new cue on the cloth and on the rail top (env: hw, hl, rim, railZ). */
export function createCueShadow(scene, env) {
  const { hw, hl, rim, railZ } = env;
  // Soft shadow of the new cue: its outline thrown along the lamp's light (the same lamp that makes the ball shadows,
  // see addLamp above) onto the cloth, and onto the rail top where the cue passes over the rail. The higher the cue is
  // over the surface, the further the shadow moves away from it and the softer and paler it gets.
  const LIGHT = new THREE.Vector3(-0.3, 1.6, -4).normalize(); // the way the lamp light travels
  const SHADOW_STEPS = 60;
  const onBed = (x, y) => Math.abs(x) <= hw && Math.abs(y) <= hl;
  const shadowParts = [
    { z: 0.003, inside: onBed, dark: 1 },
    { z: railZ + 0.002, dark: 1.4, inside: (x, y) => !onBed(x, y) && Math.abs(x) <= hw + rim && Math.abs(y) <= hl + rim }, // dark wood needs a stronger shadow to show
  ].map((part) => {
    const n = (SHADOW_STEPS + 1) * 4, geo = new THREE.BufferGeometry(), index = [];
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    for (let i = 0; i < SHADOW_STEPS; i++) for (let j = 0; j < 3; j++) { const a = i * 4 + j, b = a + 4; index.push(a, b, a + 1, a + 1, b, b + 1); }
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = false; scene.add(mesh);
    return { ...part, mesh };
  });
  function castCueShadow(tip, axis, alpha, len = CUE.length) { // len: the visible length (the game may shorten it)
    const k0 = axis.z / -LIGHT.z, dir = unit({ x: axis.x + LIGHT.x * k0, y: axis.y + LIGHT.y * k0 }), nx = -dir.y, ny = dir.x;
    for (const part of shadowParts) {
      const pos = part.mesh.geometry.attributes.position, col = part.mesh.geometry.attributes.color;
      for (let i = 0; i <= SHADOW_STEPS; i++) {
        const s = len * i / SHADOW_STEPS, px = tip.x + axis.x * s, py = tip.y + axis.y * s, h = tip.z + axis.z * s - part.z;
        const k = h / -LIGHT.z, x = px + LIGHT.x * k, y = py + LIGHT.y * k, r = radiusAt('new', s);
        const w = r + LOOK.shadow.blur + LOOK.shadow.spread * Math.max(0, h), core = r * 0.6;
        const a = h > 0 && part.inside(x, y) ? Math.min(0.9, LOOK.shadow.dark * part.dark) * alpha * Math.min(1, (r + LOOK.shadow.blur) / w) ** 0.8 : 0;
        [-w, -core, core, w].forEach((o, j) => { pos.setXYZ(i * 4 + j, x + nx * o, y + ny * o, part.z); col.setXYZW(i * 4 + j, 0, 0, 0, j === 0 || j === 3 ? 0 : a); });
      }
      pos.needsUpdate = col.needsUpdate = true; part.mesh.visible = true;
    }
  }
  const hide = () => { for (const p of shadowParts) p.mesh.visible = false; };
  return { cast: castCueShadow, hide };
}

/** Gap between the tip and the cue ball, and the opacity, at `tau` seconds after the SHOOT press (V = timing of the
 *  variant: appear + stroke). Uses only the timing, never the result. */
export function cuePose(V, tau) { // gap between tip and cue ball, and opacity. Uses only the aim of the plan, never the result.
  const T = V.added, sinceHit = tau - T;
  const k = clamp01((tau - V.appear) / V.stroke);
  const gap = sinceHit < 0 ? CUE.pull * (1 - k * k) : -CUE.follow * (1 - (1 - clamp01(sinceHit / CUE.followTime)) ** 2);
  const alpha = tau < 0 ? 0 : Math.min(clamp01(tau / V.appear), 1 - clamp01((sinceHit - CUE.fadeOutDelay) / CUE.fadeOut));
  return { gap, alpha };
}

/** The cue's axis (from the tip towards the butt): it points at the middle of the cue ball along the shot direction
 *  `d`, raised just enough to clear the cushion, the rail and any ball under it (others: positions of the other
 *  balls). env: hw, hl, cw (cushion width), cushionZ, railZ, rs (drawn ball radius). */
export function cueAxis(C, d, others, env) {
  const { hw, hl, cw, cushionZ, railZ, rs } = env;
  const exitAt = (from, dir, bx, by) => { let s = Infinity;
    if (dir.x > 1e-9) s = Math.min(s, (bx - from.x) / dir.x); if (dir.x < -1e-9) s = Math.min(s, (-bx - from.x) / dir.x);
    if (dir.y > 1e-9) s = Math.min(s, (by - from.y) / dir.y); if (dir.y < -1e-9) s = Math.min(s, (-by - from.y) / dir.y);
    return s; };
  const back = { x: -d.x, y: -d.y }, rAt = (s) => radiusAt('old', s);
  let tan = Math.tan(CUE.minElevation * Math.PI / 180), why = 'flat';
  const need = (s, top, what) => { if (s < CUE.length) { const t = (top + rAt(s) + CUE.clear - rs) / s; if (t > tan) { tan = t; why = what; } } };
  need(exitAt(C, back, hw, hl), cushionZ, 'cushion'); need(exitAt(C, back, hw + cw, hl + cw), railZ, 'rail');
  for (const p of others) {
    const rel = { x: p.x - C.x, y: p.y - C.y }, s = rel.x * back.x + rel.y * back.y, lat = Math.abs(rel.x * back.y - rel.y * back.x), gap = rs + rAt(s) + CUE.clear;
    if (s > 0 && s < CUE.length && lat < gap) { const t = Math.tan(Math.asin(Math.min(0.95, Math.sqrt(gap * gap - lat * lat) / s))); if (t > tan) { tan = t; why = 'ball'; } }
  }
  const el = Math.min(Math.atan(tan), CUE.maxElevation * Math.PI / 180);
  return { el, why, axis: new THREE.Vector3(back.x * Math.cos(el), back.y * Math.cos(el), Math.sin(el)) };
}

const Y = new THREE.Vector3(0, 1, 0), TOWARD_CAMERA = new THREE.Vector3(0, -0.5, 0.87).normalize();
/** Put cue mesh `m` (new cue) at rest `gap` behind the cue ball at C (drawn radius rs), along `axis`, with opacity. */
export function placeCue(m, C, rs, axis, gap, alpha) {
  m.visible = alpha > 0.003; m.material.opacity = alpha;
  m.quaternion.setFromUnitVectors(Y, axis);
  const tip = new THREE.Vector3(C.x, C.y, rs).addScaledVector(axis, rs + gap); m.position.copy(tip);
  if (m.material.map) { // roll the skin so the name on the ring faces the player
    const face = TOWARD_CAMERA.clone().applyQuaternion(m.quaternion.clone().invert());
    m.material.map.offset.x = 0.5 - Math.atan2(face.x, face.z) / (2 * Math.PI);
  }
  return tip;
}
