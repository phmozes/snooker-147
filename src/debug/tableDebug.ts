// Development-only 2D view of the table geometry, racks and ball physics. Plain canvas, no Three.js.
// Click the table to strike the cue ball toward that point (power slider). Buttons: Break, Reset, Slow motion.
// Pocket test: roll one ball at a chosen pocket (angle, aim offset, speed) and a full "pot map".

import { CONFIG } from '../config/game.config';
import { checkSim, createSim, isMoving, stepSim, strike, type Sim } from '../core/physics/sim';
import { breakAim, pocketRollStart, runPocketRoll, type PocketRoll, type RollOutcome } from '../core/physics/testShots';
import { arcPoints, buildTable, type JawArc, type PocketId, type TableGeometry } from '../core/table/geometry';
import { checkRack, rackBalls } from '../core/table/rack';
import { dist, sub, type BallKind, type Vec2 } from '../core/types';

// Jaw radii can be changed on the page to compare shapes (the config keeps the chosen values).
const jawRadius = { corner: CONFIG.table.corner.jawRadius as number, middle: CONFIG.table.middle.jawRadius as number };
const makeTable = (): TableGeometry => buildTable({
  ...CONFIG.table,
  corner: { ...CONFIG.table.corner, jawRadius: jawRadius.corner },
  middle: { ...CONFIG.table.middle, jawRadius: jawRadius.middle },
});
let table = makeTable();
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

// ---- pocket test ----
const PT = CONFIG.dev.pocketTest;
const roll: PocketRoll = { pocket: 'topRight', angleDeg: 0, offset: 0, speed: PT.speed, distance: PT.distance };
let trail: Vec2[] = [];
let rollMode = false; // true while the current sim is a pocket-test roll
let lastOutcome: RollOutcome | null = null;
let potMap: { angles: number[]; offsets: number[]; cells: RollOutcome[][] } | null = null;
const OUTCOME_COLOURS: Record<RollOutcome, string> = {
  clean: '#27ae60', rattleIn: '#f2c94c', rattleOut: '#eb5757', missed: '#4f5b57', offTable: '#151c1a',
};
const OUTCOME_TEXT: Record<RollOutcome, string> = {
  clean: 'clean pot', rattleIn: 'rattled and dropped', rattleOut: 'rattled and came out', missed: 'missed the pocket',
  offTable: 'start is off the table',
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
  rollMode = false;
  trail = [];
}

function rollAtPocket() {
  const start = pocketRollStart(table, roll);
  state.view = roll.pocket;
  trail = [];
  lastOutcome = start ? null : 'offTable';
  if (!start) { sim = createSim([], table); shot = freshShot(); return; }
  sim = createSim([{ id: 'red1', kind: 'red', pos: start.pos }], table);
  rollMode = true;
  strike(sim, 'red1', start.dir, roll.speed);
  shot = { ...freshShot(), running: true, start: sim.time, startSpeed: roll.speed };
  speedsBefore = [roll.speed];
  trail.push({ ...start.pos });
}

function buildPotMap() {
  const angles: number[] = [];
  const offsets: number[] = [];
  for (let a = PT.angleMaxDeg; a >= -PT.angleMaxDeg; a -= PT.mapAngleStepDeg) angles.push(a);
  for (let o = -PT.offsetMaxMm; o <= PT.offsetMaxMm; o += PT.mapOffsetStepMm) offsets.push(o);
  const cells = angles.map((a) => offsets.map((o) =>
    runPocketRoll(table, { ...roll, angleDeg: a, offset: o / 1000 }).outcome));
  potMap = { angles, offsets, cells };
}

function shoot(direction: Vec2, speed: number) {
  if (isMoving(sim)) return;
  const cue = sim.balls.find((b) => b.kind === 'cue');
  if (!cue) return;
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
  rollMode = false;
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
  if (rollMode) {
    const b = sim.balls[0]!;
    if (!b.potted) trail.push({ ...b.pos });
  }
  if (shot.running && !isMoving(sim)) {
    shot.running = false;
    shot.settledAfter = sim.time - shot.start;
    if (rollMode) {
      const jaws = sim.events.filter((e) => e.type === 'jaw').length;
      lastOutcome = sim.balls[0]!.potted ? (jaws ? 'rattleIn' : 'clean') : jaws ? 'rattleOut' : 'missed';
    }
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
    w = h = 0.5;
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
  const rim = 0.26; // wide enough to hold the middle-pocket throats
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // wood, cloth
  poly([{ x: -hw - rim, y: -hl - rim }, { x: hw + rim, y: -hl - rim }, { x: hw + rim, y: hl + rim }, { x: -hw - rim, y: hl + rim }], '#5b3a22');
  poly([{ x: -hw, y: -hl }, { x: hw, y: -hl }, { x: hw, y: hl }, { x: -hw, y: hl }], '#1f7a4d');

  // pockets: wood behind the corner, cloth between the rounded jaws, then the throat: a strip of slate
  // (lighter, the "shelf" before the fall) and the slate cut where the ball drops (dark)
  for (const p of table.pockets) {
    const [j1, j2] = jawsOf(p.id);
    if (p.kind === 'corner') {
      poly([j1.tangentPoint, { x: Math.sign(p.inward.x) * hw, y: Math.sign(p.inward.y) * hl }, j2.tangentPoint], '#5b3a22');
    }
    poly([...arcPoints(j1, j1.start, j1.start + j1.sweep), ...arcPoints(j2, j2.start + j2.sweep, j2.start)], '#1f7a4d');
    const [w1, w2] = p.throat;
    poly([w1.a, w1.b, w2.b, w2.a], '#1f7a4d'); // cloth on the slate between the jaws, up to the fall
    // the hole = the part of the slate cut that is not under a jaw: clip to the mouth + the throat, the throat
    // continued to the back of the slate cut, so the hole shows its rounded front AND back
    const c0 = sub(p.captureCentre, p.mouthMid);
    const back = c0.x * p.inward.x + c0.y * p.inward.y + p.captureRadius + 0.01;
    const far1 = { x: w1.a.x + p.inward.x * back, y: w1.a.y + p.inward.y * back };
    const far2 = { x: w2.a.x + p.inward.x * back, y: w2.a.y + p.inward.y * back };
    const open = [...arcPoints(j1, j1.start, j1.start + j1.sweep), far1, far2, ...arcPoints(j2, j2.start + j2.sweep, j2.start)];
    ctx.save();
    ctx.beginPath();
    open.forEach((q, i) => (i ? ctx.lineTo(sx(q), sy(q)) : ctx.moveTo(sx(q), sy(q))));
    ctx.closePath();
    ctx.clip();
    circle(p.captureCentre, p.captureRadius, '#060808');
    ctx.restore();
    // the whole slate cut (dashed): the part outside the throat lies under the cushions (the overhang)
    if (state.capture) circle(p.captureCentre, p.captureRadius, null, '#56ccf2', true);
    if (state.view !== 'table') line(p.mouthA, p.mouthB, 'rgba(255,255,255,0.6)', 1); // the mouth width
  }

  // zoomed pocket view: a ball drawn to scale in the mouth (dashed) and a 10 cm ruler in the corner of the view
  if (state.view !== 'table') {
    const p = table.pockets.find((q) => q.id === state.view)!;
    circle(p.mouthMid, table.ballRadius, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.8)', true);
    const x0 = px(16);
    const y0 = canvas.height - px(16);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x0 - px(6), y0 - px(36), 0.1 * scale + px(12), px(42));
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + 0.1 * scale, y0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = px(2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `${px(12)}px system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText('10 cm', x0, y0 - px(8));
    ctx.fillText('dashed ball in the mouth = real size', x0, y0 - px(22));
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
  for (const s of table.throatWalls) line(s.a, s.b, '#f2994a', 2.5);

  // spots
  for (const p of Object.values(table.spots)) {
    const d = 0.008;
    line({ x: p.x - d, y: p.y }, { x: p.x + d, y: p.y }, 'rgba(255,255,255,0.7)', 1);
    line({ x: p.x, y: p.y - d }, { x: p.x, y: p.y + d }, 'rgba(255,255,255,0.7)', 1);
  }

  // aim line while everything is still, then the balls (potted balls are not drawn)
  const cue = sim.balls.find((b) => b.kind === 'cue');
  if (cue && mouse && !isMoving(sim) && state.view === 'table') {
    ctx.setLineDash([px(6), px(6)]);
    line(cue.potted ? cueStart() : cue.pos, mouse, 'rgba(255,255,255,0.55)', 1);
    ctx.setLineDash([]);
  }
  // pocket test: path of the rolled ball and the points where it touched a jaw
  if (rollMode || trail.length) {
    for (let i = 1; i < trail.length; i++) line(trail[i - 1]!, trail[i]!, 'rgba(255,255,255,0.8)', 1.5);
    for (const e of sim.events) if (e.type === 'jaw') circle(e.contact, 0.004, '#eb5757');
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
  const lines = rollMode || lastOutcome ? [
    `<b>Pocket test</b>`,
    lastOutcome ? `Result: <b style="color:${OUTCOME_COLOURS[lastOutcome]}">${OUTCOME_TEXT[lastOutcome]}</b>` : status,
    `Jaw contacts: ${sim.events.filter((e) => e.type === 'jaw').length}` +
      (sim.events.some((e) => e.type === 'jaw') ? `  (speed into the jaw: ${sim.events.filter((e) => e.type === 'jaw').map((e) => (e as { speed: number }).speed.toFixed(2)).join(', ')} m/s)` : ''),
    `Overlaps ${shot.overlaps} ${okText(shot.overlaps === 0)} · inside a cushion ${shot.insideCushion} ${okText(shot.insideCushion === 0)} · free speed ${shot.freeSpeed} ${okText(shot.freeSpeed === 0)}`,
    ``,
  ] : [];
  lines.push(
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
    `Pocket       mouth     jaw radius  fall starts`,
  );
  for (const p of table.pockets) {
    const [j1] = jawsOf(p.id);
    const fall = p.kind === 'corner' ? `${mm(p.fallFront)} into the throat` : `${mm(p.fallFront - p.cushionLineDepth)} behind the cushion line`;
    lines.push(`${p.id.padEnd(12)} ${mm(dist(p.mouthA, p.mouthB))}  ${mm(j1.radius)}    ${fall}`);
  }
  lines.push(`Effective width extra (config mouthExtra): ${mm(CONFIG.table.mouthExtra)}`);
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
    label: `${l.reds} reds`, on: () => state.reds === l.reds, click: () => { state.reds = l.reds; reset(); lastOutcome = null; },
  }))),
  buttons('shots', [
    { label: 'Break', on: () => false, click: () => { lastOutcome = null; breakOff(); state.view = 'table'; } },
    { label: 'Reset', on: () => false, click: () => { lastOutcome = null; reset(); } },
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
renderers.push(buttons('ptPockets', table.pockets.map((p) => ({
  label: p.id, on: () => roll.pocket === p.id, click: () => { roll.pocket = p.id; state.view = p.id; potMap = null; },
}))));
renderers.push(buttons('ptActions', [
  { label: 'Roll', on: () => false, click: rollAtPocket },
  { label: 'Pot map', on: () => false, click: buildPotMap },
]));
function renderAll() { renderers.forEach((r) => r()); draw(); drawPotMap(); }

// ---- pocket-test sliders and the pot map ----
function makeSlider(id: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void,
  text: (v: number) => string, marks: number[] = []) {
  const el = document.getElementById(id) as HTMLInputElement;
  const out = document.getElementById(`${id}Text`)!;
  Object.assign(el, { min: String(min), max: String(max), step: String(step) });
  if (marks.length) {
    const list = document.createElement('datalist');
    list.id = `${id}Marks`;
    list.innerHTML = marks.map((m) => `<option value="${m}"></option>`).join('');
    el.after(list);
    el.setAttribute('list', list.id);
  }
  el.value = String(get());
  const show = () => { out.textContent = text(get()); };
  el.oninput = () => { set(Number(el.value)); show(); };
  show();
}
makeSlider('ptAngle', -PT.angleMaxDeg, PT.angleMaxDeg, 1, () => roll.angleDeg, (v) => { roll.angleDeg = v; }, (v) => `${v}°`);
makeSlider('ptOffset', -PT.offsetMaxMm, PT.offsetMaxMm, 1, () => Math.round(roll.offset * 1000), (v) => { roll.offset = v / 1000; }, (v) => `${v} mm`);
makeSlider('ptSpeed', 0.3, 6, 0.1, () => roll.speed, (v) => { roll.speed = v; potMap = null; drawPotMap(); }, (v) => `${v.toFixed(1)} m/s`);
const rebuildTable = () => { table = makeTable(); potMap = null; reset(); renderAll(); };
const mm0 = (m: number) => `${Math.round(m * 1000)} mm`;
const marks = (m: readonly number[]) => m.map((x) => Math.round(x * 1000));
makeSlider('jawCorner', 20, 200, 1, () => Math.round(jawRadius.corner * 1000), (v) => { jawRadius.corner = v / 1000; rebuildTable(); },
  (v) => `${v} mm (approved ${mm0(CONFIG.table.corner.jawRadius)}; marks: ${marks(PT.cornerJawMarks).join(', ')})`,
  marks(PT.cornerJawMarks));
makeSlider('jawMiddle', 20, 200, 1, () => Math.round(jawRadius.middle * 1000), (v) => { jawRadius.middle = v / 1000; rebuildTable(); },
  (v) => `${v} mm (config ${mm0(CONFIG.table.middle.jawRadius)}; marks: ${marks(PT.middleJawMarks).join(', ')})`,
  marks(PT.middleJawMarks));

const mapCanvas = document.getElementById('potmap') as HTMLCanvasElement;
const mapCtx = mapCanvas.getContext('2d')!;
function drawPotMap() {
  const box = document.getElementById('potmapBox')!;
  box.style.display = potMap ? 'block' : 'none';
  if (!potMap) return;
  const { angles, offsets, cells } = potMap;
  const cw = 6;
  const ch = 8;
  mapCanvas.width = offsets.length * cw;
  mapCanvas.height = angles.length * ch;
  cells.forEach((row, i) => row.forEach((c, j) => {
    mapCtx.fillStyle = OUTCOME_COLOURS[c];
    mapCtx.fillRect(j * cw, i * ch, cw - 1, ch - 1);
  }));
  const count = (o: RollOutcome) => cells.flat().filter((c) => c === o).length;
  document.getElementById('potmapLegend')!.innerHTML = (['clean', 'rattleIn', 'rattleOut', 'missed'] as RollOutcome[])
    .map((o) => `<span style="color:${OUTCOME_COLOURS[o]}">■</span> ${OUTCOME_TEXT[o]} (${count(o)})`).join('<br>') +
    `<br>Across: aim offset ${offsets[0]} to ${offsets[offsets.length - 1]} mm. Down: angle ${angles[0]}° to ${angles[angles.length - 1]}°. Click a square to roll it.`;
}
mapCanvas.addEventListener('click', (e) => {
  if (!potMap) return;
  const rect = mapCanvas.getBoundingClientRect();
  const j = Math.floor(((e.clientX - rect.left) / rect.width) * potMap.offsets.length);
  const i = Math.floor(((e.clientY - rect.top) / rect.height) * potMap.angles.length);
  roll.angleDeg = potMap.angles[i]!;
  roll.offset = potMap.offsets[j]! / 1000;
  (document.getElementById('ptAngle') as HTMLInputElement).value = String(roll.angleDeg);
  (document.getElementById('ptOffset') as HTMLInputElement).value = String(potMap.offsets[j]);
  document.getElementById('ptAngleText')!.textContent = `${roll.angleDeg}°`;
  document.getElementById('ptOffsetText')!.textContent = `${potMap.offsets[j]} mm`;
  rollAtPocket();
  renderAll();
});

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
  if (state.view !== 'table' || isMoving(sim)) return;
  if (rollMode || !sim.balls.some((b) => b.kind === 'cue')) { reset(); lastOutcome = null; } // back from a pocket test
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
