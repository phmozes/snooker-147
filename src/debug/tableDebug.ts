// Development-only 2D view of the table geometry and racks. Plain canvas, no Three.js.

import { CONFIG } from '../config/game.config';
import { buildTable, type PocketId } from '../core/table/geometry';
import { checkRack, rackBalls } from '../core/table/rack';
import { dist, type BallKind, type Vec2 } from '../core/types';

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
};

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
  const rim = 0.09;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // wood, cloth
  poly([{ x: -hw - rim, y: -hl - rim }, { x: hw + rim, y: -hl - rim }, { x: hw + rim, y: hl + rim }, { x: -hw - rim, y: hl + rim }], '#5b3a22');
  poly([{ x: -hw, y: -hl }, { x: hw, y: -hl }, { x: hw, y: hl }, { x: -hw, y: hl }], '#1f7a4d');

  // pockets: wood triangle behind corner mouths, then the dark throat between the jaws
  for (const p of table.pockets) {
    const [j1, j2] = table.segments.filter((s) => s.pocket === p.id);
    if (p.kind === 'corner') poly([p.mouthA, { x: Math.sign(p.inward.x) * hw, y: Math.sign(p.inward.y) * hl }, p.mouthB], '#5b3a22');
    poly([j1!.a, j1!.b, j2!.b, j2!.a], '#060808');
    circle(p.captureCentre, p.captureRadius, '#060808');
    if (state.capture) circle(p.captureCentre, p.captureRadius, null, '#56ccf2', true);
  }

  // baulk line and D
  line({ x: -hw, y: table.baulkY }, { x: hw, y: table.baulkY }, 'rgba(255,255,255,0.45)', 1);
  ctx.beginPath();
  ctx.arc(sx(table.dCentre), sy(table.dCentre), table.dRadius * scale, 0, Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = px(1);
  ctx.stroke();

  // cushions and jaws
  for (const s of table.segments) line(s.a, s.b, s.kind === 'jaw' ? '#f2994a' : '#e8d9a8', 2.5);

  // spots
  for (const p of Object.values(table.spots)) {
    const d = 0.008;
    line({ x: p.x - d, y: p.y }, { x: p.x + d, y: p.y }, 'rgba(255,255,255,0.7)', 1);
    line({ x: p.x, y: p.y - d }, { x: p.x, y: p.y + d }, 'rgba(255,255,255,0.7)', 1);
  }

  // balls
  for (const b of rackBalls(state.reds, table)) circle(b.pos, table.ballRadius, BALL_COLOURS[b.kind], 'rgba(0,0,0,0.6)');

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
  const mm = (m: number) => `${(m * 1000).toFixed(1)} mm`;
  const okText = (ok: boolean) => (ok ? '<span class="ok">OK</span>' : '<span class="bad">PROBLEM</span>');
  const lines = [
    `Table  ${mm(CONFIG.table.length)} x ${mm(CONFIG.table.width)}`,
    `Ball   ${mm(table.ballRadius * 2)} diameter`,
    `Balls  ${balls.length} (cue + 6 colours + ${state.reds} reds)`,
    ``,
    `Overlapping balls:  ${c.overlaps}  ${okText(c.overlaps === 0)}`,
    `Balls off the cloth: ${c.outside}  ${okText(c.outside === 0)}`,
    `Cue ball in the D:  ${c.cueInD ? 'yes' : 'no'}  ${okText(c.cueInD)}`,
    `Smallest gap between balls: ${mm(c.minGap)}`,
    ``,
    `Pocket   mouth -> inner end of jaws`,
  ];
  for (const p of table.pockets) {
    const [j1, j2] = table.segments.filter((s) => s.pocket === p.id);
    lines.push(`${p.id.padEnd(12)} ${mm(dist(p.mouthA, p.mouthB))} -> ${mm(dist(j1!.b, j2!.b))}`);
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
    label: `${l.reds} reds`, on: () => state.reds === l.reds, click: () => { state.reds = l.reds; },
  }))),
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
window.addEventListener('resize', draw);
renderAll();
