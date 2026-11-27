// 2026-11-27: the opponent's break-off is played with the cue. Pictures during the stroke (slow motion).
// node scripts/break-cue.mjs [outDir] [url]
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night6/break-cue';
const url = process.argv[3] ?? 'http://localhost:5181/';
mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
for (let i = 1; i <= 2; i++) {
  await p.evaluate(() => window.__dev.setSlow(0.02)); // the 0.25 s stroke takes 12.5 s (set before START: the break starts at once)
  await p.evaluate(() => { void window.__dev.start(); });
  await p.waitForFunction('window.__dev.state().busy === "break"', { timeout: 60000, polling: 20 });
  await new Promise((r) => setTimeout(r, 3500));
  await p.screenshot({ path: `${out}/break${i}-a-cue-appears.png` });
  await new Promise((r) => setTimeout(r, 6500));
  await p.screenshot({ path: `${out}/break${i}-b-before-hit.png` });
  await p.evaluate(() => window.__dev.setSlow(1));
  await p.waitForFunction('window.__dev.state().busy === null', { timeout: 120000, polling: 200 });
  const s = await p.evaluate(() => window.__dev.state());
  console.log(`break ${i}: ${s.code}, waiting for SHOOT: ${s.waiting}`);
  await p.evaluate(() => { void window.__dev.shoot(); });
  await p.waitForFunction('window.__dev.state().busy === null', { timeout: 120000, polling: 200 });
  while ((await p.evaluate(() => window.__dev.state())).phase === 'decide') { await p.evaluate(() => { void window.__dev.shoot(); }); await new Promise((r) => setTimeout(r, 300)); await p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 }); }
}
await b.close();
