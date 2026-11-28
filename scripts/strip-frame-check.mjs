// 2026-11-28 bug check: the ladder strip's frame (the end line "WON … · x…", or the chips) must be fully visible and not
// covered by anything (the 3D canvas above it, the bottom area below it), in every state, for 6 / 10 / 15 reds, at
// 390x844 and at in-app phone sizes (360 wide, shorter). Measures boxes + hit-tests the frame's top and bottom edges,
// and saves a crop round the strip. Needs the dev server on port 5181 (or BASE=<url>, e.g. the test build: it posts
// nothing to the PC).
// node scripts/strip-frame-check.mjs <outDir> [WxH,WxH,...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/2026-11-28/strip';
const sizes = (process.argv[3] ?? '390x844,360x640,360x720').split(',').map((s) => s.split('x').map(Number));
mkdirSync(out, { recursive: true });
const rows = [];
const b = await launch();
for (const [w, h] of sizes) for (const level of (process.env.LEVELS ?? 'reds6,reds10,reds15').split(',')) {
  const p = await b.newPage();
  p.on('pageerror', (e) => rows.push(`pageerror ${e.message}`));
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(process.env.BASE ?? 'http://localhost:5181/', { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  await p.evaluate((l) => document.querySelector(`.lvl[data-l="${l}"]`)?.click(), level);
  await new Promise((r) => setTimeout(r, 400));
  const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 600000, polling: 100 });
  const betReady = () => p.waitForFunction(() => { const s = document.getElementById('bStart'); return s && !s.disabled; }, { timeout: 600000, polling: 100 });
  const measure = async (state) => {
    await new Promise((r) => setTimeout(r, 250));
    const m = await p.evaluate(() => {
      const lad = document.getElementById('ladder').getBoundingClientRect();
      const end = document.querySelector('#ladder .endline');
      const frames = end ? [end] : [...document.querySelectorAll('#ladder .chip')];
      const canvas = document.querySelector('.table canvas').getBoundingClientRect();
      const table = document.querySelector('.table').getBoundingClientRect();
      const bottom = document.getElementById('bottom').getBoundingClientRect();
      let bad = 0, outside = 0; const hits = new Set();
      for (const f of frames) {
        const r = f.getBoundingClientRect();
        if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) outside++;
        for (const y of [r.top + 0.5, r.bottom - 0.5]) for (let x = r.left + 12; x <= r.right - 12; x += 6) {
          const e = document.elementFromPoint(x, y);
          if (!e || !(f === e || f.contains(e))) { bad++; hits.add(e ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${e.className}` : 'none'); }
        }
      }
      const f0 = frames[0]?.getBoundingClientRect();
      const drawn = window.__dev.tableBox().y1; // the drawn table's bottom edge (rail incl.), CSS px
      return { kind: end ? 'endline' : `${frames.length} chips`, frameTop: Math.round(f0.top * 10) / 10, frameBottom: Math.round(f0.bottom * 10) / 10,
        stripTop: Math.round(lad.top * 10) / 10, stripBottom: Math.round(lad.bottom * 10) / 10, canvasBottom: Math.round(canvas.bottom * 10) / 10,
        tableH: Math.round(table.height * 10) / 10, gapAbove: Math.round((f0.top - canvas.bottom) * 10) / 10, gapDrawn: Math.round((f0.top - drawn) * 10) / 10, gapBelow: Math.round((bottom.top - f0.bottom) * 10) / 10,
        short: document.getElementById('screen').classList.contains('short'), bad, outside, hits: [...hits].join(' ') };
    });
    const file = `${w}x${h}-${level}-${state}.jpg`;
    const top = Math.max(0, m.stripTop - 70);
    await p.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80, clip: { x: 0, y: top, width: w, height: Math.min(h - top, 170) } });
    const pass = m.bad === 0 && m.outside === 0;
    rows.push(`${pass ? 'PASS' : 'FAIL'} | ${w}x${h}${m.short ? ' (short)' : ''} | ${level} | ${state} | ${m.kind} | frame ${m.frameTop}-${m.frameBottom}, strip ${m.stripTop}-${m.stripBottom}, canvas bottom ${m.canvasBottom}, table h ${m.tableH} | gap above ${m.gapAbove} (to the drawn rail ${m.gapDrawn}), below ${m.gapBelow} | covered edge points ${m.bad}${m.hits ? ` (${m.hits})` : ''} | ${file}`);
    console.log(rows[rows.length - 1]);
  };
  const startToStep1 = async () => { // step 1 comes from the break library and cannot be forced: new rounds until it pots
    for (let k = 0; k < 30; k++) {
      await betReady();
      await p.evaluate(() => { void window.__dev.start(); }); await idle(); // the break-off; then the game waits (RULES B.2)
      await p.evaluate(() => { void window.__dev.shoot(); }); await idle(); // step 1
      const s = await p.evaluate(() => window.__dev.state());
      if (s.phase === 'decide' && s.step === 1) return;
    }
    throw new Error('step 1 never potted');
  };
  const shootAs = async (f) => { await p.evaluate((f) => window.__dev.force(f), f); await new Promise((r) => setTimeout(r, 300)); await p.evaluate(() => { void window.__dev.shoot(); }); await idle(); };
  await measure('bet-first');
  await startToStep1();
  await shootAs('success');
  await measure('in-round');
  await p.click('#bCash'); await idle();
  await measure('after-cashout');
  await startToStep1(); await shootAs('plainMiss');
  await measure('after-miss');
  await startToStep1(); await shootAs('reRack');
  await measure('after-rerack');
  await startToStep1(); await p.evaluate(() => window.__dev.force(null));
  await p.evaluate(() => window.__dev.clearLast());
  await p.waitForFunction(() => { const s = window.__dev.state(); return s.busy === null && s.phase === 'over'; }, { timeout: 900000, polling: 200 });
  const end = await p.evaluate(() => window.__dev.state().end);
  await measure(`after-clearance${end && end.includes('clearance') ? '' : '-NOT-CLEARED'}`);
  await p.close();
}
await b.close();
writeFileSync(`${out}/check.txt`, rows.join('\n') + '\n');
console.log(`${rows.filter((r) => r.startsWith('PASS')).length} PASS, ${rows.filter((r) => r.startsWith('FAIL')).length} FAIL`);
