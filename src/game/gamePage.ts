// Task 2.2: the portrait game page from mockups A/C/D, gray-box, static. Buttons do nothing yet (game loop: later
// stages). The menu button opens a developer panel: screen D / A / C, the "compare" toggle (mockup next to the live
// screen at the same size, off by default) and links to the check pages.
// Address options (for checks): ?screen=A|C|D&compare=1&size=375x667&scale=1.3&level=reds15
// (size = pretend to be a phone of that size; scale = drawn ball size; level = reds6 | reds10 | reds15)

import { CONFIG } from '../config/game.config';
import { ladderForLevel } from '../core/ladder';
import { buildTable } from '../core/table/geometry';
import { rackBalls } from '../core/table/rack';
import { COLOURS, type Ball } from '../core/types';
import { createTable3d } from '../view/table3d';

type ScreenId = 'D' | 'A' | 'C';
const S = CONFIG.dev.screens;
const params = new URLSearchParams(location.search);
const table = buildTable();
type LevelId = (typeof CONFIG.levels)[number]['id'];
let levelId: LevelId = CONFIG.levels.find((l) => l.id === params.get('level'))?.id ?? S.level;
let level = CONFIG.levels.find((l) => l.id === levelId)!;
let ladder = ladderForLevel(levelId);
let ballScale: number = Number(params.get('scale')) || CONFIG.view3d.ballScale;
let screen: ScreenId = (['D', 'A', 'C'] as const).find((s) => s === params.get('screen')) ?? 'D';
let compare = params.get('compare') === '1';

const $ = (id: string) => document.getElementById(id)!;
const money = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: CONFIG.money.currencyDecimals,
  maximumFractionDigits: CONFIG.money.currencyDecimals });
const mult = (step: number) => ladder[step - 1]!.multiplier; // multiplier after `step` successful shots
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Balls for a screen: the start rack for D, the mockup positions for A and C (colours on their spots). */
function ballsFor(id: ScreenId): Ball[] {
  if (id === 'D') return rackBalls(level.reds, table);
  const s = S[id];
  return [
    { id: 'cue', kind: 'cue', pos: { x: s.cue[0], y: s.cue[1] } },
    ...COLOURS.map((c) => ({ id: c, kind: c, pos: { ...table.spots[c] } })),
    ...s.reds.map(([x, y], i) => ({ id: `red${i + 1}`, kind: 'red' as const, pos: { x, y } })),
  ];
}

// ---- 3D table (static positions; no text on the cloth) ----
const canvas = $('c3d') as HTMLCanvasElement;
let balls = ballsFor(screen);
let view3d = createTable3d(canvas, table, balls.map((b) => b.kind));
view3d.setBallScale(ballScale);
const draw3d = () => { view3d.resize(); view3d.draw(balls.map((b) => b.pos)); };

// ---- top bar, ladder strip, bottom area ----
function renderTexts() {
  const step = S[screen].step;
  $('balance').textContent = money(CONFIG.money.startingBalance);
  $('centre').innerHTML = screen === 'D'
    ? `<span class="pill">${level.label}</span>`
    : `<span class="mult">x${mult(step).toFixed(2)}</span>`;

  // ladder: `previous` steps before the current one and `next` after it (from step 1 before the first shot)
  const { previous, next } = CONFIG.ui.ladderStrip;
  const count = previous + 1 + next;
  const first = Math.max(1, Math.min(ladder.length - count + 1, step - previous));
  const chips = Array.from({ length: count }, (_, i) => first + i).map((k) => {
    const cls = k < step ? 'prev' : k === step ? 'current' : k === step + 1 ? 'next' : '';
    return `<div class="chip ${cls}">x${mult(k).toFixed(2)}</div>`;
  });
  $('ladder').innerHTML = `<div class="step">STEP ${step}<br>/ ${ladder.length}</div>${chips.join('')}`;

  const hint = S[screen].hint.replace('{next}', step < ladder.length ? mult(step + 1).toFixed(2) : '');
  const cash = step > 0 ? `<button class="cash">CASH OUT<b>${money(CONFIG.money.defaultBet * mult(step))}</b></button>` : '';
  if (screen === 'D') {
    $('bottom').innerHTML = `
      <div class="row"><button class="sq">−</button><div class="bet">BET<b>${money(CONFIG.money.defaultBet)}</b></div><button class="sq">+</button></div>
      <div class="row">${CONFIG.money.quickBets.map((q) => `<button class="quick${q === CONFIG.money.defaultBet ? ' on' : ''}">${q}</button>`).join('')}</div>
      <button class="big">START · ${money(CONFIG.money.defaultBet)}</button>`;
  } else if (screen === 'A') {
    $('bottom').innerHTML = `${cash}<div class="hint">${hint}</div><button class="big">SHOOT</button>`;
  } else {
    const colours = S.C.colourChoices.map((c) => `<button class="colour ${c}">${cap(c)}</button>`).join('');
    $('bottom').innerHTML = `${cash}<div class="hint">${hint}</div><div class="row">${colours}</div>`;
  }
}

// ---- size: the phone screen fills the window (portrait shape on a PC); compare = live + mockup at 390 x 844 ----
const DESIGN = { w: 390, h: 844 };
const sizeParam = /^(\d+)x(\d+)$/.exec(params.get('size') ?? '');
const forced = sizeParam ? { w: Number(sizeParam[1]), h: Number(sizeParam[2]) } : null;
function layout() {
  const screenEl = $('screen');
  const stage = $('stage');
  document.body.classList.toggle('compare', compare);
  let scale = 1;
  if (compare) {
    Object.assign(screenEl.style, { width: `${DESIGN.w}px`, height: `${DESIGN.h}px` });
    scale = Math.min(1, innerWidth / (2 * DESIGN.w + 16), innerHeight / DESIGN.h);
  } else if (forced) {
    Object.assign(screenEl.style, { width: `${forced.w}px`, height: `${forced.h}px` });
    scale = Math.min(1, innerWidth / forced.w, innerHeight / forced.h);
  } else {
    // a phone (portrait window) uses the full screen; a wide window (PC) shows a phone-shaped screen in the middle
    const portrait = innerWidth / innerHeight < CONFIG.layout.portraitBelow;
    const w = portrait ? innerWidth : Math.min(innerWidth, Math.round(innerHeight * CONFIG.layout.phoneAspect));
    Object.assign(screenEl.style, { width: `${w}px`, height: `${innerHeight}px` });
  }
  stage.style.transform = `translateX(-50%) scale(${scale})`;
  ($('mockup') as HTMLImageElement).src = `/mockups/${screen}.png`;
  draw3d();
}

// ---- developer panel ----
function renderDev() {
  const opt = (label: string, on: boolean, click: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (on) b.className = 'on';
    b.onclick = click;
    return b;
  };
  const dev = $('dev');
  dev.innerHTML = '<h3>DEVELOPER · SCREEN</h3><div class="opts" id="devScreens"></div><h3>COMPARE WITH MOCKUP</h3>' +
    '<div class="opts" id="devCompare"></div><h3>BALL SIZE (DRAWN ONLY)</h3><div class="opts" id="devScale"></div>' +
    '<h3>LEVEL</h3><div class="opts" id="devLevel"></div><h3>CHECK PAGES</h3>' +
    '<a href="/replay.html">Replay check: 2D and 3D</a><a href="/debug.html">Table debug</a>';
  for (const id of ['D', 'A', 'C'] as const) {
    $('devScreens').appendChild(opt(`${id}: ${{ D: 'start', A: 'shoot', C: 'colour' }[id]}`, screen === id, () => setScreen(id)));
  }
  for (const s of CONFIG.view3d.ballScaleOptions) {
    $('devScale').appendChild(opt(`${s}x`, ballScale === s, () => { ballScale = s; view3d.setBallScale(s); renderDev(); draw3d(); }));
  }
  for (const l of CONFIG.levels) {
    $('devLevel').appendChild(opt(`${l.reds} reds`, levelId === l.id, () => {
      levelId = l.id; level = l; ladder = ladderForLevel(l.id); setScreen(screen);
    }));
  }
  $('devCompare').appendChild(opt('Off', !compare, () => { compare = false; renderDev(); layout(); }));
  $('devCompare').appendChild(opt('On', compare, () => { compare = true; renderDev(); layout(); }));
}
function setScreen(id: ScreenId) {
  screen = id;
  balls = ballsFor(id);
  view3d.dispose();
  view3d = createTable3d(canvas, table, balls.map((b) => b.kind));
  view3d.setBallScale(ballScale);
  renderTexts();
  renderDev();
  layout();
}
$('menu').onclick = () => $('dev').classList.toggle('open');

renderTexts();
renderDev();
window.addEventListener('resize', layout);
layout();
