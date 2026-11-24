// Gray-box 3D table (Three.js): flat green cloth, plain boxes for the cushions, black discs for the holes,
// plain spheres for the balls. Fixed main camera from config (camera.main). No textures, no polish (stage 2).
// World axes are the physics axes: x across the table, y along it (+y = top cushion), z up; units are metres.

import * as THREE from 'three';
import { CONFIG } from '../config/game.config';
import { arcPoints, type TableGeometry } from '../core/table/geometry';
import type { BallKind, Vec2 } from '../core/types';
import { BALL_COLOURS } from './playback';

const G = CONFIG.view3d;

export function createTable3d(canvas: HTMLCanvasElement, table: TableGeometry, kinds: BallKind[]) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(G.background);
  const cam = CONFIG.camera.main;
  const camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.05, 50);
  camera.up.set(0, 0, 1);
  camera.position.set(...cam.position);
  camera.lookAt(new THREE.Vector3(...cam.lookAt));

  scene.add(new THREE.AmbientLight(0xffffff, G.ambientLight));
  const sun = new THREE.DirectionalLight(0xffffff, G.topLight);
  sun.position.set(0, 0, 5);
  scene.add(sun);

  const hw = table.halfWidth;
  const hl = table.halfLength;
  const r = table.ballRadius;
  const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c });

  // wooden frame below the cloth, cloth on top (z = 0 is the cloth surface)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2 * (hw + G.rim), 2 * (hl + G.rim), 0.05), mat('#5b3a22'));
  frame.position.z = -0.026;
  scene.add(frame);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw, 2 * hl), mat('#1f7a4d'));
  cloth.position.z = 0;
  scene.add(cloth);
  // holes: black discs a hair above the cloth
  for (const p of table.pockets) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(p.captureRadius, 32), new THREE.MeshBasicMaterial({ color: '#050606' }));
    hole.position.set(p.captureCentre.x, p.captureCentre.y, 0.001);
    scene.add(hole);
  }
  // cushions, throat walls and jaws: plain boxes standing behind each face
  const cushionMat = mat('#2a6b45');
  const wall = (a: Vec2, b: Vec2, normal: Vec2) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const box = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dy), G.cushionDepth, G.cushionHeight), cushionMat);
    box.position.set((a.x + b.x) / 2 - (normal.x * G.cushionDepth) / 2, (a.y + b.y) / 2 - (normal.y * G.cushionDepth) / 2, G.cushionHeight / 2);
    box.rotation.z = Math.atan2(dy, dx);
    scene.add(box);
  };
  for (const s of [...table.cushions, ...table.throatWalls]) wall(s.a, s.b, s.normal);
  // rounded jaws: short straight pieces along the arc (the face is the outside of the arc)
  for (const j of table.jaws) {
    const pts = arcPoints(j, j.start, j.start + j.sweep, G.jawPieces);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const mid = { x: (a.x + b.x) / 2 - j.centre.x, y: (a.y + b.y) / 2 - j.centre.y };
      const l = Math.hypot(mid.x, mid.y);
      wall(a, b, { x: mid.x / l, y: mid.y / l });
    }
  }
  // balls
  const sphere = new THREE.SphereGeometry(r, 24, 16);
  const balls = kinds.map((k) => {
    const m = new THREE.Mesh(sphere, mat(BALL_COLOURS[k]));
    m.position.z = r;
    scene.add(m);
    return m;
  });

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a view narrower than fitAspect keeps the same width of table in view by widening the lens (camera stays put)
    camera.fov = camera.aspect >= G.fitAspect ? cam.fov
      : (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (G.fitAspect / camera.aspect)) * 180) / Math.PI;
    camera.updateProjectionMatrix();
  }
  function draw(positions: (Vec2 | null)[]) {
    positions.forEach((q, i) => {
      const m = balls[i]!;
      m.visible = q !== null;
      if (q) m.position.set(q.x, q.y, r);
    });
    renderer.render(scene, camera);
  }
  function dispose() {
    renderer.dispose();
    scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  }
  return { resize, draw, dispose };
}
