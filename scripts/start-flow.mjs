// 2026-11-27 (RULES B.2): START -> break-off -> the game waits at step 0 with SHOOT only (no CASH OUT) -> SHOOT plays
// step 1. Also a replay of a round code presses SHOOT by itself. node scripts/start-flow.mjs [outDir] [url]
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night5/start-flow';
const url = process.argv[3] ?? 'http://localhost:5181/';
mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
const st = () => p.evaluate(() => window.__dev.state());
let ok = true;
const check = (what, v) => { console.log(v ? 'ok  ' : 'FAIL', what); ok &&= v; };
for (let i = 0; i < 3; i++) {
  await p.evaluate(() => { void window.__dev.start(); });
  await new Promise((r) => setTimeout(r, 300));
  await idle();
  let s = await st();
  check(`round ${i + 1}: waits at step 0 after the break (${s.code})`, s.phase === 'decide' && s.step === 0 && s.waiting);
  check(`round ${i + 1}: SHOOT shown, no CASH OUT`, s.shootBtn && !s.cash);
  if (i === 0) await p.screenshot({ path: `${out}/waiting-for-shoot.png` });
  await new Promise((r) => setTimeout(r, 1500));
  s = await st();
  check(`round ${i + 1}: still waiting 1.5 s later (no automatic shot)`, s.step === 0 && s.waiting);
  await p.evaluate(() => { void window.__dev.shoot(); });
  await new Promise((r) => setTimeout(r, 300));
  await idle();
  s = await st();
  check(`round ${i + 1}: SHOOT played step 1 -> ${s.hist}`, s.hist.split(',').length === 1 && (s.phase === 'over' || (s.step === 1 && s.cash)));
  while ((await st()).phase === 'decide') { await p.evaluate(() => { void window.__dev.shoot(); }); await new Promise((r) => setTimeout(r, 300)); await idle(); }
}
for (const code of (process.argv[4] ?? 'reds10-5000066,reds15-12,reds6-1').split(',')) {
  await p.evaluate((c) => window.__dev.replay(c), code);
  await p.waitForFunction('window.__dev.state().phase === "over" && window.__dev.state().busy === null', { timeout: 600000, polling: 300 });
  const s = await st();
  check(`replay ${code} played by itself to the end: ${s.hist} ${s.end}`, s.hist.length > 0);
}
await b.close();
console.log(ok ? 'ALL OK' : 'SOME FAILED');
