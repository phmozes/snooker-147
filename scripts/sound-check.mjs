// PLAN 9.1: live check of the table sounds. Counts every sound the page starts (Web Audio), before and after the first
// tap, during the break-off and step 1, and with the mute button on. node scripts/sound-check.mjs [url]
import { launch } from './shot.mjs';
const url = process.argv[2] ?? 'http://localhost:5181/';
const b = await launch();
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.evaluateOnNewDocument(() => {
  window.__snd = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { window.__snd.push(Math.round(performance.now())); return start.apply(this, a); };
  try { localStorage.setItem('snooker147.mute', '0'); } catch { /* */ }
});
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
const count = () => p.evaluate(() => window.__snd.length);
let ok = true;
const check = (what, v) => { console.log(v ? 'ok  ' : 'FAIL', what); ok &&= v; };
// no tap yet: the round runs silent (phones would block sound anyway)
await p.evaluate(() => { void window.__dev.start(); }); await new Promise((r) => setTimeout(r, 300)); await idle();
check(`no sound before the first tap (${await count()})`, (await count()) === 0);
await p.mouse.click(5, 400); // the first tap: the sound system starts and loads the 5 files
await new Promise((r) => setTimeout(r, 1500));
await p.evaluate(() => { void window.__dev.shoot(); }); await new Promise((r) => setTimeout(r, 300)); await idle();
const step1 = await count();
check(`step 1 played sounds after the tap (${step1})`, step1 > 0);
await p.click('#mute'); // mute on
const before = await count();
const st0 = await p.evaluate(() => window.__dev.state());
await p.evaluate(() => { const s = window.__dev.state(); void (s.phase === 'decide' ? window.__dev.shoot() : window.__dev.start()); });
await new Promise((r) => setTimeout(r, 300)); await idle();
const st1 = await p.evaluate(() => window.__dev.state());
check(`muted: a shot was played (${st0.phase} step ${st0.step} -> ${st1.phase} step ${st1.step})`, st0.step !== st1.step || st0.phase !== st1.phase);
check(`muted: no sound (${(await count()) - before})`, (await count()) === before);
await p.click('#mute'); // back on (the choice is remembered on the device)
check(`no page errors (${errors.join(' | ') || 'none'})`, errors.length === 0);
await b.close();
console.log(ok ? 'SOUND CHECK OK' : 'SOUND CHECK FAILED');
process.exit(ok ? 0 : 1);
