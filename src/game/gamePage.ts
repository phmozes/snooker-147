// Task 5.2: the portrait game page, connected to the round state machine (gray-box). START -> quick re-rack -> the
// opponent's break-off -> step 1 automatically -> SHOOT / CASH OUT before every shot -> end line in the ladder strip,
// balance counts up, bet area returns. RE-RACK as RULES D.4. Black is picked automatically (no colour buttons yet).
// The next shot is solved for both outcomes in a Web Worker while the player decides (presolve.ts), so SHOOT plays at
// once. The menu button opens the developer panel: live game or the static mockup screens D / A / C, compare, ball
// size, level, a seed field to replay a round, the last shot's length and compute time, check pages.
// Address options: ?screen=A|C|D&compare=1&size=375x667&scale=1.3&level=reds15&seed=reds6-12345

import { CONFIG } from '../config/game.config';
import { createSim, recordShot, strike } from '../core/physics/sim';
import { createPhysicsProvider, type BreakLibrary } from '../core/physicsProvider';
import { cashOut, newRound, nextOutcome, nextTarget, setBet, setLevel, shoot, start, type LevelId, type Round } from '../core/round';
import { newFrame, type FrameState } from '../core/rules';
import { shotCaps, type FallbackLogEntry } from '../core/solver';
import { buildTable } from '../core/table/geometry';
import { rackBalls } from '../core/table/rack';
import { COLOURS, type Ball, type Vec2 } from '../core/types';
import { positionsAt } from '../view/playback';
import { createTable3d } from '../view/table3d';
import { createPresolver, solvedProvider } from './presolve';
import { clearanceText, endLine, formatMoney as money, formatMult, hintText, parseRoundCode } from './roundView';

type ScreenId = 'D' | 'A' | 'C';
type Mode = 'live' | ScreenId;
interface Shot { dir: Vec2; speed: number; spin: number }
const S = CONFIG.dev.screens;
const params = new URLSearchParams(location.search);
const table = buildTable();
const $ = (id: string) => document.getElementById(id)!;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
/** A new round seed. The page (not the core) picks it; the core only ever uses the seed it is given. */
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

let ballScale: number = Number(params.get('scale')) || CONFIG.view3d.ballScale;
let mode: Mode = (['D', 'A', 'C'] as const).find((s) => s === params.get('screen')) ?? 'live';
let compare = params.get('compare') === '1';

// ---------------- round state ----------------
let round: Round = newRound(newSeed());
const startLevel = CONFIG.levels.find((l) => l.id === params.get('level'))?.id;
if (startLevel) round = setLevel(round, startLevel);
let pendingSeed: number | null = null; // developer menu: the next START uses this seed
const seedParam = parseRoundCode(params.get('seed') ?? '');
if (seedParam) { pendingSeed = seedParam.seed; if (seedParam.levelId) round = setLevel(round, seedParam.levelId); }
let seedText = '';
let busy: null | 'rerack' | 'break' | 'step1' | 'shot' | 'solving' = null;
let showBetArea = true; // after a round ends the bet area returns after ui.wonMessageSeconds
let shownBalance = round.balance;
let lastShot = '—';
const fallbacks: FallbackLogEntry[] = [];
const library: BreakLibrary = {};
const presolver = createPresolver((entries) => {
  fallbacks.push(...entries);
  for (const e of entries) console.info(`[fallback] ${e.roundCode} step ${e.step} ${e.target}: ${e.level} (${e.tried} shots)`);
});
const level = () => CONFIG.levels.find((l) => l.id === round.levelId)!;
const ladder = () => round.ladder;

// ---------------- 3D table: one mesh per ball of the full rack; balls off the table are hidden ----------------
const canvas = $('c3d') as HTMLCanvasElement;
let ids: string[] = [];
let view3d: ReturnType<typeof createTable3d> | null = null;
let rest: (Vec2 | null)[] = []; // what is drawn when nothing moves
function buildView(balls: Ball[]) {
  view3d?.dispose();
  ids = balls.map((b) => b.id);
  view3d = createTable3d(canvas, table, balls.map((b) => b.kind));
  view3d.setBallScale(ballScale);
}
const placed = (balls: Ball[]) => ids.map((id) => balls.find((b) => b.id === id)?.pos ?? null);
function showBalls(balls: Ball[]) { rest = placed(balls); draw3d(); }
const draw3d = () => { if (!view3d) return; view3d.resize(); view3d.draw(rest); };

/** Play a shot from `balls` on screen; resolves with its length in seconds when every ball has stopped. */
function playShot(balls: Ball[], s: Shot): Promise<number> {
  const sim = createSim(balls, table);
  strike(sim, 'cue', s.dir, s.speed, s.spin);
  const rec = recordShot(sim);
  const slot = rec.ids.map((id) => ids.indexOf(id));
  return new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(rec.duration, ((performance.now() - t0) / 1000) * CONFIG.shot.playbackTimeScale);
      const p = positionsAt(rec, t);
      rest = ids.map(() => null);
      slot.forEach((j, n) => { if (j >= 0) rest[j] = p[n]!; });
      draw3d();
      if (t < rec.duration) requestAnimationFrame(tick); else res(rec.duration);
    };
    tick();
  });
}

// ---------------- the game loop ----------------
async function loadLibrary(id: LevelId) {
  if (library[id]) return;
  const res = await fetch(`/${CONFIG.breakLibrary.files[id]}`);
  if (!res.ok) throw new Error(`no break-off library for ${id} (npm run breaks)`);
  library[id] = await res.json();
}

/** Start solving the next shot (both outcomes) while the player decides. */
function presolveNext() {
  if (round.phase !== 'decide') return;
  const { step, failure } = nextOutcome(round);
  presolver.request(round.frame!, nextTarget(round), failure, { roundCode: round.roundCode, step });
}

async function onStart() {
  if (busy || round.phase === 'decide') return;
  if (round.balance < round.bet) return;
  presolver.cancel();
  busy = 'rerack';
  showBetArea = false;
  render();
  try { await loadLibrary(round.levelId); } catch (e) { busy = null; showBetArea = true; lastShot = String(e); render(); return; }
  const seed = pendingSeed ?? newSeed();
  pendingSeed = null;
  let afterBreak: FrameState | null = null;
  const base = createPhysicsProvider(table, library);
  const provider = { ...base, breakAndStep1: (...a: Parameters<typeof base.breakAndStep1>) => {
    const x = base.breakAndStep1(...a);
    afterBreak = x.afterBreak;
    return x;
  } };
  round = start({ ...round, seed }, provider, table);
  shownBalance = round.balance;
  presolveNext(); // solving starts during the break-off animation
  // RULES B.1: the balls re-rack quickly, then the opponent breaks off (from the library), then step 1 plays itself
  const rack = newFrame(level().reds, table).balls;
  buildView(rack);
  showBalls(rack);
  render();
  await wait(CONFIG.ui.reRackSeconds * 1000);
  const brk = round.breakShot as { cueStart: Vec2; shot: Shot };
  busy = 'break';
  render();
  await playShot(rack.map((b) => (b.kind === 'cue' ? { ...b, pos: { ...brk.cueStart } } : b)), brk.shot);
  showBalls(afterBreak!.balls);
  busy = 'step1';
  render();
  const len = await playShot(afterBreak!.balls, round.history[0]!.shot as Shot);
  lastShot = `step 1: ${len.toFixed(2)} s long · from the break-off library (no solve)`;
  afterShot();
}

async function onShoot() {
  if (busy || round.phase !== 'decide') return;
  const { step, outcome } = nextOutcome(round);
  const target = nextTarget(round);
  const ctx = { roundCode: round.roundCode, step };
  const kind = outcome === 'success' ? 'success' : 'failure';
  busy = presolver.ready(kind) ? 'shot' : 'solving';
  render();
  const t0 = performance.now();
  const solved = await presolver.get(kind, ctx);
  const waited = performance.now() - t0;
  const before = round;
  round = shoot(round, solvedProvider(createPhysicsProvider(table, library), solved.planned, { target, outcome }), table);
  presolveNext(); // the shot after this one starts solving during this shot's animation
  busy = 'shot';
  render();
  const h = round.history[round.history.length - 1]!;
  const work = `solved in ${solved.ms.toFixed(0)} ms (${solved.planned.tried ?? '?'} of max ${shotCaps()[kind]} shots)` +
    (waited > 20 ? `, SHOOT waited ${waited.toFixed(0)} ms` : ', ready before SHOOT');
  if (h.outcome === 'reRack') {
    lastShot = `step ${step}: RE-RACK (no shot found) · ${work}`;
  } else {
    const len = await playShot(before.frame!.balls, h.shot as Shot);
    lastShot = `step ${step} (${h.outcome}): ${len.toFixed(2)} s long · ${work}`;
  }
  afterShot();
}

function onCashOut() {
  if (busy || round.phase !== 'decide') return;
  presolver.cancel(); // RULES B.5: the next shot is never shown
  round = cashOut(round);
  endRound();
}

/** After a shot has played: balls settle where the rules put them (a potted colour back on its spot). */
function afterShot() {
  busy = null;
  if (round.frame) showBalls(round.frame.balls);
  if (round.phase === 'over') endRound(); else render();
}

async function endRound() {
  busy = null;
  showBetArea = false;
  render();
  countUpBalance(round.balance);
  if (round.end?.type === 'clearance') await clearanceMessage();
  else await wait(CONFIG.ui.wonMessageSeconds * 1000);
  showBetArea = true;
  render();
}

/** RULES B.4: big message on the empty cloth, at most clearanceMessageMaxSeconds, tap to skip. */
function clearanceMessage(): Promise<void> {
  const el = $('message');
  el.innerHTML = `<div>${clearanceText(round)}</div><small>${endLine(round.end!, round.bet)}</small>`;
  el.classList.add('show');
  return new Promise((res) => {
    const done = () => { clearTimeout(timer); el.classList.remove('show'); el.onclick = null; res(); };
    const timer = setTimeout(done, CONFIG.messages.clearanceMessageMaxSeconds * 1000);
    el.onclick = done;
  });
}

function countUpBalance(to: number) {
  const from = shownBalance;
  if (to <= from) { shownBalance = to; renderBalance(); return; }
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / (CONFIG.ui.balanceCountUpSeconds * 1000));
    shownBalance = k < 1 ? from + (to - from) * k : to;
    renderBalance();
    if (k < 1) requestAnimationFrame(tick);
  };
  tick();
}

// ---------------- texts and buttons ----------------
const renderBalance = () => { $('balance').textContent = money(mode === 'live' ? shownBalance : CONFIG.money.startingBalance); };

function chipsHtml(step: number) {
  const L = ladder();
  const { previous, next } = CONFIG.ui.ladderStrip;
  const count = previous + 1 + next;
  const first = Math.max(1, Math.min(L.length - count + 1, step - previous));
  const chips = Array.from({ length: count }, (_, i) => first + i).map((k) => {
    const cls = k < step ? 'prev' : k === step ? 'current' : k === step + 1 ? 'next' : '';
    return `<div class="chip ${cls}">${formatMult(L[k - 1]!.multiplier)}</div>`;
  });
  return `<div class="step">STEP ${step}<br>/ ${L.length}</div>${chips.join('')}`;
}

function render() {
  if (mode !== 'live') { renderStatic(); renderDev(); return; }
  renderBalance();
  const inRound = round.phase === 'decide' || busy !== null;
  $('centre').innerHTML = inRound && round.step > 0 && round.phase === 'decide'
    ? `<span class="mult">${formatMult(ladder()[round.step - 1]!.multiplier)}</span>`
    : `<span class="pill">${level().label}</span>`;
  // the end line stays in the strip until the next START (RULES B.4)
  $('ladder').innerHTML = round.phase === 'over' && round.end && busy === null
    ? `<div class="endline ${round.end.type === 'failure' ? 'lost' : 'won'}">${endLine(round.end, round.bet)}</div>`
    : chipsHtml(round.step);

  const bottom = $('bottom');
  if (busy) {
    const what = { rerack: 'RE-RACK', break: 'OPPONENT BREAKS OFF', step1: 'STEP 1 · RED', shot: '', solving: 'THINKING…' }[busy];
    bottom.innerHTML = `<div class="hint">${what}</div><button class="big" disabled>SHOOT</button>`;
  } else if (round.phase === 'decide') {
    const amount = (cashOut(round).end as { amount: number }).amount; // exactly what CASH OUT pays
    bottom.innerHTML = `<button class="cash" id="bCash">CASH OUT<b>${money(amount)}</b></button>` +
      `<div class="hint">${hintText(round)}</div><button class="big" id="bShoot">SHOOT</button>`;
    $('bCash').onclick = onCashOut;
    $('bShoot').onclick = () => { void onShoot(); };
  } else if (!showBetArea) {
    bottom.innerHTML = `<div class="hint"></div><button class="big" disabled>START</button>`;
  } else {
    const bet = round.bet;
    const can = round.balance >= bet;
    bottom.innerHTML = `
      <div class="row"><button class="sq" id="bMinus">−</button><div class="bet">BET<b>${money(bet)}</b></div><button class="sq" id="bPlus">+</button></div>
      <div class="row">${CONFIG.money.quickBets.map((q) => `<button class="quick${q === bet ? ' on' : ''}" data-q="${q}">${q}</button>`).join('')}</div>
      <button class="big" id="bStart" ${can ? '' : 'disabled'}>${can ? `START · ${money(bet)}` : 'BALANCE TOO LOW'}</button>`;
    const setB = (b: number) => { round = setBet(round, b); render(); };
    $('bMinus').onclick = () => setB(round.bet - CONFIG.money.betStep);
    $('bPlus').onclick = () => setB(round.bet + CONFIG.money.betStep);
    bottom.querySelectorAll<HTMLButtonElement>('.quick').forEach((b) => { b.onclick = () => setB(Number(b.dataset.q)); });
    $('bStart').onclick = () => { void onStart(); };
  }
  renderDev();
}

// ---------------- static mockup screens (developer menu, as in task 2.2) ----------------
function staticBalls(id: ScreenId): Ball[] {
  if (id === 'D') return rackBalls(level().reds, table);
  const s = S[id];
  return [
    { id: 'cue', kind: 'cue', pos: { x: s.cue[0], y: s.cue[1] } },
    ...COLOURS.map((c) => ({ id: c, kind: c, pos: { ...table.spots[c] } })),
    ...s.reds.map(([x, y], i) => ({ id: `red${i + 1}`, kind: 'red' as const, pos: { x, y } })),
  ];
}
function renderStatic() {
  const id = mode as ScreenId;
  const step = S[id].step;
  const mult = (k: number) => ladder()[k - 1]!.multiplier;
  $('balance').textContent = money(CONFIG.money.startingBalance);
  $('centre').innerHTML = id === 'D' ? `<span class="pill">${level().label}</span>` : `<span class="mult">${formatMult(mult(step))}</span>`;
  $('ladder').innerHTML = chipsHtml(step);
  const hint = S[id].hint.replace('{next}', step < ladder().length ? mult(step + 1).toFixed(2) : '');
  const cashB = step > 0 ? `<button class="cash">CASH OUT<b>${money(CONFIG.money.defaultBet * mult(step))}</b></button>` : '';
  if (id === 'D') {
    $('bottom').innerHTML = `
      <div class="row"><button class="sq">−</button><div class="bet">BET<b>${money(CONFIG.money.defaultBet)}</b></div><button class="sq">+</button></div>
      <div class="row">${CONFIG.money.quickBets.map((q) => `<button class="quick${q === CONFIG.money.defaultBet ? ' on' : ''}">${q}</button>`).join('')}</div>
      <button class="big">START · ${money(CONFIG.money.defaultBet)}</button>`;
  } else if (id === 'A') {
    $('bottom').innerHTML = `${cashB}<div class="hint">${hint}</div><button class="big">SHOOT</button>`;
  } else {
    const colours = S.C.colourChoices.map((c) => `<button class="colour ${c}">${cap(c)}</button>`).join('');
    $('bottom').innerHTML = `${cashB}<div class="hint">${hint}</div><div class="row">${colours}</div>`;
  }
}
function setMode(m: Mode) {
  if (busy) return; // not while a shot is playing
  mode = m;
  if (m === 'live') {
    const balls = round.frame && round.phase !== 'betting' ? round.frame.balls : rackBalls(level().reds, table);
    buildView(newFrame(level().reds, table).balls);
    showBalls(balls);
  } else {
    const balls = staticBalls(m);
    buildView(balls);
    showBalls(balls);
  }
  render();
  layout();
}

// ---------------- size: the phone screen fills the window (portrait shape on a PC); compare = live + mockup ----------------
const DESIGN = { w: 390, h: 844 };
const sizeParam = /^(\d+)x(\d+)$/.exec(params.get('size') ?? '');
const forced = sizeParam ? { w: Number(sizeParam[1]), h: Number(sizeParam[2]) } : null;
/** The part of the screen the player can really see: the visual viewport minus the safe-area insets (notch, bars). */
function visibleArea() {
  const vv = window.visualViewport;
  const W = Math.min(vv ? vv.width : innerWidth, document.documentElement.clientWidth || innerWidth);
  const H = vv ? vv.height : innerHeight;
  const cs = getComputedStyle($('safe'));
  const px = (v: string) => parseFloat(v) || 0;
  const t = px(cs.paddingTop);
  const r = px(cs.paddingRight);
  const b = px(cs.paddingBottom);
  const l = px(cs.paddingLeft);
  return { x: l, y: t, w: Math.floor(W - l - r), h: Math.floor(H - t - b) };
}
function layout() {
  const screenEl = $('screen');
  const stage = $('stage');
  document.body.classList.toggle('compare', compare);
  const A = visibleArea();
  let scale = 1;
  let w: number;
  let h: number;
  if (compare) {
    [w, h] = [DESIGN.w, DESIGN.h];
    scale = Math.min(1, A.w / (2 * DESIGN.w + 16), A.h / DESIGN.h);
  } else if (forced) {
    [w, h] = [forced.w, forced.h];
    scale = Math.min(1, A.w / forced.w, A.h / forced.h);
  } else {
    // a phone (portrait window) uses the whole visible area; a wide window (PC) shows a phone-shaped screen
    const portrait = A.w / A.h < CONFIG.layout.portraitBelow;
    [w, h] = [portrait ? A.w : Math.min(A.w, Math.round(A.h * CONFIG.layout.phoneAspect)), A.h];
  }
  Object.assign(screenEl.style, { width: `${w}px`, height: `${h}px` });
  const stageW = (compare ? 2 * w + 16 : w) * scale;
  stage.style.transform = `translate(${A.x + Math.max(0, (A.w - stageW) / 2)}px, ${A.y}px) scale(${scale})`;
  const shown: ScreenId = mode !== 'live' ? mode : round.phase === 'decide' ? 'A' : 'D';
  ($('mockup') as HTMLImageElement).src = `/mockups/${shown}.png`;
  draw3d();
}

// ---------------- developer panel ----------------
function renderDev() {
  const dev = $('dev');
  if (!dev.classList.contains('open')) return; // rebuilt when opened
  const opt = (label: string, on: boolean, click: () => void, disabled = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (on) b.className = 'on';
    b.disabled = disabled;
    b.onclick = click;
    return b;
  };
  const locked = busy !== null || round.phase === 'decide';
  const code = round.roundCode || '—';
  dev.innerHTML = '<h3>DEVELOPER · SCREEN</h3><div class="opts" id="devScreens"></div>' +
    '<h3>ROUND</h3><div class="info" id="devRound"></div>' +
    '<div class="opts"><input id="devSeed" placeholder="seed or reds6-12345" /><button id="devUseSeed">Use</button></div>' +
    '<div class="opts" id="devRoundBtns"></div>' +
    '<h3>LAST SHOT</h3><div class="info" id="devShot"></div>' +
    '<h3>COMPARE WITH MOCKUP</h3><div class="opts" id="devCompare"></div><h3>BALL SIZE (DRAWN ONLY)</h3><div class="opts" id="devScale"></div>' +
    '<h3>LEVEL</h3><div class="opts" id="devLevel"></div><h3>CHECK PAGES</h3>' +
    '<a href="/replay.html">Replay check: 2D and 3D</a><a href="/debug.html">Table debug</a>';
  $('devScreens').appendChild(opt('Live game', mode === 'live', () => setMode('live'), busy !== null));
  for (const id of ['D', 'A', 'C'] as const) {
    $('devScreens').appendChild(opt(`${id}: ${{ D: 'start', A: 'shoot', C: 'colour' }[id]}`, mode === id, () => setMode(id), busy !== null));
  }
  $('devRound').innerHTML = `Round code: <b>${code}</b>${round.phase === 'decide' ? ` · step ${round.step}` : ''}<br>` +
    `${pendingSeed !== null ? `Next START uses seed <b>${pendingSeed}</b>` : 'Next START: new random seed'}<br>` +
    `Fallbacks this session: ${fallbacks.length}${fallbacks.length ? ' (details in the browser console)' : ''}`;
  const input = $('devSeed') as HTMLInputElement;
  input.value = seedText;
  input.oninput = () => { seedText = input.value; };
  $('devUseSeed').onclick = () => {
    const p = parseRoundCode(seedText);
    if (!p) { $('devRound').innerHTML += '<br><span class="bad">Not a seed or round code</span>'; return; }
    if (p.levelId && p.levelId !== round.levelId) { if (locked) return; changeLevel(p.levelId); }
    pendingSeed = p.seed;
    render();
  };
  ($('devUseSeed') as HTMLButtonElement).disabled = locked;
  if (round.roundCode) {
    $('devRoundBtns').appendChild(opt('Replay this round', false, () => { pendingSeed = round.seed; render(); }, locked));
  }
  $('devRoundBtns').appendChild(opt(`Balance back to ${CONFIG.money.startingBalance}`, false, () => {
    round = { ...round, balance: CONFIG.money.startingBalance };
    shownBalance = round.balance;
    render();
  }, locked));
  $('devShot').textContent = lastShot;
  for (const s of CONFIG.view3d.ballScaleOptions) {
    $('devScale').appendChild(opt(`${s}x`, ballScale === s, () => { ballScale = s; view3d?.setBallScale(s); render(); draw3d(); }));
  }
  for (const l of CONFIG.levels) {
    $('devLevel').appendChild(opt(`${l.reds} reds`, round.levelId === l.id, () => changeLevel(l.id), locked));
  }
  $('devCompare').appendChild(opt('Off', !compare, () => { compare = false; render(); layout(); }));
  $('devCompare').appendChild(opt('On', compare, () => { compare = true; render(); layout(); }));
}
function changeLevel(id: LevelId) {
  if (busy || round.phase === 'decide') return;
  round = { ...setLevel(round, id), phase: 'betting', frame: null, end: null, step: 0, roundCode: '', history: [] };
  const rack = rackBalls(level().reds, table);
  if (mode === 'live') { buildView(newFrame(level().reds, table).balls); showBalls(rack); } else setMode(mode);
  render();
}
$('menu').onclick = () => { $('dev').classList.toggle('open'); renderDev(); };

// ---------------- start ----------------
// for automatic checks in a browser (developer only): the round and what is drawn
(window as unknown as { __game: unknown }).__game = () => ({ round, drawn: rest, ids, busy });
if (mode === 'live') { const rack = newFrame(level().reds, table).balls; buildView(rack); showBalls(rack); } else setMode(mode);
render();
window.addEventListener('resize', layout);
// browser bars showing or hiding change the visible area without always firing a window resize
window.visualViewport?.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 100));
// no long-press menu, no text selection, no double-tap zoom, no pinch zoom (page is locked like an app)
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); });
document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS pinch
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// double-tap zoom is off through CSS touch-action (not by cancelling taps, so quick repeated taps on +/- still count)
layout();
