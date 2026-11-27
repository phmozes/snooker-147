// 2026-11-27: table markings (baulk line, D, spots). Whole table at phone size in the game, plus the mockup page
// (docs/cue-options.html uses the same table drawing). node scripts/markings-shots.mjs [outDir] [url]
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night6/markings';
const url = process.argv[3] ?? 'http://localhost:5181/';
mkdirSync(out, { recursive: true });
const b = await launch();
for (const [w, h] of [[390, 844], [360, 640]]) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 3 });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 800));
  await p.screenshot({ path: `${out}/game-${w}x${h}.png` });
  await p.evaluate(() => window.__dev.hideBalls());
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: `${out}/game-${w}x${h}-no-balls.png` });
  await p.close();
}
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(url + 'docs/cue-options.html', { waitUntil: 'networkidle0', timeout: 120000 });
await new Promise((r) => setTimeout(r, 2500));
await p.screenshot({ path: `${out}/mockup-cue-options-390x844.png` });
await b.close();
console.log('done');
