// Development-only 2D view of the table geometry, racks and ball physics. Plain canvas, no Three.js.
// Click the table to strike the cue ball toward that point (power slider). Buttons: Break, Reset, Slow motion.

import { CONFIG } from '../config/game.config';
import { checkSim, createSim, isMoving, stepSim, strike, type Sim } from '../core/physics/sim';
import { breakAim } from '../core/physics/testShots';
import { arcPoints, buildTable, type JawArc, type PocketId } from '../core/table/geometry';
import { checkRack, rackBalls } from '../core/table/rack';
import { dist, sub, type BallKind, type Vec2 } from '../core/types';

const table = buildTable();
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const BALL_COLOURS: Record<BallKind, string> = {
  cue: '#f4f4ef', red: '#d7322f', yellow: '#f2c94c', green: '#1f9d55', brown: '#8b5a2b',
  blue: '#2f6fdb', pink: '#f29cb8', black: '#151515',
};

// Optional start settings from the address, e.g. debug.html?reds=15&view=topLeft
const params = new URLSearchParams(location.search);
const state = {
  reds: Number(params.get('reds') ?? 6),
  view: (params.get('view') ?? 'table') as 'table' | PocketId,
  capture: true,
  labels: true,
  power: CONFIG.dev.debugPowerDefault as number, // share of maxCueSpeed
  slow: false, // play at 1/4 speed
};

// ---- physics state for the interactive shots ----
let sim: Sim = createSim(rackBalls(state.reds, table), table);
let mouse: Vec2 | null = null;
const freshShot = () => ({ running: false, start: 0, settledAfter: null as number | null,
  overlaps: 0, insideCushion: 0, freeSpeed: 0, startSpeed: 0 });
let shot = freshShot();
let speedsBefore: number[] = [];
const speedOf = (v: Vec2) => Math.hypot(v.x, v.y);
const cueStart = (): Vec2 => ({ x: CONFIG.rack.cueStart[0], y: CONFIG.rack.cueStart[1] });

function reset() {
  sim = createSim(rackBalls(state.reds, table), table);
  shot = freshShot();
}

function shoot(direction: Vec2, speed: number) {
  if (isMoving(sim)) return;
  const cue = sim.balls.find((b) => b.kind === 'cue')!;
  if (cue.potted) {
    // cue ball was potted: put it back on its starting place in the D (if that place is free)
    const free = sim.balls.every((b) => b === cue || b.potted || dist(b.pos, cueStart()) >= 2 * table.ballRadius);
    if (!free) return;
    cue.potted = null;
    cue.pos = cueStart();
  }
  strike(sim, 'cue', direction, speed);
  shot = { ...freshShot(), running: true, start: sim.time, startSpeed: speed };
  speedsBefore = sim.balls.map((b) => speedOf(b.vel));
}

function breakOff() {
  reset();
  shoot(breakAim(table, rackBalls(state.reds, table)), CONFIG.physics.maxCueSpeed);
}

/** Run the physics for a number of fixed steps, checking the owner's rules after every step. */
function advancePhysics(steps: number) {
  for (let n = 0; n < steps && isMoving(sim); n++) {
    stepSim(sim);
    const c = checkSim(sim);
    shot.overlaps += c.overlaps;
    shot.insideCushion += c.insideCushion;
    sim.balls.forEach((b, i) => {
      const v = speedOf(b.vel);
      if (v > (speedsBefore[i] ?? 0) + 1e-12 && !sim.hitLastStep.has(i)) shot.freeSpeed++;
      speedsBefore[i] = v;
    });
  }
  if (shot.running && !isMoving(sim)) {
    shot.running = false;
    shot.settledAfter = sim.time - shot.start;
  }
}

// Real-time playback: each screen frame runs as many fixed physics steps as real time has passed.
let lastFrame = 0;
let carry = 0;
function frame(now: number) {
  const elapsed = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  if (isMoving(sim)) {
    carry += elapsed * (state.slow ? 0.25 : 1);
    const steps = Math.floor(carry / CONFIG.physics.timestep);
    carry -= steps * CONFIG.physics.timestep;
    advancePhysics(steps);
    draw();
  } else carry = 0;
  requestAnimationFrame(frame);
}

const jawsOf = (id: PocketId) => table.jaws.filter((j) => j.pocket === id) as [JawArc, JawArc];
/** Angle of the narrowest point, written so it lies between start and start + sweep (for drawing). */
function narrowestAngle(j: JawArc): number {
  const a = Math.atan2(j.narrowestPoint.y - j.centre.y, j.narrowestPoint.x - j.centre.x);
  let d = (a - j.start) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return j.start + d;
}

// ---- world -> screen ----
let scale = 1;
let origin = { x: 0, y: 0 };
function setView() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  let centre: Vec2 = { x: 0, y: 0 };
  let w = (table.halfWidth + 0.12) * 2;
  let h = (table.halfLength + 0.12) * 2;
  if (state.view !== 'table') {
    const p = table.pockets.find((q) => q.id === state.view)!;
    centre = p.mouthMid;
    w = h = 0.3;
  }
  scale = Math.min(canvas.width / w, canvas.height / h);
  origin = { x: canvas.width / 2 - centre.x * scale, y: canvas.height / 2 + centre.y * scale };
}
const sx = (p: Vec2) => origin.x + p.x * scale;
const sy = (p: Vec2) => origin.y - p.y * scale;
const px = (n: number) => n * (window.devicePixelRatio || 1);

function poly(points: Vec2[], fill: string) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(sx(p), sy(p)) : ctx.moveTo(sx(p), sy(p))));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function line(a: Vec2, b: Vec2, colour: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(sx(a), sy(a));
  ctx.lineTo(sx(b), sy(b));
  ctx.strokeStyle = colour;
  ctx.lineWidth = px(width);
  ctx.stroke();
}
function circle(c: Vec2, r: number, fill: string | null, stroke?: string, dashed = false) {
  ctx.beginPath();
  ctx.arc(sx(c), sy(c), r * scale, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) {
    ctx.setLineDash(dashed ? [px(4), px(4)] : []);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = px(1.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function draw() {
  setView();
  const hw = table.halfWidth;
  const hl = table.halfLength;
  const rim = 0.17;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // wood, cloth
  poly([{ x: -hw - rim, y: -hl - rim }, { x: hw + rim, y: -hl - rim }, { x: hw + rim, y: hl + rim }, { x: -hw - rim, y: hl + rim }], '#5b3a22');
  poly([{ x: -hw, y: -hl }, { x: hw, y: -hl }, { x: hw, y: hl }, { x: -hw, y: hl }], '#1f7a4d');

  // pockets: wood behind the corner, cloth running into the mouth between the rounded jaws,
  // then the dark hole from the narrowest gap inward
  for (const p of table.pockets) {
    const [j1, j2] = jawsOf(p.id);
    const n1 = narrowestAngle(j1);
    const n2 = narrowestAngle(j2);
    if (p.kind === 'corner') {
      poly([j1.tangentPoint, { x: Math.sign(p.inward.x) * hw, y: Math.sign(p.inward.y) * hl }, j2.tangentPoint], '#5b3a22');
    }
    poly([...arcPoints(j1, j1.start, n1), ...arcPoints(j2, n2, j2.start)], '#1f7a4d');
    // hole: from the narrowest gap, along both jaws, wrapped round the far side of the capture circle
    const side = { x: -p.inward.y, y: p.inward.x };
    const s1 = Math.sign((j1.narrowestPoint.x - p.mouthMid.x) * side.x + (j1.narrowestPoint.y - p.mouthMid.y) * side.y);
    const R = p.captureRadius;
    const c = p.captureCentre;
    const far = [s1, 0.7 * s1, 0, -0.7 * s1, -s1].map((k) => {
      const back = Math.sqrt(Math.max(0, 1 - k * k));
      return { x: c.x + R * (side.x * k + p.inward.x * back), y: c.y + R * (side.y * k + p.inward.y * back) };
    });
    poly([...arcPoints(j1, n1, j1.start + j1.sweep), ...far, ...arcPoints(j2, j2.start + j2.sweep, n2)], '#060808');
    circle(p.captureCentre, p.captureRadius, '#060808');
    if (state.capture) circle(p.captureCentre, p.captureRadius, null, '#56ccf2', true);
    if (state.view !== 'table') line(p.mouthA, p.mouthB, 'rgba(255,255,255,0.6)', 1); // the mouth width
  }

  // baulk line and D
  line({ x: -hw, y: table.baulkY }, { x: hw, y: table.baulkY }, 'rgba(255,255,255,0.45)', 1);
  ctx.beginPath();
  ctx.arc(sx(table.dCentre), sy(table.dCentre), table.dRadius * scale, 0, Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = px(1);
  ctx.stroke();

  // straight cushions (cream) and rounded jaws (orange)
  for (const s of table.cushions) line(s.a, s.b, '#e8d9a8', 2.5);
  for (const j of table.jaws) {
    const pts = arcPoints(j, j.start, j.start + j.sweep, 48);
    for (let i = 1; i < pts.length; i++) line(pts[i - 1]!, pts[i]!, '#f2994a', 2.5);
  }

  // spots
  for (const p of Object.values(table.spots)) {
    const d = 0.008;
    line({ x: p.x - d, y: p.y }, { x: p.x + d, y: p.y }, 'rgba(255,255,255,0.7)', 1);
    line({ x: p.x, y: p.y - d }, { x: p.x, y: p.y + d }, 'rgba(255,255,255,0.7)', 1);
  }

  // aim line while everything is still, then the balls (potted balls are not drawn)
  const cue = sim.balls.find((b) => b.kind === 'cue')!;
  if (mouse && !isMoving(sim) && state.view === 'table') {
    ctx.setLineDash([px(6), px(6)]);
    line(cue.potted ? cueStart() : cue.pos, mouse, 'rgba(255,255,255,0.55)', 1);
    ctx.setLineDash([]);
  }
  for (const b of sim.balls) {
    if (!b.potted) circle(b.pos, table.ballRadius, BALL_COLOURS[b.kind], 'rgba(0,0,0,0.6)');
  }

  if (state.labels) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `${px(12)}px system-ui`;
    ctx.textAlign = 'center';
    for (const p of table.pockets) {
      const back = state.view === 'table' ? 0.16 : 0.07; // label on the cloth, in front of the pocket
      const at = { x: p.mouthMid.x - p.inward.x * back, y: p.mouthMid.y - p.inward.y * back };
      ctx.fillText(p.id, sx(at), sy(at));
    }
  }
  showInfo();
}

function showInfo() {
  const balls = rackBalls(state.reds, table);
  const c = checkRack(balls, table);
  const sc = checkSim(sim);
  const mm = (m: number) => `${(m * 1000).toFixed(1)} mm`;
  const okText = (ok: boolean) => (ok ? '<span class="ok">OK</span>' : '<span class="bad">PROBLEM</span>');
  const moving = sim.balls.filter((b) => !b.potted && (b.vel.x !== 0 || b.vel.y !== 0)).length;
  const fastest = Math.max(0, ...sim.balls.map((b) => speedOf(b.vel)));
  const potted = sim.balls.filter((b) => b.potted).map((b) => b.id);
  const status = shot.running
    ? `Rolling: ${moving} balls moving, ${(sim.time - shot.start).toFixed(2)} s`
    : shot.settledAfter !== null
      ? `All balls stopped after ${shot.settledAfter.toFixed(2)} s`
      : 'Click the table to shoot';
  const lines = [
    `<b>Shot</b>`,
    status,
    `Fastest ball now: ${fastest.toFixed(2)} m/s (hit at ${shot.startSpeed.toFixed(2)})`,
    `Overlapping balls:          ${shot.overlaps}  ${okText(shot.overlaps === 0)}`,
    `Ball inside a cushion:      ${shot.insideCushion}  ${okText(shot.insideCushion === 0)}`,
    `Speed gained without a hit: ${shot.freeSpeed}  ${okText(shot.freeSpeed === 0)}`,
    `(counted over the whole shot, checked every 1/${Math.round(1 / CONFIG.physics.timestep)} s)`,
    `Smallest gap now: ${sc.minGap === Infinity ? '-' : mm(sc.minGap)}`,
    `Potted: ${potted.length ? potted.join(', ') : 'none'}`,
    ``,
    `<b>Table</b>`,
    `Table  ${mm(CONFIG.table.length)} x ${mm(CONFIG.table.width)}`,
    `Ball   ${mm(table.ballRadius * 2)} diameter`,
    `Balls  ${balls.length} (cue + 6 colours + ${state.reds} reds)`,
    `Start rack: overlaps ${c.overlaps} ${okText(c.overlaps === 0)}, off the cloth ${c.outside} ${okText(c.outside === 0)}, cue in D ${okText(c.cueInD)}`,
    ``,
    `Pocket       mouth     jaw radius`,
  ];
  for (const p of table.pockets) {
    const [j1] = jawsOf(p.id);
    lines.push(`${p.id.padEnd(12)} ${mm(dist(p.mouthA, p.mouthB))}  ${mm(j1.radius)}`);
  }
  document.getElementById('info')!.innerHTML = lines.join('\n');
}

// ---- controls ----
function buttons(containerId: string, items: { label: string; on: () => boolean; click: () => void }[]) {
  const box = document.getElementById(containerId)!;
  const render = () => {
    box.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.textContent = it.label;
      if (it.on()) b.className = 'on';
      b.onclick = () => { it.click(); renderAll(); };
      box.appendChild(b);
    }
  };
  return render;
}
const renderers = [
  buttons('levels', CONFIG.levels.map((l) => ({
    label: `${l.reds} reds`, on: () => state.reds === l.reds, click: () => { state.reds = l.reds; reset(); },
  }))),
  buttons('shots', [
    { label: 'Break', on: () => false, click: breakOff },
    { label: 'Reset', on: () => false, click: reset },
    { label: 'Slow motion', on: () => state.slow, click: () => { state.slow = !state.slow; } },
  ]),
  buttons('views', [
    { label: 'Whole table', on: () => state.view === 'table', click: () => { state.view = 'table'; } },
    ...table.pockets.map((p) => ({ label: p.id, on: () => state.view === p.id, click: () => { state.view = p.id; } })),
  ]),
  buttons('toggles', [
    { label: 'Capture circles', on: () => state.capture, click: () => { state.capture = !state.capture; } },
    { label: 'Pocket names', on: () => state.labels, click: () => { state.labels = !state.labels; } },
  ]),
];
function renderAll() { renderers.forEach((r) => r()); draw(); }

// ---- mouse: aim and shoot ----
function toWorld(e: MouseEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const x = (e.clientX - rect.left) * dpr;
  const y = (e.clientY - rect.top) * dpr;
  return { x: (x - origin.x) / scale, y: (origin.y - y) / scale };
}
canvas.addEventListener('mousemove', (e) => { mouse = toWorld(e); if (!isMoving(sim)) draw(); });
canvas.addEventListener('mouseleave', () => { mouse = null; if (!isMoving(sim)) draw(); });
canvas.addEventListener('click', (e) => {
  if (state.view !== 'table') return;
  const cue = sim.balls.find((b) => b.kind === 'cue')!;
  const d = sub(toWorld(e), cue.potted ? cueStart() : cue.pos);
  if (Math.hypot(d.x, d.y) < 1e-6) return;
  shoot(d, state.power * CONFIG.physics.maxCueSpeed);
  draw();
});
const slider = document.getElementById('power') as HTMLInputElement;
const powerText = document.getElementById('powerText')!;
slider.value = String(Math.round(state.power * 100));
const showPower = () => {
  powerText.textContent = `${slider.value}% = ${(state.power * CONFIG.physics.maxCueSpeed).toFixed(1)} m/s`;
};
slider.oninput = () => { state.power = Number(slider.value) / 100; showPower(); };
showPower();

window.addEventListener('resize', draw);
renderAll();
requestAnimationFrame(frame);
