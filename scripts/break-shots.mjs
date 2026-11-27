// 2026-11-27: "BREAK n" at the left of the status line: counts red 1 ... black 7 after every pot, keeps the last
// break between rounds. Pictures in a round at phone sizes. node scripts/break-shots.mjs [outDir] [url]
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night5/break';
const url = process.argv[3] ?? 'http://localhost:5181/';
mkdirSync(out, { recursive: true });
const b = await launch();
for (const [w, h] of [[360, 640], [390, 844]]) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
  const brk = () => p.evaluate(() => document.querySelector('.brk')?.textContent ?? '(none)');
  let s;
  do { // a round whose step 1 succeeds
    await p.evaluate(() => { void window.__dev.start(); }); await new Promise((r) => setTimeout(r, 300)); await idle();
    console.log(`${w}x${h} waiting for step 1: ${await brk()}`);
    await p.evaluate(() => { void window.__dev.shoot(); }); await new Promise((r) => setTimeout(r, 300)); await idle();
    s = await p.evaluate(() => window.__dev.state());
  } while (s.phase !== 'decide');
  for (let i = 0; i < 4; i++) {
    console.log(`${w}x${h} step ${s.step}: ${await brk()}`);
    await p.evaluate(() => window.__dev.force('success'));
    await p.evaluate(() => { void window.__dev.shoot(); }); await new Promise((r) => setTimeout(r, 300)); await idle();
    s = await p.evaluate(() => window.__dev.state());
    if (s.phase !== 'decide') break;
  }
  console.log(`${w}x${h} step ${s.step}: ${await brk()}`);
  await p.screenshot({ path: `${out}/${w}x${h}-in-round.png` });
  while ((await p.evaluate(() => window.__dev.state())).phase === 'decide') { await p.evaluate(() => { void window.__dev.shoot(); }); await new Promise((r) => setTimeout(r, 300)); await idle(); }
  await new Promise((r) => setTimeout(r, 4000));
  console.log(`${w}x${h} after the round: ${await brk()}`);
  await p.screenshot({ path: `${out}/${w}x${h}-after-round.png` });
  await p.close();
}
await b.close();
