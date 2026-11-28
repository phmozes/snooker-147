// Night 8 step 5 (options page only, no change to the game): stills of the real game screen at 390x844 with a caption
// drawn on top in three styles (A above the table, B in the hint line, C over the top bar). The caption is added to the
// page by this script only (a DOM element), never by the game. Needs the dev server on port 5181.
// node scripts/captions-shots.mjs [outDir]
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'mockups/captions';
mkdirSync(out, { recursive: true });
const log = [];
const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => log.push(`pageerror ${e.message}`));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto('http://localhost:5181/', { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
const settle = () => new Promise((r) => setTimeout(r, 2500)); // balance count-up and strip animation finished

// caption styles: injected into #screen, positioned from the real layout (never over the cloth)
const STYLE = `
  .capA { position: absolute; left: 0; right: 0; display: flex; justify-content: center; pointer-events: none; z-index: 30; }
  .capA span { font: 800 15px/1 system-ui, sans-serif; letter-spacing: .14em; color: #10140f; background: #f2c94c;
    padding: 6px 14px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,.45); }
  .capA.bad span { background: #d9534f; color: #fff; }
  .capB { font-weight: 800 !important; letter-spacing: .14em !important; color: #f2c94c !important; font-size: 13px !important; }
  .capB.bad { color: #ff6b5e !important; }
  .capC { position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; z-index: 30;
    background: linear-gradient(180deg, #1d2a24 0%, #0f1714 100%); border-bottom: 2px solid #f2c94c; pointer-events: none; }
  .capC span { font: 900 24px/1 system-ui, sans-serif; letter-spacing: .12em; color: #f2c94c; text-shadow: 0 2px 0 #000; }
  .capC.bad { border-bottom-color: #d9534f; } .capC.bad span { color: #ff6b5e; }`;

async function caption(style, text, bad) {
  return p.evaluate((style, text, bad, css) => {
    if (!document.getElementById('capcss')) { const s = document.createElement('style'); s.id = 'capcss'; s.textContent = css; document.head.appendChild(s); }
    const scr = document.getElementById('screen'), sr = scr.getBoundingClientRect();
    const top = document.getElementById('top').getBoundingClientRect();
    const tb = window.__dev.tableBox();
    const info = { topBottom: Math.round(top.bottom - sr.top), tableTop: Math.round(tb.y0 - sr.top) };
    if (style === 'A') { // a slim banner in the gap between the top bar and the table (over the top rail at most)
      const d = document.createElement('div'); d.className = `capA cap${bad ? ' bad' : ''}`;
      d.style.top = `${top.bottom - sr.top + 2}px`; d.innerHTML = `<span>${text}</span>`; scr.appendChild(d);
      const r = d.querySelector('span').getBoundingClientRect(); info.capBottom = Math.round(r.bottom - sr.top);
    } else if (style === 'B') { // the hint line
      const h = document.querySelector('#bottom .hint');
      if (h) { h.dataset.old = h.innerHTML; h.innerHTML = text; h.classList.add('capB'); if (bad) h.classList.add('bad'); }
      info.hint = !!h;
    } else { // C: over the whole top bar for the caption's time
      const d = document.createElement('div'); d.className = `capC cap${bad ? ' bad' : ''}`;
      d.style.top = `${top.top - sr.top}px`; d.style.height = `${top.height}px`; d.innerHTML = `<span>${text}</span>`; scr.appendChild(d);
    }
    return info;
  }, style, text, bad, STYLE);
}
const clear = () => p.evaluate(() => {
  document.querySelectorAll('.cap').forEach((e) => e.remove());
  const h = document.querySelector('#bottom .capB'); if (h) { h.innerHTML = h.dataset.old ?? ''; h.classList.remove('capB', 'bad'); }
});
// developer-only marks are hidden in the stills (they are not in the real build): the DEV / FORCED tag, the weird-shot
// flag, the solver version, and the " · FORCED" the dev build adds to the strip line of a forced round
const hideDev = () => p.evaluate(() => {
  for (const id of ['devTag', 'flag']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
  for (const e of document.querySelectorAll('#screen *')) if (e.children.length === 0 && /^solver \d/.test(e.textContent ?? '')) e.style.visibility = 'hidden';
  for (const e of document.querySelectorAll('#screen *')) if (e.children.length === 0 && (e.textContent ?? '').includes(' · FORCED')) e.textContent = e.textContent.replace(' · FORCED', '');
});
async function stills(state, text, bad) {
  await hideDev();
  for (const s of ['A', 'B', 'C']) {
    const info = await caption(s, text, bad);
    const f = `${out}/${s}-${state}.jpg`;
    await p.screenshot({ path: f, type: 'jpeg', quality: 78 });
    log.push(`${s}-${state}.jpg ${text} ${JSON.stringify(info)} ${Math.round(statSync(f).size / 1024)} KB`);
    await clear();
  }
}

// state 1: before a shot (a round waiting for SHOOT after a pot) -> MAXIMUM IS ON
await p.evaluate(() => window.__dev.force('success'));
await p.evaluate(() => { void window.__dev.start(); }); await idle();
await p.evaluate(() => { void window.__dev.shoot(); }); await idle(); // step 1 (a red)
await p.evaluate(() => { void window.__dev.shoot(); }); await idle(); // step 2 (a colour)
await settle();
log.push(`state pre: ${JSON.stringify(await p.evaluate(() => window.__dev.state()))}`);
await stills('pre', 'MAXIMUM IS ON', false);
// state 2: right after a pot -> CENTURY
await p.evaluate(() => { void window.__dev.shoot(); }); await idle();
await settle();
log.push(`state pot: ${JSON.stringify(await p.evaluate(() => window.__dev.state()))}`);
await stills('pot', 'CENTURY', false);
// state 3: right after a miss -> MISSED
await p.evaluate(() => window.__dev.force('plainMiss'));
await p.evaluate(() => { void window.__dev.shoot(); }); await idle();
await settle();
log.push(`state miss: ${JSON.stringify(await p.evaluate(() => window.__dev.state()))}`);
await stills('miss', 'MISSED', true);
await b.close();
writeFileSync(`${out}/shots.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
