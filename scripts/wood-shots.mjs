// Night 5: phone-size pictures of the table, to judge the wood of the rails (before/after).
// node scripts/wood-shots.mjs [outDir] [prefix] [url]
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night5/wood';
const prefix = process.argv[3] ?? 'after';
const url = process.argv[4] ?? 'http://localhost:5181/';
mkdirSync(out, { recursive: true });
const b = await launch();
for (const [w, h] of [[390, 844], [360, 640]]) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 3 });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('snooker147.look', 'club'); } catch {} });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 800));
  await p.screenshot({ path: `${out}/${prefix}-${w}x${h}.png` });
  await p.close();
}
await b.close();
console.log('ok');
