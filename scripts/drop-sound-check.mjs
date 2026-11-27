// 2026-11-27 bug check: does the pocket-drop sound start when the ball is SEEN dropping? Plays the real game (dev
// server) and compares, per pot, the real time the 'pocket' sound started (window.__soundLog) with the real time of
// the first drawn frame where the falling ball's centre is below the cloth (window.__dropLog, table3d.ts), and with
// the frame where the fall starts. Three cases: normal speed, the pocket-camera cut (P1b, slow motion), the
// clearance replay. Also the milestone applause (levels 2-4) is listed against the same moment when it occurs.
// node scripts/drop-sound-check.mjs [shots per case = 4] [url]
import { launch } from './shot.mjs';

const SHOTS = Number(process.argv[2] ?? 4);
const url = process.argv[3] ?? 'http://localhost:5181/?level=reds15';
const b = await launch();
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('snooker147.mute', '0'); } catch { /* */ } });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
await p.mouse.click(195, 300); // the first tap switches sound on
await new Promise((r) => setTimeout(r, 1500));
const st = () => p.evaluate(() => window.__dev.state());
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 100 });
const logs = () => p.evaluate(() => ({ s: window.__soundLog ?? [], d: window.__dropLog ?? [] }));
const rows = [];

async function ensureRound() {
  let s = await st();
  if (s.phase === 'decide') return;
  if (s.balance < 50) await p.evaluate(() => window.__dev.balanceBack());
  await p.evaluate(() => { void window.__dev.start(); });
  await new Promise((r) => setTimeout(r, 300));
  await idle();
}
/** pair each drawn sink with the nearest pocket sound (same shot), gap = sound - sink (ms; negative = sound early) */
function pair(before, after, label, rate) {
  const snd = after.s.slice(before.s.length).filter((x) => x.name === 'pocket');
  const app = after.s.slice(before.s.length).filter((x) => /applause-[234]/.test(x.name));
  const drops = after.d.slice(before.d.length);
  for (const d of drops) {
    const s = snd.reduce((m, x) => (!m || Math.abs(x.at - d.at) < Math.abs(m.at - d.at) ? x : m), null);
    const gap = s ? s.at - d.at : NaN, fall = s ? s.at - d.fallAt : NaN;
    rows.push({ label, rate, gap, fall, key: s?.key ?? '-', applause: app.map((a) => `${a.name} ${(a.at - d.at).toFixed(0)} ms`).join(' ') });
    console.log(`${label.padEnd(18)} ${String(s?.key ?? 'NO SOUND').padEnd(10)} sound - centre below cloth: ${gap.toFixed(0).padStart(5)} ms on screen`
      + ` (${(gap * rate).toFixed(0)} ms shot time); sound - fall start: ${fall.toFixed(0)} ms${app.length ? '; ' + rows.at(-1).applause : ''}`);
  }
  if (!drops.length) console.log(`${label.padEnd(18)} no drawn drop seen (${snd.length} pocket sounds)`);
}

for (const [label, cam, rate] of [['normal speed', null, 1], ['pocket cam P1b', 'P1b', 0.35]]) {
  for (let k = 0; k < SHOTS; k++) {
    await ensureRound();
    await p.evaluate(() => window.__dev.force('success'));
    if (cam) await p.evaluate((c) => window.__dev.pocketCam(c), cam);
    const before = await logs();
    await p.evaluate(() => { void window.__dev.shoot(); });
    await new Promise((r) => setTimeout(r, 300));
    await idle();
    await new Promise((r) => setTimeout(r, 500)); // a ball still falling after the playback ended
    const lc = cam ? await p.evaluate(() => window.__dev.lastCut()) : '';
    pair(before, await logs(), label, rate);
    if (cam) console.log('   cut:', lc);
    await p.evaluate(() => window.__dev.force(null));
  }
}
// the clearance replay: only the sounds and drawn drops while the REPLAY tag is on screen (plus 0.5 s)
for (let k = 0; k < Math.max(1, Math.ceil(SHOTS / 2)); k++) {
  await ensureRound();
  await p.evaluate(() => window.__dev.clearLast());
  await p.waitForSelector('#clearReplayTag', { timeout: 300000 });
  const before = await logs();
  await p.waitForFunction(() => !document.getElementById('clearReplayTag'), { timeout: 60000, polling: 20 });
  await new Promise((r) => setTimeout(r, 500));
  pair(before, await logs(), 'clearance replay', 0.35);
  // the clearance message, then the bet area: tap through
  for (let i = 0; i < 4; i++) { await p.mouse.click(195, 300); await new Promise((r) => setTimeout(r, 1500)); }
  await idle().catch(() => {});
}
// the milestone applause (level 2 = break 50, 3 = needs snookers): forced successes in one round until one plays
if (process.argv[4] !== 'noapplause') {
  await ensureRound();
  for (let k = 0; k < 30; k++) {
    if ((await st()).phase !== 'decide') break;
    await p.evaluate(() => window.__dev.force('success'));
    const before = await logs();
    await p.evaluate(() => { void window.__dev.shoot(); });
    await new Promise((r) => setTimeout(r, 300));
    await idle();
    await new Promise((r) => setTimeout(r, 500));
    const after = await logs();
    if (after.s.slice(before.s.length).some((x) => /applause-[234]/.test(x.name))) pair(before, after, 'milestone shot', 1);
    if (after.s.some((x) => x.name === 'applause-3')) break;
  }
  await p.evaluate(() => window.__dev.force(null));
}
const by = {};
for (const r of rows) (by[r.label] ??= []).push(r.gap);
for (const [l, g] of Object.entries(by)) {
  const ok = g.filter((x) => Number.isFinite(x));
  console.log(`SUMMARY ${l}: ${ok.length} pots, sound - drop on screen: mean ${(ok.reduce((a, x) => a + x, 0) / ok.length).toFixed(0)} ms, `
    + `min ${Math.min(...ok).toFixed(0)}, max ${Math.max(...ok).toFixed(0)} ms`);
}
console.log('page errors:', errors.join(' | ') || 'none');
await b.close();
