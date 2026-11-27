// 2026-11-27 camera 57°: the same mid-round position as mockups/camera-angles (6 reds, colours on spots, cue ball near
// the blue) with the game's real camera, at full screen, in-app and a short screen; plus the three cue examples.
// The ball position comes from an edited copy of cueExamples.ts inside the screenshot browser only.
// node scripts/camera57-shots.mjs [outDir] [baseUrl]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/camera57';
const base = process.argv[3] ?? 'http://localhost:5181';
mkdirSync(out, { recursive: true });
const REDS = '[[-0.30, 0.55], [-0.62, -0.75], [0.55, 1.25], [0.45, 0.35], [-0.20, 1.05], [0.30, -0.95]]';
const SIZES = [['full', 390, 844], ['inapp', 390, 664], ['short', 360, 640]];
const b = await launch();
const lines = [];
for (const [key, w, h] of SIZES) {
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.setCacheEnabled(false);
  await p.setRequestInterception(true);
  p.on('request', async (r) => {
    if (!r.url().includes('/src/view/cueExamples.ts')) return r.continue();
    const res = await fetch(r.url(), { headers: r.headers() });
    const t = await res.text();
    const t2 = t.replace(/const REDS\s*=\s*\[[\s\S]*?\]\s*\];/, `const REDS = ${REDS};`).replace(/cue:\s*\{\s*x:\s*0?\.42,\s*y:\s*-0?\.35\s*\}/, 'cue: { x: 0.10, y: -0.17 }');
    if (t2 === t) errs.push('position edit did not apply');
    r.respond({ status: 200, contentType: res.headers.get('content-type') ?? 'application/javascript', body: t2 });
  });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.goto(`${base}/?level=reds6`, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.addStyleTag({ content: '#flag, #devTag, #devVer, #replayTag { display: none !important; }' }); // not in the real build
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  await p.evaluate(() => { window.__dev.force('success'); void window.__dev.start(); });
  await p.waitForFunction('window.__dev.state().busy === null && window.__dev.state().phase === "decide"', { timeout: 300000, polling: 200 });
  await p.evaluate(() => { window.__dev.force('success'); window.__dev.shoot(); });
  await new Promise((r) => setTimeout(r, 500));
  await p.waitForFunction('window.__dev.state().busy === null && window.__dev.state().cash', { timeout: 300000, polling: 200 });
  await p.evaluate(() => window.__dev.force(null));
  await new Promise((r) => setTimeout(r, 2500));
  for (const i of [0, 1, 2]) {
    const el = await p.evaluate((i) => window.__dev.cueExample(i, 0.2), i);
    await new Promise((r) => setTimeout(r, 500));
    const t = await p.evaluate(() => window.__dev.tableBox());
    const inside = await p.evaluate((t) => { const c = document.querySelector('.table canvas').getBoundingClientRect();
      return t.x0 >= c.left - 0.5 && t.x1 <= c.right + 0.5 && t.y0 >= c.top - 0.5 && t.y1 <= c.bottom + 0.5; }, t);
    const breakLine = await p.evaluate(() => { const e = document.querySelector('.hint'); const r = e?.getBoundingClientRect();
      return e && r.height > 0 && r.bottom <= innerHeight ? e.textContent.trim().replace(/\s+/g, ' ') : 'MISSING'; });
    const name = i === 0 ? `${key}-${w}x${h}.png` : `${key}-${w}x${h}-cue${i}.png`;
    await p.screenshot({ path: `${out}/${name}` });
    const line = `${name}: table ${Math.round(t.x1 - t.x0)}x${Math.round(t.y1 - t.y0)} px = ${Math.round(((t.x1 - t.x0) / t.vw) * 100)}% of the width; ` +
      `6 pockets ${inside ? 'fully in view' : 'CUT OFF'}; cue elevation ${el}°; bottom line "${breakLine}"${errs.length ? ' ERRORS ' + errs.join(' | ') : ''}`;
    lines.push(line);
    console.log(line);
    if (key !== 'inapp') break; // the cue examples once (in-app size)
  }
  await p.close();
}
await b.close();
writeFileSync(`${out}/table-width.txt`, lines.join('\n') + '\n');
