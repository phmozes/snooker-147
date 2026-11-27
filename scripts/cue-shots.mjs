// Night 4, Part 4: pictures of the cue in the real game during the stroke (slow motion), for a few shots.
// node scripts/cue-shots.mjs [outDir] [shots] [baseUrl]
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night4/cue';
const n = Number(process.argv[3] ?? 4);
const base = process.argv[4] ?? process.env.BASE_URL ?? 'http://localhost:5181'; // night 5: a worktree's own server
mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(`${base}/?level=reds15`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
for (let i = 0; i < n; i++) {
  let s = await p.evaluate(() => window.__dev.state());
  if (s.phase !== 'decide') { await p.evaluate(() => window.__dev.setSlow(4)); await p.evaluate(() => { void window.__dev.start(); }); await new Promise((r) => setTimeout(r, 300)); await idle(); s = await p.evaluate(() => window.__dev.state()); if (s.phase !== 'decide') { i--; continue; } }
  await p.evaluate(() => window.__dev.force('success'));
  const n0 = (await p.evaluate(() => window.__dev.lastRec()?.n)) ?? 0;
  await p.evaluate(() => window.__dev.setSlow(0.02)); // 50x slower: the 0.25 s stroke takes 12.5 s
  await p.evaluate(() => { void window.__dev.shoot(); });
  await p.waitForFunction((k) => (window.__dev.lastRec()?.n ?? 0) > k, { timeout: 300000, polling: 50 }, n0);
  await new Promise((r) => setTimeout(r, 4000)); // about 0.08 s into the stroke: the cue is pulled back
  await p.screenshot({ path: `${out}/shot${i + 1}-a-backswing.png` });
  await new Promise((r) => setTimeout(r, 6500)); // about 0.21 s: just before the tip reaches the cue ball
  await p.screenshot({ path: `${out}/shot${i + 1}-b-hit.png` });
  console.log('shot', i + 1, s.code, 'step', s.step + 1);
  await p.evaluate(() => window.__dev.setSlow(4));
  await idle();
}
await b.close();
