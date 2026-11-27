// Task 5.2: the portrait game page, connected to the round state machine (gray-box). START -> quick re-rack -> the
// opponent's break-off -> step 1 automatically -> SHOOT / CASH OUT before every shot -> end line in the ladder strip,
// balance counts up, bet area returns. RE-RACK as RULES D.4. Black is picked automatically (no colour buttons yet).
// The next shot is solved for both outcomes in a Web Worker while the player decides (presolve.ts), so SHOOT plays at
// once. The menu button opens the developer panel: live game or the static mockup screens D / A / C, compare, ball
// size, level, a seed field to replay a round, the last shot's length and compute time, check pages. In a dev build only
// (import.meta.env.DEV) it also has the test panel (task 5.3): force the next outcome, clearance, jump to a step, auto play.
// Address options: ?screen=A|C|D&compare=1&size=375x667&scale=1.3&level=reds15&seed=reds6-12345

import { CONFIG } from '../config/game.config';
import { createSim, recordShot, strike } from '../core/physics/sim';
import { createPhysicsProvider, type BreakLibrary } from '../core/physicsProvider';
import { cashOut, FORCED_OUTCOMES, newRound, nextOutcome, nextTarget, setBet, setLevel, shoot, shootForced, start, successEnd, outcomeDraw, RNG_VERSION_NEW, type RngVersion, type ForcedOutcome,
  type LevelId, type Round } from '../core/round';
import { newFrame, type FrameState } from '../core/rules';
import { ladderForLevel, rtpText } from '../core/ladder';
import { shotCaps, type FallbackLogEntry } from '../core/solver';
import { buildTable } from '../core/table/geometry';
import { rackBalls } from '../core/table/rack';
import { COLOURS, type Ball, type BallKind, type Colour, type Vec2 } from '../core/types';
import { positionsAt } from '../view/playback';
import { createTable3d, type TableLookId } from '../view/table3d';
import { pos411pOn, setPos411p, solverVersion } from '../core/solverMode';
import { cuePose, VARIANTS } from '../view/cue';
import { rateAt, startOf } from '../view/fastEnd';
import { isMuted, muteIcon, setMuted } from './sound';
import { costBody, COST_LINE_VERSION, stepCost } from './stepCost';
import { createPresolver, solvedProvider, type SolveRequest, type Solved } from './presolve';
import { clearanceText, endLine, FAILURE_TEXT, formatMoney as money, formatMult, hintText, parseRoundCode } from './roundView';
import { codeColour, colourSteps, roundCodeOf, type RoundCode } from '../core/roundCode';

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
let pendingRng: RngVersion = RNG_VERSION_NEW; // ...with this generator (a code without the v2 marker = v1, docs/FAIRNESS.md)
const seedParam = parseRoundCode(params.get('seed') ?? '');
if (seedParam) { pendingSeed = seedParam.seed; pendingRng = seedParam.rng; if (seedParam.levelId) round = setLevel(round, seedParam.levelId); }
let seedText = '';
// task 5.4: a round being replayed from its round code (the shots, colours and cash-out step come from the code)
let replay: RoundCode | null = null;
/** The colour the replayed code asks for on this round's next colour step (undefined: the automatic pick). */
const replayColour = (r: Round) => (replay && r.frame?.phase === 'colour' ? codeColour(replay, colourSteps(r).length) : undefined);
// ---- developer test panel (task 5.3). Only a dev build (import.meta.env.DEV) can set these; the real game never does.
let force: ForcedOutcome | null = null; // the NEXT shot's outcome, forced (then back to null)
let auto: null | { mode: 'round' | 'jump' | 'clearance'; to: number } = null; // play shots by itself
let jumpText = '';
const FORCE_TEXT: Record<ForcedOutcome, string> = { success: 'Success', plainMiss: 'Miss', jawRattle: 'Rattle', inOff: 'In-off',
  wrongBallFirst: 'Foul (wrong ball)', reRack: 'RE-RACK' };
/** The forced outcome of the next shot, if any (auto jump / clearance force success). Always null outside a dev build. */
const forcedNow = (): ForcedOutcome | null => (!import.meta.env.DEV ? null : auto && auto.mode !== 'round' ? 'success' : force);
let busy: null | 'rerack' | 'break' | 'step1' | 'shot' | 'solving' = null;
let showBetArea = true; // after a round ends the bet area returns after ui.wonMessageSeconds
let shownBalance = round.balance;
let lastShot = '—';
/** Dev only (owner 2026-11-25): solver cost of the last shot, to read on a real phone. */
let lastCost = '—';
/** Dev only: how the last outcome was decided (u from the seed vs p of the step). */
let lastDraw = '';
const drawText = (d: { u: number; p: number }, forcedWhat: string | null) =>
  `outcome from seed: u = ${d.u.toFixed(4)} vs p = ${d.p.toFixed(4)} → ${d.u < d.p ? 'hit' : 'miss'}` +
  (forcedWhat ? ` (not used: forced ${forcedWhat})` : '');
/** The last shot played, for "Mark this shot as weird" (task 4.7). */
let lastInfo: { code: string; step: number; type: string; target: string; outcome: string; length: number } | null = null;
const TYPE_TEXT: Record<string, string> = {
  plain: 'plain pot', packCannon: 'pot with cannon into the pack', softCannon: 'pot with soft cannon (planned)',
  cannon: 'pot with hard cannon (accidental)', long: 'long pot',
  cushionFirst: 'cushion-first', plant: 'plant', double: 'double', kiss: 'kiss', farPocket: 'far pocket', fluke: 'fluke',
  attempt: 'attempt that misses', softFoul: 'fallback: soft foul', tap: 'fallback: gentle tap', library: 'from the library',
};
// the weird-shot list: kept in this browser (localStorage) so a reload does not lose it
const WEIRD_KEY = 'snooker147.weird';
let weird: string[] = (() => { try { return JSON.parse(localStorage.getItem(WEIRD_KEY) ?? '[]') as string[]; } catch { return []; } })();
const saveWeird = () => { try { localStorage.setItem(WEIRD_KEY, JSON.stringify(weird)); } catch { /* private window: list lives until reload */ } };

// ---- the flag button (developer only, owner 2026-11-24): one tap marks the LAST shot played. The mark is sent to
// the dev server, which appends it to docs/WEIRD-SHOTS.md; the list in this browser is the backup. ----
let toastTimer = 0;
function toast(text: string) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1500);
}
const renderFlag = () => { $('flagCount').textContent = weird.length ? String(weird.length) : ''; };
async function markWeird() {
  const i = lastInfo;
  if (!i) { toast('no shot played yet'); return; }
  const line = `${i.code} step ${i.step} · ${i.target} ${i.outcome} · ${i.type} · ${i.length.toFixed(2)} s · solver ${solverVersion()}`;
  if (weird[weird.length - 1] === line) { toast('this shot is already marked'); return; }
  weird.push(line);
  saveWeird();
  renderFlag();
  let sent = false;
  try {
    const res = await fetch('/__dev/weird', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: i.code, step: i.step, ball: i.target, outcome: i.outcome, type: i.type,
        length: i.length.toFixed(2), level: i.code.split('-')[0], solver: solverVersion() }) });
    sent = res.ok;
  } catch { /* no dev server: kept on the phone */ }
  toast(sent ? `marked: step ${i.step} (${weird.length})` : `marked on the phone only (${weird.length})`);
}
// Task P.1 (dev only): one line per shot to the PC (bench/results/phone-cost.jsonl), to measure THINKING on the phone
let shootAvailableAt = 0; // when SHOOT last became pressable (performance.now)
let costSent = 0; let costFailed = 0; // shown in the developer panel next to the PC link
function sendCost(line: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  const body = costBody(line, navigator.userAgent, solverVersion());
  const post = () => fetch('/__dev/cost', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); });
  void post().catch(() => post()).then(() => { costSent++; }, () => { costFailed++; }); // one retry, then counted as failed
}
// PC link (2026-11-25): a dev server started before vite.config.ts existed has no /__dev/weird endpoint, so every mark
// stayed on the phone. The panel now says so, and "Send list to PC" sends every stored line (the PC skips duplicates).
let pcLink = 'PC link: checking…';
let weirdStatus = '';
async function checkPcLink() {
  let ok = false;
  try { const res = await fetch('/__dev/weird/ping'); ok = res.ok && (await res.text()) === 'ok'; } catch { /* no server */ }
  pcLink = ok ? 'PC link: OK' : 'PC link: NOT CONNECTED (restart the dev server on the PC)';
  renderDev();
}
async function sendWeirdList() {
  weirdStatus = 'sending…';
  renderDev();
  try {
    const res = await fetch('/__dev/weird/list', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: weird }) });
    if (!res.ok) throw new Error(String(res.status));
    const r = (await res.json()) as { added: number; known: number; unreadable: number };
    weirdStatus = `sent: ${r.added} new, ${r.known} already on the PC${r.unreadable ? `, ${r.unreadable} unreadable` : ''}`;
  } catch {
    weirdStatus = 'NOT sent (PC link down)';
  }
  toast(weirdStatus);
  renderDev();
}
if (import.meta.env.DEV) {
  void checkPcLink();
  $('flag').style.display = 'flex';
  $('flag').onclick = () => { void markWeird(); };
  $('devVer').textContent = `solver ${solverVersion()}`; // F.1: the version a video was recorded on
  $('devVer').style.display = 'block';
}
const fallbacks: FallbackLogEntry[] = [];
const library: BreakLibrary = {};
const presolver = createPresolver((entries) => {
  fallbacks.push(...entries);
  for (const e of entries) console.info(`[fallback] ${e.roundCode} step ${e.step} ${e.target}: ${e.level} (${e.tried} shots)`);
}, () => { if (!busy && round.phase === 'decide') render(); }, // the picked colour is known: show it in the hint
  undefined, (req, success) => presolveAhead(req, success)); // task P.2: then start the step after it
const level = () => CONFIG.levels.find((l) => l.id === round.levelId)!;
const ladder = () => round.ladder;

// ---------------- 3D table: one mesh per ball of the full rack; balls off the table are hidden ----------------
let canvas = $('c3d') as HTMLCanvasElement;
let ids: string[] = [];
let view3d: ReturnType<typeof createTable3d> | null = null;
let rest: (Vec2 | null)[] = []; // what is drawn when nothing moves
// night 4: the table look ('club' = the approved look, 'grey' = the old gray box), dev panel switch, kept on this device
const LOOK_KEY = 'snooker147.look';
let tableLook: TableLookId = (() => { try { const v = localStorage.getItem(LOOK_KEY); return v === 'grey' || v === 'club' ? v : CONFIG.view3d.look; } catch { return CONFIG.view3d.look; } })();
let kinds: BallKind[] = [];
function buildView(balls: Ball[]) {
  ids = balls.map((b) => b.id);
  kinds = balls.map((b) => b.kind);
  // the table itself is built once (textures and shapes are costly); only the balls change between racks
  if (view3d && view3d.look === tableLook) { view3d.setKinds(balls.map((b) => b.kind)); return; }
  view3d?.dispose();
  view3d = createTable3d(canvas, table, balls.map((b) => b.kind), tableLook);
  view3d.setBallScale(ballScale);
}
function setTableLook(l: TableLookId) {
  tableLook = l;
  try { localStorage.setItem(LOOK_KEY, l); } catch { /* private window */ }
  const keep = rest;
  view3d?.dispose(); view3d = null;
  // a new WebGL context needs a fresh canvas
  const old = $('c3d') as HTMLCanvasElement, fresh = old.cloneNode(false) as HTMLCanvasElement;
  old.replaceWith(fresh); canvas = fresh;
  view3d = createTable3d(canvas, table, kinds, tableLook);
  view3d.setBallScale(ballScale);
  rest = keep;
  draw3d();
}
const placed = (balls: Ball[]) => ids.map((id) => balls.find((b) => b.id === id)?.pos ?? null);
function showBalls(balls: Ball[]) { rest = placed(balls); draw3d(); }
const draw3d = () => { if (!view3d) return; view3d.resize(); view3d.draw(rest); };

// dev only (night 4 pocket check): slow motion (?slow=0.1) and the last recording, for scripts/pocket-check.mjs
let devSlow = import.meta.env.DEV ? Number(params.get('slow')) || 1 : 1;
let devLastRec: { rec: ReturnType<typeof recordShot>; t0: number; scale: number; n: number; simT?: number } | null = null;
let devShots = 0;
let devPauseOn: { kind: 'jaw' | 'pot' | 'potCue'; offset: number } | null = null;
let devPause: { at: number; event: unknown; paused: boolean } | null = null;
let devResume = false;
// Part 4 / 3b switches (dev panel; kept on this device so the owner can compare on the phone)
const readSwitch = (key: string, def: boolean) => { try { const v = localStorage.getItem(key); return v === null ? def : v === '1'; } catch { return def; } };
const saveSwitch = (key: string, v: boolean) => { try { localStorage.setItem(key, v ? '1' : '0'); } catch { /* private window */ } };
let cueOn = readSwitch('snooker147.cue', CONFIG.view3d.cue.enabled);
let fastEndOn = readSwitch('snooker147.fastEnd', CONFIG.shot.fastEnd.enabled);
setPos411p(readSwitch('snooker147.pos411p', CONFIG.solver.natural.pos411p.enabled));
const CUE_TIMING = VARIANTS.C1 as unknown as { appear: number; stroke: number; added: number }; // appear + stroke = 0.25 s (approved C1)
/** What the cue must never cover (Part 4): the object ball (the first ball on the cue ball's line) and the pocket that
 *  ball is sent towards. Worked out from the layout and the planned direction only, never from the outcome. */
function cueProtect(balls: Ball[], C: Vec2, d: Vec2) {
  const r = table.ballRadius, rs = r * ballScale;
  let best: { b: Ball; t: number; lat: number } | null = null;
  for (const b of balls) {
    if (b.kind === 'cue') continue;
    const rx = b.pos.x - C.x, ry = b.pos.y - C.y, t = rx * d.x + ry * d.y, lat = Math.abs(rx * d.y - ry * d.x);
    if (t > 0 && lat < 2 * r && (!best || t < best.t)) best = { b, t, lat };
  }
  if (!best) return [];
  const back = Math.sqrt(Math.max(0, 4 * r * r - best.lat * best.lat));
  const G = { x: C.x + d.x * (best.t - back), y: C.y + d.y * (best.t - back) }, O = best.b.pos;
  const ul = Math.hypot(O.x - G.x, O.y - G.y) || 1, u = { x: (O.x - G.x) / ul, y: (O.y - G.y) / ul };
  let pk = table.pockets[0]!, bestCos = -2;
  for (const p of table.pockets) {
    const vx = p.captureCentre.x - O.x, vy = p.captureCentre.y - O.y, l = Math.hypot(vx, vy) || 1, c = (vx * u.x + vy * u.y) / l;
    if (c > bestCos) { bestCos = c; pk = p; }
  }
  return [{ p: O, z: rs, radius: rs }, { p: pk.captureCentre, z: 0, radius: pk.captureRadius }];
}
/** Play a shot from `balls` on screen; resolves with its length in seconds when every ball has stopped. */
function playShot(balls: Ball[], s: Shot, opts: { cue?: boolean } = {}): Promise<number> {
  const sim = createSim(balls, table);
  strike(sim, 'cue', s.dir, s.speed, s.spin);
  const rec = recordShot(sim);
  const slot = rec.ids.map((id) => ids.indexOf(id));
  // Part 4: the cue (after SHOOT and on the automatic step 1, never on the break-off). Its direction is the planned
  // shot's cue direction; nothing about the outcome is used. Part 3b: the faster end (playback only, off by default).
  const cueBall = balls.find((b) => b.kind === 'cue');
  const cuePlan = opts.cue && cueOn && cueBall && view3d ? view3d.planCue(cueBall.pos, s.dir, balls.filter((b) => b.kind !== 'cue').map((b) => b.pos), cueProtect(balls, cueBall.pos, s.dir)) : null;
  const lead = cuePlan ? CUE_TIMING.added : 0;
  const fastFrom = fastEndOn ? startOf(rec, { ...CONFIG.shot.fastEnd, enabled: true }) : null;
  const FE = { ...CONFIG.shot.fastEnd, enabled: true };
  return new Promise((res) => {
    const t0 = performance.now();
    let tau = 0; // seconds since the cue appeared (the cue's own clock)
    const scale = CONFIG.shot.playbackTimeScale * devSlow;
    if (import.meta.env.DEV) devLastRec = { rec, t0, scale, n: ++devShots };
    let t = 0, prevNow = t0;
    // dev pocket check: freeze the playback at the first event of the asked kind (+ offset) until __dev.resume()
    let pauseAt: number | null = null;
    if (import.meta.env.DEV && devPauseOn) {
      const w = devPauseOn;
      const ev = rec.events.find((e) => (w.kind === 'jaw' ? e.type === 'jaw' && e.a !== 'cue' : e.type === 'pot' && (w.kind === 'potCue') === (e.a === 'cue')));
      if (ev) { pauseAt = Math.min(rec.duration, ev.t + w.offset); devPause = { at: pauseAt, event: ev, paused: false }; } else devPause = null;
      devPauseOn = null;
    }
    const tick = () => {
      const now = performance.now();
      const dReal = ((now - prevNow) / 1000) * devSlow;
      prevNow = now;
      const paused = !!(import.meta.env.DEV && devPause?.paused && !devResume);
      if (!paused) tau += dReal;
      if (cuePlan) { const { gap, alpha } = cuePose(CUE_TIMING, tau); if (alpha > 0.003) view3d?.showCue(cueBall!.pos, cuePlan, gap, alpha); else view3d?.hideCue(); }
      if (tau < lead) { // the stroke: the balls wait until the tip reaches the cue ball
        const p0 = positionsAt(rec, 0);
        rest = ids.map(() => null);
        slot.forEach((j, n) => { if (j >= 0) rest[j] = p0[n]!; });
        draw3d();
        requestAnimationFrame(tick);
        return;
      }
      const rate = fastFrom === null ? 1 : rateAt(t, fastFrom, FE);
      t = Math.min(rec.duration, t + dReal * CONFIG.shot.playbackTimeScale * rate);
      view3d?.setSpeed(CONFIG.shot.playbackTimeScale * devSlow * rate);
      if (import.meta.env.DEV && pauseAt !== null && devPause) {
        if (t >= pauseAt) { t = pauseAt; devPause.paused = true; }
        if (devPause.paused && !devResume) { view3d?.setSpeed(0); rest = ids.map(() => null); slot.forEach((j, n) => { if (j >= 0) rest[j] = positionsAt(rec, t)[n]!; }); draw3d(); requestAnimationFrame(tick); return; }
        if (devResume) { pauseAt = null; devResume = false; devPause = null; }
      }
      if (import.meta.env.DEV && devLastRec) devLastRec.simT = t;
      const p = positionsAt(rec, t);
      rest = ids.map(() => null);
      slot.forEach((j, n) => { if (j >= 0) rest[j] = p[n]!; });
      draw3d();
      if (t < rec.duration) requestAnimationFrame(tick); else { view3d?.hideCue(); res(rec.duration); }
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
  if (round.phase !== 'decide') { presolver.cancel(); return; } // the step failed or the round ended: drop the step ahead
  const { step, failure } = nextOutcome(round);
  const f = forcedNow(); // developer panel: a forced failure type is solved instead of the decided one
  const fail = f && f !== 'success' && f !== 'reRack' ? f : failure;
  presolver.request(round.frame!, nextTarget(round), fail, { roundCode: round.roundCode, step }, replayColour(round));
}

/**
 * Task P.2: once both answers of the shot being decided exist, start solving the step after it, from the frame its
 * success leaves (after a failure the round ends, so that is the only frame ever needed). Always done, whatever the
 * decided outcome; presolveNext() keeps it when the success comes, and it is dropped on a failure or a cash out.
 */
function presolveAhead(req: SolveRequest, success: Solved) {
  if (round.phase !== 'decide' || round.roundCode !== req.ctx.roundCode || round.step + 1 !== req.ctx.step) return;
  const after = successEnd(round, success.target, success.planned, table);
  if (after.phase !== 'decide') return; // a re-rack or the last step: no step after it
  const { step, failure } = nextOutcome(after);
  const f = forcedNow(); // developer panel, as in presolveNext()
  const fail = f && f !== 'success' && f !== 'reRack' ? f : failure;
  presolver.ahead(after.frame!, nextTarget(after), fail, { roundCode: after.roundCode, step }, replayColour(after));
}

async function onStart() {
  if (busy || round.phase === 'decide') return;
  if (!replay && round.balance < round.bet) return; // a replay is free (owner, night 4): no bet, no pay
  presolver.cancel();
  busy = 'rerack';
  showBetArea = false;
  render();
  try { await loadLibrary(round.levelId); } catch (e) { busy = null; showBetArea = true; lastShot = String(e); render(); return; }
  const seed = pendingSeed ?? newSeed();
  const rng = pendingSeed !== null ? pendingRng : RNG_VERSION_NEW;
  pendingSeed = null;
  let afterBreak: FrameState | null = null;
  const base = createPhysicsProvider(table, library);
  const provider = { ...base, breakAndStep1: (...a: Parameters<typeof base.breakAndStep1>) => {
    const x = base.breakAndStep1(...a);
    afterBreak = x.afterBreak;
    return x;
  } };
  round = start({ ...round, seed, rng, free: replay !== null }, provider, table);
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
  const len = await playShot(afterBreak!.balls, round.history[0]!.shot as Shot, { cue: true });
  lastShot = `step 1: red · ${round.history[0]!.outcome} · from the break-off library · ${len.toFixed(2)} s long`;
  lastCost = 'step 1: from the break-off library, no solve';
  if (import.meta.env.DEV) lastDraw = `step 1 ${drawText(outcomeDraw(round, 1), null)}`;
  // step 1 comes from the break-off library: no solve and no SHOOT press, so its cost fields are null
  sendCost(stepCost(round, 1, { target: 'red', outcome: round.history[0]!.outcome, forced: false, auto: !!auto, ahead: false,
    answers: null, pressAfterMs: null, thinkingMs: null }));
  lastInfo = { code: round.roundCode, step: 1, type: 'library', target: 'red', outcome: round.history[0]!.outcome, length: len };
  afterShot();
}

async function onShoot() {
  if (busy || round.phase !== 'decide') return;
  const decided = nextOutcome(round);
  const step = decided.step;
  const forced = forcedNow(); // developer panel only (null in the real game)
  const outcome = forced ? (forced === 'reRack' ? 'success' : forced) : decided.outcome;
  const ctx = { roundCode: round.roundCode, step };
  const colourStep = round.frame!.phase === 'colour';
  const kind = outcome === 'success' ? 'success' : 'failure';
  busy = presolver.ready() ? 'shot' : 'solving';
  render();
  const t0 = performance.now();
  const solved = await presolver.get(kind, ctx);
  const waited = performance.now() - t0;
  const thinking = busy === 'solving'; // the player saw THINKING… until the answer came
  const both = presolver.answers();
  if (import.meta.env.DEV) lastDraw = `step ${step} ${drawText(outcomeDraw(round, step), forced ? FORCE_TEXT[forced] : null)}`;
  sendCost(stepCost(round, step, { target: solved.target, outcome, forced: !!forced, auto: !!auto, ahead: both.ahead,
    answers: both, pressAfterMs: t0 - shootAvailableAt, thinkingMs: thinking ? waited : 0 }));
  const before = round;
  const target = solved.target; // on a colour step: the colour the game picked (RULES B.3)
  const prov = solvedProvider(createPhysicsProvider(table, library), solved.planned, { target, outcome });
  const colour = colourStep ? (target as Colour) : undefined;
  round = forced ? shootForced(round, prov, table, forced, colour) : shoot(round, prov, table, colour);
  if (forced) { force = null; toast(`forced: ${FORCE_TEXT[forced]}`); }
  presolveNext(); // the shot after this one starts solving during this shot's animation
  busy = 'shot';
  render();
  const h = round.history[round.history.length - 1]!;
  const caps = shotCaps();
  const cap = kind === 'failure' ? caps.failure : caps.success + (colourStep ? caps.colourPick : 0);
  const work = `solved in ${solved.ms.toFixed(0)} ms (${solved.planned.tried ?? '?'} of max ${cap} shots)` +
    (waited > 20 ? `, SHOOT waited ${waited.toFixed(0)} ms` : ', ready before SHOOT');
  lastCost = `step ${step} (${kind}): solve ${solved.ms.toFixed(0)} ms · ${solved.planned.tried ?? '?'} simulated shots · ` +
    (thinking ? `THINKING… shown ${waited.toFixed(0)} ms` : 'no wait (ready before SHOOT)');
  if (h.outcome === 'reRack') {
    lastShot = `step ${step}: RE-RACK (no shot found) · ${work}`;
    lastInfo = { code: round.roundCode, step, type: 'reRack', target: h.target, outcome: 'reRack', length: 0 };
  } else {
    // developer jump: no animation, the balls just move to where the shot leaves them
    const len = auto?.mode === 'jump' ? (h.shot as { duration: number }).duration : await playShot(before.frame!.balls, h.shot as Shot, { cue: true });
    const type = (h.shot as { type?: string }).type ?? '?';
    lastShot = `step ${step}: ${h.target} · ${h.outcome} · ${TYPE_TEXT[type] ?? type} · ${len.toFixed(2)} s long · ${work}`;
    lastInfo = { code: round.roundCode, step, type, target: h.target, outcome: h.outcome, length: len };
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
  shootAvailableAt = performance.now();
  if (round.frame) showBalls(round.frame.balls);
  if (round.phase === 'over') endRound(); else render();
  // task 5.4: a replay by round code plays itself and cashes out where the code says
  if (replay && round.phase === 'decide') {
    const r = replay;
    setTimeout(() => {
      if (replay !== r || busy || round.phase !== 'decide') return;
      if (r.cashOutAfter !== null && round.step >= r.cashOutAfter) onCashOut(); else void onShoot();
    }, 600);
  }
  // developer panel: auto play goes on by itself
  if (import.meta.env.DEV && auto && round.phase === 'decide') {
    if (auto.mode === 'jump' && round.step >= auto.to) { auto = null; render(); return; }
    setTimeout(() => { if (auto && !busy && round.phase === 'decide') void onShoot(); }, auto.mode === 'jump' ? 50 : 600);
  }
}

async function endRound() {
  busy = null;
  auto = null;
  replay = null;
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
  el.innerHTML = `<div>${clearanceText(round)}</div><small>${round.free ? replayEndLine(round.end!) : endLine(round.end!, round.bet)}</small>`;
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
let balanceLen = 0;
const renderBalance = () => {
  const t = money(mode === 'live' ? shownBalance : CONFIG.money.startingBalance);
  $('balance').textContent = t;
  if (t.length !== balanceLen) { balanceLen = t.length; fitTop(); } // a longer amount (also during the count-up) must not touch the centre slot
};

function chipsHtml(step: number, between = false) {
  const L = ladder();
  const { previous, next } = CONFIG.ui.ladderStrip;
  const count = previous + 1 + next;
  const first = Math.max(1, Math.min(L.length - count + 1, step - previous));
  const chips = Array.from({ length: count }, (_, i) => first + i).map((k) => {
    const cls = k < step ? 'prev' : k === step ? 'current' : k === step + 1 ? 'next' : '';
    return `<div class="chip ${cls}">${formatMult(L[k - 1]!.multiplier)}</div>`;
  });
  // night 4 (Part 5): between rounds the first cell names the level's top multiplier instead of the step
  const first0 = between ? `<div class="step upto">UP TO<br>${formatMult(L[L.length - 1]!.multiplier)}</div>` : `<div class="step">STEP ${step}<br>/ ${L.length}</div>`;
  return `${first0}${chips.join('')}`;
}

/** The end line of a free replay: what happened, no money (the balance did not change). */
function replayEndLine(end: NonNullable<Round['end']>): string {
  if (end.type === 'failure') return `REPLAY OVER · ${FAILURE_TEXT[end.label]} · NO BET`;
  return `REPLAY OVER · ${end.type === 'cashOut' ? 'CASHED OUT' : end.type === 'clearance' ? 'CLEARED' : 'RE-RACK'} ${formatMult(end.multiplier)} · NO BET`;
}

function render() {
  if (mode !== 'live') { renderStatic(); renderDev(); return; }
  renderBalance();
  // night 4: a small REPLAY label on the table while a replay runs (it takes no bet and pays nothing)
  $('replayTag').classList.toggle('show', !!round.free && (round.phase === 'decide' || busy !== null));
  const inRound = round.phase === 'decide' || busy !== null;
  // night 4 (Part 5): the centre slot. Between rounds: the three level balls (6 / 10 / 15 reds; the level can only
  // change between rounds). During a round: the big current multiplier in the same place.
  renderCentre(inRound);
  // the end line stays in the strip until the next START (RULES B.4)
  $('ladder').innerHTML = round.phase === 'over' && round.end && busy === null
    ? `<div class="endline ${round.end.type === 'failure' ? 'lost' : 'won'}">${round.free ? replayEndLine(round.end) : endLine(round.end, round.bet)}${round.forced ? ' · FORCED' : ''}</div>`
    : chipsHtml(round.step, !inRound);

  const bottom = $('bottom');
  if (busy) {
    const what = { rerack: 'RACKING', break: 'OPPONENT BREAKS OFF', step1: 'STEP 1 · RED', shot: '', solving: 'THINKING…' }[busy];
    bottom.innerHTML = `<div class="hint">${what}</div><button class="big" disabled>SHOOT</button>`;
  } else if (round.phase === 'decide') {
    const amount = (cashOut(round).end as { amount: number }).amount; // exactly what CASH OUT pays
    // a free replay pays nothing: CASH OUT shows the multiplier, never an amount that looks like money
    const cashText = round.free ? `${formatMult(ladder()[round.step - 1]!.multiplier)} · REPLAY` : money(amount);
    bottom.innerHTML = `<button class="cash" id="bCash">CASH OUT<b>${cashText}</b></button>` +
      `<div class="hint">${hintText(round, presolver.target())}</div><button class="big" id="bShoot">SHOOT</button>`;
    $('bCash').onclick = onCashOut;
    $('bShoot').onclick = () => { void onShoot(); };
  } else if (!showBetArea) {
    bottom.innerHTML = `<div class="hint"></div><button class="big" disabled>START</button>`;
  } else {
    const bet = round.bet;
    const can = round.balance >= bet;
    // night 4 (Part 5): one row with - BET + and the quick amounts, then START (the RTP text moved into the Rules)
    bottom.innerHTML = `
      <div class="row betrow"><button class="sq" id="bMinus">−</button><div class="bet">BET<b>${money(bet)}</b></div><button class="sq" id="bPlus">+</button>${CONFIG.money.quickBets.map((q) => `<button class="quick${q === bet ? ' on' : ''}" data-q="${q}">${q}</button>`).join('')}</div>
      <button class="big" id="bStart" ${can ? '' : 'disabled'}>${can ? `START · ${money(bet)}` : 'BALANCE TOO LOW'}</button>`;
    const setB = (b: number) => { round = setBet(round, b); render(); };
    $('bMinus').onclick = () => setB(round.bet - CONFIG.money.betStep);
    $('bPlus').onclick = () => setB(round.bet + CONFIG.money.betStep);
    bottom.querySelectorAll<HTMLButtonElement>('.quick').forEach((b) => { b.onclick = () => setB(Number(b.dataset.q)); });
    $('bStart').onclick = () => { void onStart(); };
  }
  renderFooter();
  renderDevTag();
  renderDev();
  fitTop();
}

/** The centre slot of the top bar (Part 5). */
function renderCentre(inRound: boolean) {
  const c = $('centre');
  if (inRound) {
    c.innerHTML = round.step > 0 && round.phase === 'decide' ? `<span class="mult">${formatMult(ladder()[round.step - 1]!.multiplier)}</span>` : '';
    return;
  }
  c.innerHTML = CONFIG.levels.map((l) => `<button class="lvl${l.id === round.levelId ? ' on' : ''}" data-l="${l.id}" aria-label="${l.reds} reds">${l.reds}</button>`).join('');
  c.querySelectorAll<HTMLButtonElement>('.lvl').forEach((b) => { b.onclick = () => changeLevel(b.dataset.l as LevelId); });
}
/** Part 5: the balance may never touch the centre slot: first the level balls may go down to 40 px (narrow phones),
 *  then the balance font shrinks. The centre slot itself never moves. */
function fitTop() {
  const scr = $('screen'), centre = $('centre'), bal = $('balance');
  const gap = 6;
  // the right group (mute button + balance) and the left group (BACK + menu) must both stay clear of the centre slot
  const right = document.querySelector('.top .right') as HTMLElement, left = document.querySelector('.top .left') as HTMLElement;
  const clear = () => {
    const c = centre.getBoundingClientRect(), b = right.getBoundingClientRect(), l = left.getBoundingClientRect();
    return c.width === 0 || (b.left >= c.right + gap && l.right + gap <= c.left);
  };
  scr.style.setProperty('--ball', '44px');
  bal.style.fontSize = '';
  if (!clear()) scr.style.setProperty('--ball', '40px');
  for (let px = 17; px >= 9 && !clear(); px--) bal.style.fontSize = `${px}px`;
}
/** Footer: "147 · DEMO · Round <code> · <clock>" on the left. */
function renderFooter() {
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const code = round.roundCode ? roundCodeOf(round) : '—';
  $('footLeft').textContent = `147 · DEMO · Round ${code} · ${clock}`;
}
setInterval(renderFooter, 20_000);
/** The Rules box (Part 5): how a round works, and the RTP range of every level (moved here from the bet area). */
function openRules() {
  const el = $('rules');
  const rtps = CONFIG.levels.map((l) => {
    const top = Math.max(...ladderForLevel(l.id).map((x) => x.multiplier));
    return `<li><b>${l.reds} reds</b> (up to ${formatMult(top)}): ${rtpText(l.id)}</li>`;
  }).join('');
  el.innerHTML = `<div class="box"><h2>Rules</h2>
    <ul><li>Pick a level and a bet, then START. The opponent breaks off and your first red plays itself.</li>
    <li>Each SHOOT plays the next ball in snooker order: a red, then a colour, and so on. A pot moves you one step up the ladder.</li>
    <li>CASH OUT after any pot to take bet × the current multiplier. A miss, a foul or an in-off ends the round and the bet is lost.</li>
    <li>Clearing the table pays the top multiplier. If no shot can be found the balls are re-racked and the round is paid.</li>
    <li>Every outcome is decided before the shot is shown and does not depend on where the balls lie.</li></ul>
    <h2>Return to player (RTP)</h2><ul>${rtps}</ul>
    <button class="close" id="rulesClose">Close</button></div>`;
  el.classList.add('open');
  $('rulesClose').onclick = () => el.classList.remove('open');
  el.onclick = (e) => { if (e.target === el) el.classList.remove('open'); };
}
$('rulesBtn').onclick = openRules;
// BACK: TODO (casino) return to the lobby. For now it does nothing visible.
$('back').onclick = () => { /* TODO: lobby */ };
const renderMute = () => { const b = $('mute'); b.innerHTML = muteIcon(isMuted()); b.setAttribute('aria-pressed', String(isMuted())); };
$('mute').onclick = () => { setMuted(!isMuted()); renderMute(); };
renderMute();

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
  if (id === 'D') renderCentre(false); else $('centre').innerHTML = `<span class="mult">${formatMult(mult(step))}</span>`;
  $('ladder').innerHTML = chipsHtml(step, id === 'D');
  const hint = S[id].hint.replace('{next}', step < ladder().length ? mult(step + 1).toFixed(2) : '');
  const cashB = step > 0 ? `<button class="cash">CASH OUT<b>${money(CONFIG.money.defaultBet * mult(step))}</b></button>` : '';
  if (id === 'D') {
    $('bottom').innerHTML = `
      <div class="row betrow"><button class="sq">−</button><div class="bet">BET<b>${money(CONFIG.money.defaultBet)}</b></div><button class="sq">+</button>${CONFIG.money.quickBets.map((q) => `<button class="quick${q === CONFIG.money.defaultBet ? ' on' : ''}">${q}</button>`).join('')}</div>
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
  fitTop();
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
  // task 5.4: the full round code (seed, colour letters, cash-out step); at the end of a round it replays the whole round
  const code = round.roundCode ? roundCodeOf(round) : '—';
  dev.innerHTML = '<h3>DEVELOPER · SCREEN</h3><div class="opts" id="devScreens"></div>' +
    '<h3>ROUND</h3><div class="info" id="devRound"></div>' +
    '<div class="opts"><input id="devSeed" placeholder="seed or round code" /><button id="devUseSeed">Use seed</button><button id="devReplay">Replay code</button></div>' +
    '<div class="opts" id="devRoundBtns"></div>' +
    '<h3>LAST SHOT</h3><div class="info" id="devShot"></div>' +
    (import.meta.env.DEV ? '<div class="info" id="devDraw"></div><div class="info" id="devCost"></div>' : '') + '<div class="opts" id="devWeird"></div>' +
    '<div class="info" id="devWeirdList"></div>' +
    (import.meta.env.DEV ? '<h3>TEST PANEL (DEV ONLY) · NEXT SHOT</h3><div class="opts" id="devForce"></div>' +
      '<div class="opts"><input id="devJump" placeholder="step" inputmode="numeric" /><button id="devJumpGo">Jump to step</button></div>' +
      '<div class="opts" id="devAuto"></div>' : '') +
    '<h3>TABLE LOOK</h3><div class="opts" id="devLook"></div><h3>CUE</h3><div class="opts" id="devCue"></div><h3>FASTER SHOT END (PLAYBACK)</h3><div class="opts" id="devFast"></div><h3>POSITION PLAY (EXPERIMENT)</h3><div class="opts" id="devPos"></div><h3>COMPARE WITH MOCKUP</h3><div class="opts" id="devCompare"></div><h3>BALL SIZE (DRAWN ONLY)</h3><div class="opts" id="devScale"></div>' +
    '<h3>LEVEL</h3><div class="opts" id="devLevel"></div><h3>CHECK PAGES</h3>' +
    '<a href="/replay.html">Replay check: 2D and 3D</a><a href="/debug.html">Table debug</a>';
  $('devScreens').appendChild(opt('Live game', mode === 'live', () => setMode('live'), busy !== null));
  for (const id of ['D', 'A', 'C'] as const) {
    $('devScreens').appendChild(opt(`${id}: ${{ D: 'start', A: 'shoot', C: 'colour' }[id]}`, mode === id, () => setMode(id), busy !== null));
  }
  $('devRound').innerHTML = `Round code: <b>${code}</b>${round.phase === 'decide' ? ` · step ${round.step}` : round.phase === 'over' ? ' · replays this whole round' : ''}<br>` +
    (replay ? `Replaying code <b>${seedText || code}</b><br>` : '') +
    `${pendingSeed !== null ? `Next START uses seed <b>${pendingRng === 2 ? 'v2-' : ''}${pendingSeed}</b>` : 'Next START: new random seed'}<br>` +
    `Fallbacks this session: ${fallbacks.length}${fallbacks.length ? ' (details in the browser console)' : ''}`;
  const input = $('devSeed') as HTMLInputElement;
  input.value = seedText;
  input.oninput = () => { seedText = input.value; };
  $('devUseSeed').onclick = () => {
    const p = parseRoundCode(seedText);
    if (!p) { $('devRound').innerHTML += '<br><span class="bad">Not a seed or round code</span>'; return; }
    if (p.levelId && p.levelId !== round.levelId) { if (locked) return; changeLevel(p.levelId); }
    pendingSeed = p.seed; pendingRng = p.rng;
    render();
  };
  ($('devUseSeed') as HTMLButtonElement).disabled = locked;
  const startReplay = (p: RoundCode) => {
    if (p.levelId && p.levelId !== round.levelId) changeLevel(p.levelId);
    replay = p; pendingSeed = p.seed; pendingRng = p.rng;
    $('dev').classList.remove('open');
    void onStart();
  };
  $('devReplay').onclick = () => {
    const p = parseRoundCode(seedText);
    if (!p) { $('devRound').innerHTML += '<br><span class="bad">Not a round code</span>'; return; }
    if (!locked) startReplay(p); // free: no bet needed
  };
  ($('devReplay') as HTMLButtonElement).disabled = locked || mode !== 'live';
  if (round.roundCode) {
    $('devRoundBtns').appendChild(opt('Replay this round', false, () => { seedText = roundCodeOf(round); startReplay(parseRoundCode(seedText)!); },
      locked || round.phase !== 'over'));
  }
  $('devRoundBtns').appendChild(opt(`Balance back to ${CONFIG.money.startingBalance}`, false, () => {
    round = { ...round, balance: CONFIG.money.startingBalance };
    shownBalance = round.balance;
    render();
  }, locked));
  $('devShot').textContent = lastShot;
  if (import.meta.env.DEV) $('devDraw').textContent = lastDraw ? `DECIDED (dev only) · ${lastDraw}` : '';
  if (import.meta.env.DEV) $('devCost').textContent = `SOLVER COST (dev only) · ${lastCost}`;
  // task 4.7: mark the last shot as weird; the list can be copied and sent to Claude (bench/replay-shot.test.ts)
  $('devWeird').appendChild(opt('Mark this shot as weird', false, () => { void markWeird().then(render); }, !lastInfo));
  $('devWeird').appendChild(opt(`Copy list (${weird.length})`, false, () => {
    if (!navigator.clipboard) { showWeirdList(); return; }
    navigator.clipboard.writeText(weird.join('\n')).then(() => { $('devWeirdList').textContent = `Copied ${weird.length} lines.`; },
      () => { showWeirdList(); });
  }, !weird.length));
  $('devWeird').appendChild(opt(`Send list to PC (${weird.length})`, false, () => { void sendWeirdList(); }, !weird.length));
  $('devWeirdList').textContent = `${pcLink}${weirdStatus ? ` · ${weirdStatus}` : ''}` +
    (import.meta.env.DEV ? ` · cost lines v${COST_LINE_VERSION}: ${costSent} sent${costFailed ? `, ${costFailed} FAILED` : ''}` : '');
  $('devWeird').appendChild(opt('Clear list', false, () => { weird = []; saveWeird(); renderFlag(); render(); }, !weird.length));
  if (import.meta.env.DEV) renderTestPanel(opt);
  $('devLook').appendChild(opt('Club (new)', tableLook === 'club', () => { setTableLook('club'); render(); }, busy !== null));
  $('devLook').appendChild(opt('Gray box (old)', tableLook === 'grey', () => { setTableLook('grey'); render(); }, busy !== null));
  $('devCue').appendChild(opt('On', cueOn, () => { cueOn = true; saveSwitch('snooker147.cue', true); render(); }));
  $('devCue').appendChild(opt('Off', !cueOn, () => { cueOn = false; saveSwitch('snooker147.cue', false); view3d?.hideCue(); render(); }));
  $('devFast').appendChild(opt('Off', !fastEndOn, () => { fastEndOn = false; saveSwitch('snooker147.fastEnd', false); render(); }));
  $('devFast').appendChild(opt('On', fastEndOn, () => { fastEndOn = true; saveSwitch('snooker147.fastEnd', true); render(); }));
  // Part 3c: position-play experiment (solver 4.11p); only between shots, so a solve in progress is never mixed
  const setPP = (v: boolean) => { setPos411p(v); saveSwitch('snooker147.pos411p', v); $('devVer').textContent = `solver ${solverVersion()}`; if (round.phase === 'decide' && !busy) { presolver.cancel(); presolveNext(); } render(); };
  $('devPos').appendChild(opt('4.10 (off)', !pos411pOn(), () => setPP(false), busy !== null));
  $('devPos').appendChild(opt('4.11p (on)', pos411pOn(), () => setPP(true), busy !== null));
  for (const s of CONFIG.view3d.ballScaleOptions) {
    $('devScale').appendChild(opt(`${s}x`, ballScale === s, () => { ballScale = s; view3d?.setBallScale(s); render(); draw3d(); }));
  }
  for (const l of CONFIG.levels) {
    $('devLevel').appendChild(opt(`${l.reds} reds`, round.levelId === l.id, () => changeLevel(l.id), locked));
  }
  $('devCompare').appendChild(opt('Off', !compare, () => { compare = false; render(); layout(); }));
  $('devCompare').appendChild(opt('On', compare, () => { compare = true; render(); layout(); }));
}
/** Developer test panel (task 5.3, dev build only): force the next outcome, jump to a step, play automatically. */
function renderTestPanel(opt: (label: string, on: boolean, click: () => void, disabled?: boolean) => HTMLButtonElement) {
  const inRound = round.phase === 'decide' && busy === null && mode === 'live';
  const setForce = (f: ForcedOutcome | null) => {
    force = f;
    // a forced failure type must be solved instead of the decided one: solve the next shot again
    if (round.phase === 'decide' && !busy) { presolver.cancel(); presolveNext(); }
    render();
  };
  for (const f of FORCED_OUTCOMES) $('devForce').appendChild(opt(FORCE_TEXT[f], force === f, () => setForce(force === f ? null : f), !inRound));
  $('devForce').appendChild(opt('Clearance', auto?.mode === 'clearance', () => {
    force = null; auto = { mode: 'clearance', to: round.ladder.length }; void onShoot();
  }, !inRound));
  const jump = $('devJump') as HTMLInputElement;
  jump.value = jumpText;
  jump.oninput = () => { jumpText = jump.value; };
  ($('devJumpGo') as HTMLButtonElement).disabled = !inRound;
  $('devJumpGo').onclick = () => {
    const to = Math.round(Number(jumpText));
    if (!(to > round.step && to <= round.ladder.length)) { toast(`step ${round.step + 1} ... ${round.ladder.length}`); return; }
    force = null; auto = { mode: 'jump', to }; void onShoot();
  };
  $('devAuto').appendChild(opt('Play a round automatically', auto?.mode === 'round', () => {
    force = null; auto = { mode: 'round', to: 0 };
    if (round.phase === 'decide') void onShoot(); else void onStart();
  }, busy !== null || mode !== 'live' || (round.phase !== 'decide' && round.balance < round.bet)));
  $('devAuto').appendChild(opt('Stop', false, () => { auto = null; render(); }, !auto));
}
/** The red tag on the table whenever an outcome is forced or the game plays by itself (developer only). */
function renderDevTag() {
  if (!import.meta.env.DEV) return;
  const el = $('devTag');
  const text = auto ? (auto.mode === 'round' ? 'DEV · AUTO PLAY' : auto.mode === 'jump' ? `DEV · FORCED · JUMP TO ${auto.to}` : 'DEV · FORCED · CLEARANCE')
    : force ? `DEV · NEXT FORCED: ${FORCE_TEXT[force].toUpperCase()}` : round.forced ? 'DEV · FORCED ROUND' : '';
  el.textContent = text;
  el.classList.toggle('show', !!text);
}
/** When copying is not allowed (plain http on a phone): show the list in a box to select and copy by hand. */
function showWeirdList() {
  const box = document.createElement('textarea');
  box.value = weird.join('\n');
  box.rows = Math.min(8, weird.length + 1);
  box.className = 'weird';
  $('devWeirdList').replaceChildren(box);
  box.focus();
  box.select();
}
function changeLevel(id: LevelId) {
  if (busy || round.phase === 'decide') return;
  round = { ...setLevel(round, id), phase: 'betting', frame: null, end: null, step: 0, roundCode: '', history: [] };
  const rack = rackBalls(level().reds, table);
  if (mode === 'live') { buildView(newFrame(level().reds, table).balls); showBalls(rack); } else setMode(mode);
  render();
}
if (import.meta.env.DEV) {
  // the developer test panel's actions, for scripts (the same calls the panel buttons make)
  (window as unknown as Record<string, unknown>).__dev = {
    force: (f: ForcedOutcome | null) => { force = f; if (round.phase === 'decide' && !busy) { presolver.cancel(); presolveNext(); } render(); },
    shoot: () => onShoot(), start: () => onStart(),
    state: () => ({ busy, phase: round.phase, step: round.step, balance: round.balance, code: round.roundCode, mode }),
    lastRec: () => devLastRec && { n: devLastRec.n, t0: devLastRec.t0, scale: devLastRec.scale, duration: devLastRec.rec.duration, events: devLastRec.rec.events, ids: devLastRec.rec.ids, simT: devLastRec.simT ?? 0 },
    setSlow: (x: number) => { devSlow = x; },
    pauseOn: (kind: 'jaw' | 'pot' | 'potCue', offset: number) => { devPauseOn = { kind, offset }; devPause = null; devResume = false; },
    pause: () => devPause, resume: () => { devResume = true; },
    /** page coordinates (CSS px) of a pocket's drop circle centre, and of a point `r` metres from it (for crops) */
    pocketBox: (id: string) => {
      const pk = table.pockets.find((q) => q.id === id)!, c = canvas.getBoundingClientRect();
      const a = view3d!.project(pk.captureCentre.x - 0.2, pk.captureCentre.y - 0.2), b = view3d!.project(pk.captureCentre.x + 0.2, pk.captureCentre.y + 0.2);
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      return { x: c.left + x0, y: c.top + y0, width: x1 - x0, height: y1 - y0 };
    },
    balanceBack: () => { round = { ...round, balance: CONFIG.money.startingBalance }; render(); },
    setBalance: (v: number) => { round = { ...round, balance: v }; shownBalance = v; render(); }, // layout check: a long balance
  };
}
$('menu').onclick = () => { $('dev').classList.toggle('open'); renderDev(); };

// ---------------- start ----------------
// for automatic checks in a browser (developer only): the round and what is drawn
(window as unknown as { __game: unknown }).__game = () => ({ round, drawn: rest, ids, busy });
if (mode === 'live') { const rack = newFrame(level().reds, table).balls; buildView(rack); showBalls(rack); } else setMode(mode);
render();
renderFlag();
window.addEventListener('resize', layout);
// browser bars showing or hiding change the visible area without always firing a window resize
window.visualViewport?.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 100));
// no long-press menu, no text selection, no double-tap zoom, no pinch zoom (page is locked like an app)
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => { if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault(); });
document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS pinch
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// double-tap zoom is off through CSS touch-action (not by cancelling taps, so quick repeated taps on +/- still count)
layout();
