// 2026-11-27: how much of the screen width the table (with its rails) takes, per window size; with pictures.
// node scripts/table-size.mjs [outDir] [url]
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night5/layout';
const url = process.argv[3] ?? 'http://localhost:5181/';
mkdirSync(out, { recursive: true });
const b = await launch();
// phones, and the same phones in an in-app browser (address bar + bottom bar take about 100-180 px of height)
const sizes = [[360, 640], [390, 844], [412, 915], [360, 560], [390, 664], [412, 740], [390, 600]];
for (const [w, h] of sizes) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 800));
  const t = await p.evaluate(() => window.__dev.tableBox());
  const wide = (t.x1 - t.x0) / t.vw;
  console.log(`${w}x${h}: table ${Math.round(t.x1 - t.x0)} px wide = ${(wide * 100).toFixed(0)}% of the width, ${Math.round(t.y1 - t.y0)} px high (canvas ${Math.round(t.canvasH)} px)`);
  await p.screenshot({ path: `${out}/${w}x${h}.png` });
  await p.close();
}
await b.close();
