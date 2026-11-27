// Night 5: the cue in the game next to the approved mockup (docs/cue-options.html) for the mockup's three positions.
// node scripts/cue-compare.mjs [outDir] [baseUrl] [tau]   (baseUrl default http://localhost:5181; tau = s after SHOOT)
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night5/cue';
const base = process.argv[3] ?? process.env.BASE_URL ?? 'http://localhost:5181';
const tau = Number(process.argv[4] ?? 0.2);
mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const names = ['middle', 'near-cushion', 'balls-behind'];
for (let i = 0; i < 3; i++) {
  await p.goto(`${base}/docs/cue-options.html?shot=${i}&freeze=${tau}#C1`, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.__ready === true', { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 800));
  const m = await p.evaluate(() => document.getElementById('result').textContent);
  await p.screenshot({ path: `${out}/${i + 1}-${names[i]}-mockup.png` });
  await p.goto(`${base}/?level=reds15`, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 800));
  const el = await p.evaluate((k, t) => window.__dev.cueExample(k, t), i, tau);
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: `${out}/${i + 1}-${names[i]}-game.png` });
  console.log(names[i], 'mockup:', m, '| game elevation', el);
}
await b.close();
