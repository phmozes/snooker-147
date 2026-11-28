// 2026-11-28 part 7 (options page only, no change to the game): how the success chance of the next shot could look.
// Stills of the real game at 390x844, mid-round (CASH OUT and SHOOT on screen); the chance is drawn on top by this
// script only (DOM changes in the page), never by the game. The values are the config p of each step (6 reds).
// Needs the dev server on port 5181.   node scripts/chance-shots.mjs [outDir]
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'mockups/chance';
mkdirSync(out, { recursive: true });
// the config p table of 6 reds (the first `p: [...]` in the levels list) and the ladder strip window
const cfg = readFileSync('src/config/game.config.ts', 'utf8');
const P6 = JSON.parse(/reds: 6,[\s\S]*?p: (\[[^\]]+\])/.exec(cfg)[1]);
const strip = /ladderStrip: \{ previous: (\d+), next: (\d+) \}/.exec(cfg);
const PREV = +strip[1], NEXT = +strip[2];
const pct = (p) => `${Math.round(p * 100)}%`;
const log = [`6 reds p: ${P6.map(pct).join(' ')}`];
const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => log.push(`pageerror ${e.message}`));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto('http://localhost:5181/', { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
const settle = () => new Promise((r) => setTimeout(r, 2500));
await p.evaluate(() => window.__dev.force('success'));
await p.evaluate(() => { void window.__dev.start(); }); await idle();
for (let k = 0; k < 3; k++) { await p.evaluate(() => { void window.__dev.shoot(); }); await idle(); } // steps 1-3: red, colour, red
await p.evaluate(() => window.__dev.force(null));
await settle();
const st = await p.evaluate(() => window.__dev.state());
log.push(`state: ${JSON.stringify(st)}`);
const step = st.step, nextP = P6[step]; // the chance of the next shot = p of step `step + 1`
log.push(`next step ${step + 1}: p ${nextP} -> ${pct(nextP)}`);
await p.evaluate(() => {
  for (const id of ['devTag', 'flag']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
  for (const e of document.querySelectorAll('#screen *')) if (e.children.length === 0 && /^solver \d/.test(e.textContent ?? '')) e.style.visibility = 'hidden';
});
const save = async (name, what) => {
  const f = `${out}/${name}.jpg`;
  await p.screenshot({ path: f, type: 'jpeg', quality: 80 });
  log.push(`${name}.jpg ${what} ${Math.round(statSync(f).size / 1024)} KB`);
};
const reset = () => p.evaluate(() => { for (const e of document.querySelectorAll('[data-old]')) { e.innerHTML = e.dataset.old; delete e.dataset.old; e.removeAttribute('style'); } document.querySelectorAll('.chanceAdd').forEach((e) => e.remove()); });
// A: today
await save('A-none', 'no chance on screen');
// B: in the hint line
const hintB = await p.evaluate((txt) => { const h = document.querySelector('#bottom .hint'); h.dataset.old = h.innerHTML; h.innerHTML += ` · ${txt}`; return h.textContent; }, pct(nextP));
await save('B-hint', hintB); await reset();
// C: a small % under each ladder chip (the chance of reaching that chip's step)
const L = P6.length, count = PREV + 1 + NEXT, first = Math.max(1, Math.min(L - count + 1, step - PREV));
const chipP = Array.from({ length: count }, (_, i) => pct(P6[first + i - 1]));
await p.evaluate((chipP) => {
  document.querySelectorAll('#ladder .chip').forEach((c, i) => {
    c.dataset.old = c.innerHTML;
    c.style.flexDirection = 'column'; c.style.lineHeight = '1.05'; c.style.justifyContent = 'center';
    c.innerHTML = `<span>${c.textContent}</span><small style="font-size:9.5px;font-weight:600;opacity:.75;letter-spacing:.02em">${chipP[i]}</small>`;
  });
}, chipP);
await save('C-chips', `chips steps ${first}-${first + count - 1}: ${chipP.join(' ')}`); await reset();
// D: one small line above SHOOT (SHOOT is 16 px lower to make room; the bottom area keeps its height)
await p.evaluate((txt) => {
  const s = document.getElementById('bShoot'); s.dataset.old = s.innerHTML; s.style.height = '50px';
  const d = document.createElement('div'); d.className = 'chanceAdd';
  d.style.cssText = 'text-align:center;font-size:12px;letter-spacing:.04em;color:#d8e0dc;height:6px;line-height:6px;margin:-4px 0 0';
  d.innerHTML = `Chance to pot: <b style="color:#f2c94c">${txt}</b>`; s.before(d);
}, pct(nextP));
await save('D-above-shoot', `Chance to pot: ${pct(nextP)}`); await reset();
await b.close();
writeFileSync(`${out}/shots.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
