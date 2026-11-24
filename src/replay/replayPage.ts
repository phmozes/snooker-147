// Task 2.1 check page: one recorded shot shown at the same moment in the 2D top view and the 3D view.
// The shot is simulated once (core physics, config friction), then both views read positions from the recording.

import { CONFIG } from '../config/game.config';
import { createSim, recordShot, strike, type Recording } from '../core/physics/sim';
import { breakOffShot, potRedShot, type ShotSetup } from '../core/physics/testShots';
import { buildTable } from '../core/table/geometry';
import type { BallKind } from '../core/types';
import type { PresetId } from '../view/camera';
import { positionsAt } from '../view/playback';
import { createTable2d } from '../view/table2d';
import { createTable3d } from '../view/table3d';

const table = buildTable();
const SHOTS: { label: string; make: () => ShotSetup }[] = [
  { label: 'Break-off 6 reds', make: () => breakOffShot(table, 6) },
  { label: 'Break-off 15 reds', make: () => breakOffShot(table, 15) },
  { label: 'Pot a red', make: () => potRedShot(table) },
];

interface Loaded { rec: Recording; kinds: BallKind[]; end: number }
const cache = new Map<number, Loaded>();
function load(i: number): Loaded {
  let l = cache.get(i);
  if (!l) {
    const s = SHOTS[i]!.make();
    const sim = createSim(s.balls, table);
    strike(sim, 'cue', s.dir, s.speed, s.spin);
    const rec = recordShot(sim);
    l = { rec, kinds: s.balls.map((b) => b.kind), end: (rec.frames.length - 1) * rec.frameDt };
    cache.set(i, l);
  }
  return l;
}

const c2d = document.getElementById('c2d') as HTMLCanvasElement;
const c3d = document.getElementById('c3d') as HTMLCanvasElement;
const view2d = createTable2d(c2d, table);
// Optional start from the address, e.g. replay.html?shot=2&t=0.8 (shot number from 0, time in seconds)
const params = new URLSearchParams(location.search);
let current = Math.min(SHOTS.length - 1, Math.max(0, Number(params.get('shot') ?? 0) || 0));
let shot = load(current);
let preset: PresetId = params.get('cam') as PresetId in CONFIG.camera.presets ? params.get('cam') as PresetId : CONFIG.camera.main;
let ballScale: number = Number(params.get('scale')) || CONFIG.view3d.ballScale; // drawn size only (3D view)
let view3d = createTable3d(c3d, table, shot.kinds);
view3d.setPreset(preset);
view3d.setBallScale(ballScale);
let t = Math.min(shot.end, Math.max(0, Number(params.get('t') ?? 0) || 0)); // playback time, seconds into the shot
let playing = false;
let slow = false;
let last = 0;

// Both views are drawn in the same call from the same positions, so they can never drift apart.
function render() {
  const pos = positionsAt(shot.rec, t);
  view2d.draw(shot.kinds, pos);
  view3d.draw(pos);
  const potted = shot.rec.events.filter((e) => e.type === 'pot' && e.t <= t + 1e-9).map((e) => e.a);
  const f = view3d.getFit();
  document.getElementById('status')!.textContent =
    `${t.toFixed(2)} / ${shot.end.toFixed(2)} s · friction ${CONFIG.physics.rollingFriction} · potted: ${potted.length ? potted.join(', ') : 'none'}` +
    ` · camera ${preset} (${CONFIG.camera.presets[preset].elevationDeg}°): at [${f.position.join(', ')}] looking at [${f.lookAt.join(', ')}]`;
}
function resize() { view2d.resize(); view3d.resize(); render(); }

function tick(now: number) {
  if (!playing) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  t = Math.min(shot.end, t + dt * CONFIG.shot.playbackTimeScale * (slow ? 0.25 : 1));
  render();
  if (t >= shot.end) { playing = false; return; }
  requestAnimationFrame(tick);
}
function play() {
  t = 0;
  if (!playing) { playing = true; last = performance.now(); requestAnimationFrame(tick); }
}

// ---- controls ----
const shotsBox = document.getElementById('shots')!;
function renderShotButtons() {
  shotsBox.innerHTML = '';
  SHOTS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = s.label;
    if (i === current) b.className = 'on';
    b.onclick = () => {
      if (i === current) return;
      playing = false;
      current = i;
      b.textContent = 'working...';
      setTimeout(() => { // let the label show while the shot is simulated
        shot = load(i);
        view3d.dispose();
        view3d = createTable3d(c3d, table, shot.kinds);
        view3d.setPreset(preset);
        view3d.setBallScale(ballScale);
        t = 0;
        renderShotButtons();
        resize();
      }, 20);
    };
    shotsBox.appendChild(b);
  });
}
const toggle = (id: string, get: () => boolean, set: (v: boolean) => void) => {
  const b = document.getElementById(id)!;
  b.onclick = () => { set(!get()); b.classList.toggle('on', get()); };
};
document.getElementById('play')!.onclick = play;
toggle('slow', () => slow, (v) => { slow = v; });

// ---- camera presets (header and phone top bar) ----
const presetIds = Object.keys(CONFIG.camera.presets) as PresetId[];
function cameraButtons(box: HTMLElement) {
  box.innerHTML = '';
  for (const id of presetIds) {
    const b = document.createElement('button');
    b.textContent = `Camera ${CONFIG.camera.presets[id].label}`;
    if (id === preset) b.className = 'on';
    b.onclick = () => { preset = id; view3d.setPreset(id); renderCameraButtons(); render(); };
    box.appendChild(b);
  }
}
function renderScaleButtons() {
  const box = document.getElementById('scales')!;
  box.innerHTML = '';
  for (const s of CONFIG.view3d.ballScaleOptions) {
    const b = document.createElement('button');
    b.textContent = `Balls ${s}x`;
    if (s === ballScale) b.className = 'on';
    b.onclick = () => { ballScale = s; view3d.setBallScale(s); renderScaleButtons(); render(); };
    box.appendChild(b);
  }
}
function renderCameraButtons() {
  cameraButtons(document.getElementById('cams')!);
  const top = document.getElementById('phoneCams');
  if (top) cameraButtons(top);
}

// ---- "3D only": phone-shaped screen, 3D view in the table area, gray placeholders from CONFIG.layout ----
const L = CONFIG.layout;
const phone = document.getElementById('phone')!;
phone.style.setProperty('--aspect', String(L.phoneAspect));
const box3d = document.getElementById('box3d')!;
function ph(area: readonly [number, number], cls: string, html: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `ph ${cls}`;
  Object.assign(el.style, { top: `${area[0] * 100}%`, height: `${(area[1] - area[0]) * 100}%`,
    left: `${L.sidePad * 100}%`, right: `${L.sidePad * 100}%` });
  el.innerHTML = html;
  phone.appendChild(el);
  return el;
}
ph(L.topBar, 'top', '<span>BALANCE</span><span id="phoneCams"></span><button id="exit3d" title="back">≡ back</button>');
const tableArea = ph(L.table, 'tableArea', '');
ph(L.ladder, 'ladder', '<span></span><span></span><span></span><span></span><span></span>');
ph(L.cashOut, 'cash', 'CASH OUT');
ph(L.hint, 'hint', 'hint line');
ph(L.shoot, 'shoot', 'SHOOT = Play').onclick = play;
let only3d = false;
function setOnly3d(v: boolean) {
  only3d = v;
  document.body.classList.toggle('only3d', v);
  (v ? tableArea : box3d).appendChild(c3d); // the same 3D canvas moves into the phone's table area and back
  document.getElementById('layout')!.classList.toggle('on', v);
  resize();
}
document.getElementById('layout')!.onclick = () => setOnly3d(!only3d);
document.getElementById('exit3d')!.onclick = () => setOnly3d(false);

renderCameraButtons();
renderScaleButtons();
renderShotButtons();
window.addEventListener('resize', resize);
if (params.get('only3d') === '1') setOnly3d(true); else resize();
