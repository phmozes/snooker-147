// 3D table (Three.js). Two looks, chosen by config view3d.look (dev panel switch to compare on the phone):
//  - 'club': the approved look (owner 2026-11-26): look A with the wood and T1 pockets of docs/pocket-options.html,
//    drawn by src/view/tableLook.ts, the SAME code the mockup page imports. Clean cloth, no text on it.
//  - 'grey': the old gray-box drawing (flat green cloth, plain boxes for cushions, black discs for holes).
// Fixed main camera: a preset from config, fitted to the screen (camera.ts). Balls drawn ballScale x (visual only).
// A potted ball is seen dropping into the hole: when the physics drops it (position null), the view lets it fall into
// the pit for a moment (it moves on towards the pocket centre and sinks), then hides it. Visual only, no physics.
// World axes are the physics axes: x across the table, y along it (+y = top cushion), z up; units are metres.

import * as THREE from 'three';
import { CONFIG } from '../config/game.config';
import { arcPoints, type TableGeometry } from '../core/table/geometry';
import type { BallKind, Vec2 } from '../core/types';
import { fitCamera, type CameraFit, type PresetId } from './camera';
import { BALL_COLOURS, DROP_GRAVITY } from './playback';
import { createLook } from './tableLook';
import { createCueShadow, CUE, cueAxis, makeNewCue, placeCue, radiusAt } from './cue';

const G = CONFIG.view3d;
export type TableLookId = 'club' | 'grey';

/** Grey box: the drawing used until night 4 (kept for comparison). */
function buildGrey(scene: THREE.Scene, table: TableGeometry) {
  scene.background = new THREE.Color(G.background);
  scene.add(new THREE.AmbientLight(0xffffff, G.ambientLight));
  const sun = new THREE.DirectionalLight(0xffffff, G.topLight);
  sun.position.set(0, 0, 5);
  scene.add(sun);
  const hw = table.halfWidth, hl = table.halfLength;
  const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2 * (hw + G.rim), 2 * (hl + G.rim), 0.05), mat('#5b3a22'));
  frame.position.z = -0.026;
  scene.add(frame);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2 * hw, 2 * hl), mat('#1f7a4d')));
  for (const p of table.pockets) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(p.captureRadius, 32), new THREE.MeshBasicMaterial({ color: '#050606' }));
    hole.position.set(p.captureCentre.x, p.captureCentre.y, 0.001);
    scene.add(hole);
  }
  const cushionMat = mat('#2a6b45');
  const wall = (a: Vec2, b: Vec2, normal: Vec2) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const box = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dy), G.cushionDepth, G.cushionHeight), cushionMat);
    box.position.set((a.x + b.x) / 2 - (normal.x * G.cushionDepth) / 2, (a.y + b.y) / 2 - (normal.y * G.cushionDepth) / 2, G.cushionHeight / 2);
    box.rotation.z = Math.atan2(dy, dx);
    scene.add(box);
  };
  for (const s of [...table.cushions, ...table.throatWalls]) wall(s.a, s.b, s.normal);
  for (const j of table.jaws) {
    const pts = arcPoints(j, j.start, j.start + j.sweep, G.jawPieces);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      const mid = { x: (a.x + b.x) / 2 - j.centre.x, y: (a.y + b.y) / 2 - j.centre.y };
      const l = Math.hypot(mid.x, mid.y);
      wall(a, b, { x: mid.x / l, y: mid.y / l });
    }
  }
}

interface Drop { from: Vec2; vel: Vec2; to: Vec2; t0: number; realT0: number; logged?: boolean }

export function createTable3d(canvas: HTMLCanvasElement, table: TableGeometry, kinds: BallKind[], look: TableLookId = G.look) {
  const club = look === 'club';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, club ? G.club.maxPixelRatio : 2));
  if (club) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  const scene = new THREE.Scene();
  let preset: PresetId = CONFIG.camera.main;
  let fit: CameraFit = fitCamera(table, preset, 1);
  const camera = new THREE.PerspectiveCamera(fit.fov, 1, 0.05, 50);
  camera.up.set(0, 0, 1);

  const r = table.ballRadius;
  let ballColour: Record<string, string> = BALL_COLOURS;
  let pit = 0.1;
  let heights: { cushionZ: number; railZ: number; cw: number } = { cushionZ: G.cushionHeight, railZ: G.cushionHeight + 0.01, cw: G.cushionDepth };
  if (club) {
    const L = createLook(table);
    heights = { cushionZ: L.H.cushion, railZ: L.H.rail, cw: L.CW };
    L.buildNew('t1', scene, false);
    // the lamp of the mockup; on a phone its shadow map is smaller (config view3d.club.shadowMap)
    L.addLamp(scene);
    scene.traverse((o) => { if (o instanceof THREE.DirectionalLight && o.castShadow) o.shadow.mapSize.set(G.club.shadowMap, G.club.shadowMap); });
    ballColour = L.BALL;
    pit = L.H.pit;
  } else buildGrey(scene, table);
  // one shared ball geometry; materials per kind
  const sphere = club ? new THREE.SphereGeometry(r, 32, 22) : new THREE.SphereGeometry(r, 24, 16);
  const matFor = (k: BallKind) => (club
    ? new THREE.MeshPhysicalMaterial({ color: ballColour[k], roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 })
    : new THREE.MeshLambertMaterial({ color: BALL_COLOURS[k] }));
  let ballScale: number = G.ballScale; // drawn size only; the ball centre stays where the physics put it
  let balls: THREE.Mesh[] = [];
  let last: (Vec2 | null)[] = [];
  let prev: (Vec2 | null)[] = [];
  let lastAt = 0;
  let drops: (Drop | null)[] = [];
  let moveVel: ({ x: number; y: number } | null)[] = [];
  let movedAt: (number | undefined)[] = [];
  function setKinds(ks: BallKind[]) {
    for (const m of balls) { scene.remove(m); (m.material as THREE.Material).dispose(); }
    balls = ks.map((k) => {
      const m = new THREE.Mesh(sphere, matFor(k));
      m.scale.setScalar(ballScale);
      m.position.z = r * ballScale;
      m.castShadow = club;
      m.visible = false;
      scene.add(m);
      return m;
    });
    last = ks.map(() => null); prev = ks.map(() => null); drops = ks.map(() => null); moveVel = ks.map(() => null); movedAt = ks.map(() => undefined);
  }
  setKinds(kinds);

  let override: CameraFit | null = null;
  /** Show the scene from another camera (a pocket camera), or null = back to the main camera. Visual only. */
  function setCameraOverride(pose: CameraFit | null) { override = pose; resize(); }
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fit = fitCamera(table, preset, camera.aspect);
    const pose = override ?? fit; // pocket camera (pocketCam.ts) while a cut is on, else the main camera
    camera.fov = pose.fov;
    camera.position.set(...pose.position);
    camera.lookAt(new THREE.Vector3(...pose.lookAt));
    camera.updateProjectionMatrix();
  }
  const nearestPocket = (q: Vec2) => {
    let best = table.pockets[0]!, d = Infinity;
    for (const p of table.pockets) { const e = Math.hypot(q.x - p.captureCentre.x, q.y - p.captureCentre.y); if (e < d) { d = e; best = p; } }
    return best;
  };
  let frameReq = 0;
  const baseColour = new WeakMap<THREE.Mesh, THREE.Color>();
  /** Darken a ball's colour by factor f (1 = its own colour). */
  const shade = (m: THREE.Mesh, f: number) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!baseColour.has(m)) baseColour.set(m, mat.color.clone());
    mat.color.copy(baseColour.get(m)!).multiplyScalar(f);
  };
  let vt = 0, lastReal = performance.now() / 1000, speed = 1;
  let current: (Vec2 | null)[] = [];
  function draw(positions: (Vec2 | null)[]) {
    current = positions;
    // the view clock runs at the playback speed (slow motion / pause in the dev pocket check freeze the fall too)
    const real = performance.now() / 1000;
    vt += Math.min(0.1, Math.max(0, real - lastReal)) * speed;
    lastReal = real;
    const now = vt;
    const dt = Math.max(1 / 240, now - lastAt);
    let falling = false;
    positions.forEach((q, i) => {
      const m = balls[i];
      if (!m) return;
      const was = last[i];
      if (q) {
        shade(m, 1);
        if (was && (Math.abs(q.x - was.x) > 1e-7 || Math.abs(q.y - was.y) > 1e-7)) {
          const span = Math.max(1 / 240, now - (movedAt[i] ?? now - dt));
          moveVel[i] = { x: (q.x - was.x) / span, y: (q.y - was.y) / span };
          movedAt[i] = now;
        } else if (!was) { moveVel[i] = null; movedAt[i] = now; }
        drops[i] = null;
        m.visible = true;
        m.position.set(q.x, q.y, r * ballScale);
      } else if (was && !drops[i] && G.dropSeconds > 0) {
        // the physics has just dropped this ball: it keeps its speed towards the pocket for a moment and sinks
        // (its speed: from the last two DIFFERENT positions; playback holds the last position for a frame before a drop)
        const pk = nearestPocket(was);
        drops[i] = { from: was, vel: moveVel[i] ?? { x: 0, y: 0 }, to: pk.captureCentre, t0: now, realT0: real * 1000 };
      }
      const d = drops[i];
      if (!q && d) {
        const t = now - d.t0;
        const z = r * ballScale - 0.5 * DROP_GRAVITY * t * t; // the drop sound comes when z = 0 (playback.ts dropSeenAt)
        if (t > G.dropSeconds || z < -pit + r * ballScale * 0.3) { drops[i] = null; m.visible = false; return; }
        // horizontal: on along its own path, pulled towards the pocket centre (never further than the centre)
        const k = Math.min(1, t / G.dropSeconds);
        const ax = d.from.x + d.vel.x * t * (1 - k), ay = d.from.y + d.vel.y * t * (1 - k);
        m.visible = true;
        m.position.set(ax + (d.to.x - ax) * k * k, ay + (d.to.y - ay) * k * k, z);
        // seen from above a sinking ball hardly changes, so it also goes dark as it sinks into the hole
        shade(m, Math.max(0.08, 1 - (r * ballScale - z) / G.dropDarkM));
        falling = true;
        // dev only (scripts/drop-sound-check.mjs): the first drawn frame with the ball's centre below the cloth
        if (import.meta.env.DEV && z <= 0 && !d.logged) {
          d.logged = true;
          ((window as unknown as { __dropLog?: { i: number; at: number; fallAt: number }[] }).__dropLog ??= [])
            .push({ i, at: performance.now(), fallAt: d.realT0 });
        }
      } else if (!q) m.visible = false;
    });
    prev = last.map((p, i) => (positions[i] ? p : null));
    last = positions.map((q) => (q ? { x: q.x, y: q.y } : null));
    lastAt = now;
    renderer.render(scene, camera);
    // a ball still falling after the caller stopped drawing: keep drawing until it is gone
    cancelAnimationFrame(frameReq);
    if (falling) frameReq = requestAnimationFrame(() => { if (current === positions) draw(positions); });
  }
  function dispose() {
    cancelAnimationFrame(frameReq);
    renderer.dispose();
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const m of [o.material].flat() as THREE.Material[]) { for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose(); m.dispose(); }
      }
    });
  }
  function setPreset(p: PresetId) { preset = p; resize(); }
  function setBallScale(s: number) { ballScale = s; for (const m of balls) { m.scale.setScalar(s); m.position.z = r * s; } }
  // ---- the cue (Part 4): made on first use; drawn by src/view/cue.ts (the same code as docs/cue-options.html) ----
  let cue: { mesh: THREE.Mesh; shadow: { cast: (tip: THREE.Vector3, axis: THREE.Vector3, alpha: number, len?: number) => void; hide: () => void }; plane: THREE.Plane } | null = null;
  const rsNow = () => r * ballScale;
  /** Hide the cue. */
  function hideCue() { if (cue) { cue.mesh.visible = false; cue.shadow.hide(); } }
  /** The cue for a shot from C in direction d: its axis (raised-butt rule) and its visible length (shortened when it
   *  would cover the protected things on screen: the object ball and the aimed pocket). Uses the layout and the
   *  planned direction only. */
  function planCue(C: Vec2, d: Vec2, others: Vec2[], protect: { p: Vec2; z: number; radius: number }[]) {
    const rs = rsNow();
    const { axis, el } = cueAxis(C, d, others, { hw: table.halfWidth, hl: table.halfLength, rs, ...heights });
    const px = (v3: THREE.Vector3) => { const q = v3.clone().project(camera); return { x: (q.x + 1) / 2 * canvas.clientWidth, y: (1 - q.y) / 2 * canvas.clientHeight }; };
    const size = (p3: THREE.Vector3, rad: number) => { const a = px(p3), b = px(p3.clone().add(new THREE.Vector3(rad, 0, 0))); return Math.hypot(a.x - b.x, a.y - b.y); };
    const centre = new THREE.Vector3(C.x, C.y, rs);
    let len = CUE.length;
    for (const t of protect) {
      const p3 = new THREE.Vector3(t.p.x, t.p.y, t.z), p = px(p3), rr = size(p3, t.radius);
      for (const gap of [CUE.pull, 0, -CUE.follow]) for (let s = 0; s <= len; s += 0.02) {
        const q3 = centre.clone().addScaledVector(axis as THREE.Vector3, rs + gap + s), q = px(q3);
        if (Math.hypot(q.x - p.x, q.y - p.y) < rr + size(q3, radiusAt('new', s)) + 2) { len = Math.max(0.12, s - 0.04); break; }
      }
    }
    return { axis: axis as THREE.Vector3, el, len };
  }
  /** Draw the cue at rest `gap` behind the cue ball (negative = past the hit), with opacity alpha and visible length. */
  function showCue(C: Vec2, plan: { axis: THREE.Vector3; len: number }, gap: number, alpha: number) {
    if (!cue) {
      const mesh = makeNewCue(scene, renderer) as THREE.Mesh;
      const plane = new THREE.Plane();
      (mesh.material as THREE.Material).clippingPlanes = [plane];
      renderer.localClippingEnabled = true;
      cue = { mesh, plane, shadow: createCueShadow(scene, { hw: table.halfWidth, hl: table.halfLength, rim: G.rim, railZ: heights.railZ }) };
    }
    if (alpha <= 0.003) { hideCue(); return; }
    if (!cue) return;
    const tip = placeCue(cue.mesh, C, rsNow(), plan.axis, gap, alpha) as THREE.Vector3;
    // keep only the part of the cue from the tip up to `len` (plane: axis . p <= axis . tip + len)
    cue.plane.set(plan.axis.clone().negate(), plan.axis.dot(tip) + plan.len);
    cue.shadow.cast(tip, plan.axis, alpha, plan.len);
  }
  /** Playback speed of the view clock (1 = real time, 0 = frozen); only the falling of potted balls uses it. */
  function setSpeed(x: number) { speed = x; }
  /** Where a table point appears on the canvas (CSS px from its top-left); for dev screenshots. */
  function project(x: number, y: number, z = 0) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight };
  }
  return { resize, draw, dispose, setPreset, setBallScale, setKinds, setSpeed, setCameraOverride, project, planCue, showCue, hideCue, look, getFit: () => fit };
}
