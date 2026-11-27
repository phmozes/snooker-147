// 2026-11-27: camera angle comparison pictures (mockups/camera-angles). The game is NOT changed: the screenshot browser
// gets edited copies of two modules (camera angle in game.config.ts, the frozen ball position in cueExamples.ts) and,
// for one option, a CSS rule for a smaller bottom area. node scripts/camera-angles.mjs [baseUrl]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const base = process.argv[2] ?? 'http://localhost:5181';
const out = 'mockups/camera-angles';
mkdirSync(out, { recursive: true });

// frozen position: 6 reds spread out, colours on their spots, cue ball near the blue (blue spot = 0,0)
const REDS = '[[-0.30, 0.55], [-0.62, -0.75], [0.55, 1.25], [0.45, 0.35], [-0.20, 1.05], [0.30, -0.95]]';
const CUE = '{ x: 0.10, y: -0.17 }';
// smaller bottom area (option 3): 144 -> 104 px (short screens 112 -> 84 px), the buttons a little lower
const SMALL_BOTTOM = `
  #screen .bottom { height: 104px !important; gap: 6px !important; margin-top: 4px !important; }
  #screen .cash { height: 38px !important; } #screen .big { height: 52px !important; }
  #screen.short .bottom { height: 84px !important; gap: 4px !important; margin-top: 2px !important; }
  #screen.short .cash { height: 32px !important; } #screen.short .big { height: 44px !important; font-size: 19px !important; }`;
const OPTIONS = [
  { id: 0, elev: 64, small: false, what: "Today's camera: 64° above the cloth, bottom area 144 px (112 px on a short screen)." },
  { id: 1, elev: 57, small: false, what: 'Camera lower: 64° → 57° above the cloth (7° lower). Bottom area unchanged.' },
  { id: 2, elev: 50, small: false, what: 'Camera much lower: 64° → 50° above the cloth (14° lower). Bottom area unchanged.' },
  { id: 3, elev: 64, small: true, what: 'Camera unchanged (64°). Bottom area smaller: 144 → 104 px (short screen 112 → 84 px), about 40 / 28 px more for the table.' },
];
const SIZES = [{ key: 'full', w: 390, h: 844 }, { key: 'inapp', w: 390, h: 664 }];

const b = await launch();
const results = [];
for (const o of OPTIONS) for (const s of SIZES) {
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.setCacheEnabled(false);
  await p.setRequestInterception(true);
  p.on('request', async (r) => {
    const u = r.url();
    const edit = u.includes('/src/config/game.config.ts') ? (t) => t.replace(/(label:\s*["']C middle["'],\s*elevationDeg:\s*)64/, `$1${o.elev}`)
      : u.includes('/src/view/cueExamples.ts') ? (t) => t.replace(/const REDS\s*=\s*\[[\s\S]*?\]\s*\];/, `const REDS = ${REDS};`).replace(/cue:\s*\{\s*x:\s*0?\.42,\s*y:\s*-0?\.35\s*\}/, `cue: ${CUE}`)
      : null;
    if (!edit) return r.continue();
    const res = await fetch(u, { headers: r.headers() });
    const t = await res.text(), t2 = edit(t);
    if (t2 === t) errs.push('edit did not apply: ' + u);
    r.respond({ status: 200, contentType: res.headers.get('content-type') ?? 'application/javascript', body: t2 });
  });
  await p.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 2 });
  await p.goto(`${base}/?level=reds6`, { waitUntil: 'networkidle0', timeout: 120000 });
  // developer-only labels are not in the real build: hidden here too
  await p.addStyleTag({ content: '#flag, #devTag, #devVer, #replayTag { display: none !important; }' + (o.small ? SMALL_BOTTOM : '') });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  await p.evaluate(() => { window.__dev.force('success'); void window.__dev.start(); });
  await p.waitForFunction('window.__dev.state().busy === null && window.__dev.state().phase === "decide"', { timeout: 300000, polling: 200 });
  // mid-round: step 1 played (forced success), CASH OUT on screen
  await p.evaluate(() => { window.__dev.force('success'); window.__dev.shoot(); });
  await new Promise((r) => setTimeout(r, 500));
  await p.waitForFunction('window.__dev.state().busy === null && window.__dev.state().phase === "decide" && window.__dev.state().cash', { timeout: 60000, polling: 200 })
    .catch(async (e) => { console.log('stuck:', JSON.stringify(await p.evaluate(() => window.__dev.state())), errs.join(' | ')); throw e; });
  await p.evaluate(() => window.__dev.force(null));
  await p.evaluate(() => window.dispatchEvent(new Event('resize'))); // layout again (after the CSS rule)
  await new Promise((r) => setTimeout(r, 2500)); // messages and count-ups finished
  await p.evaluate(() => window.__dev.cueExample(0, 0.2));
  await new Promise((r) => setTimeout(r, 600));
  const t = await p.evaluate(() => window.__dev.tableBox());
  const pct = Math.round(((t.x1 - t.x0) / t.vw) * 100);
  const name = `opt${o.id}-${s.key}.jpg`;
  await p.screenshot({ path: `${out}/${name}`, type: 'jpeg', quality: 80 });
  // all 6 pockets in view: the table box (fitEdge beyond the cushions) inside the canvas
  const inside = await p.evaluate((t) => { const c = document.querySelector('.table canvas').getBoundingClientRect();
    return t.x0 >= c.left - 0.5 && t.x1 <= c.right + 0.5 && t.y0 >= c.top - 0.5 && t.y1 <= c.bottom + 0.5; }, t);
  results.push({ option: o.id, size: s.key, w: s.w, h: s.h, pct, tableW: Math.round(t.x1 - t.x0), tableH: Math.round(t.y1 - t.y0), inside, errs });
  console.log(name, `${pct}% wide`, inside ? 'whole table in view' : 'TABLE CUT OFF', errs.join(' | '));
  await p.close();
}
await b.close();
writeFileSync(`${out}/results.json`, JSON.stringify({ options: OPTIONS, sizes: SIZES, results }, null, 1));
