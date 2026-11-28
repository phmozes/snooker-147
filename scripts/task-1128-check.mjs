// 2026-11-28 task check (dev server 5181): the bet screen (gap closed), the Rules box (text + chance table), a caption
// in the hint line (dev button), and the real captions met while auto-playing rounds. Writes stills + a log to <outDir>.
// node scripts/task-1128-check.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/2026-11-28/check';
mkdirSync(out, { recursive: true });
const log = [];
const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => log.push(`pageerror ${e.message}`));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto('http://localhost:5181/', { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const box = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; }, sel);
const lad = await box('#ladder'), row = await box('.betrow'), tbl = await box('.table'), start = await box('#bStart');
log.push(`bet screen: table ${JSON.stringify(tbl)} ladder ${JSON.stringify(lad)} betrow ${JSON.stringify(row)} start ${JSON.stringify(start)}; gap ladder->betrow ${row.top - lad.bottom} px`);
log.push(`START font-weight: ${await p.evaluate(() => getComputedStyle(document.getElementById('bStart')).fontWeight)}`);
await p.screenshot({ path: `${out}/bet-screen.jpg`, type: 'jpeg', quality: 78 });
await p.click('#rulesBtn');
await new Promise((r) => setTimeout(r, 300));
log.push(`rules text: ${await p.evaluate(() => [...document.querySelectorAll('#rules li')].slice(0, 5).map((l) => l.textContent).join(' | '))}`);
log.push(`rules table rows: ${await p.evaluate(() => document.querySelectorAll('#rules table.chances tbody tr').length)}`);
await p.screenshot({ path: `${out}/rules-box.jpg`, type: 'jpeg', quality: 78 });
await p.evaluate(() => document.getElementById('rules').classList.remove('open'));
// start a round; the in-round table must keep its size
await p.evaluate(() => window.__dev.force('success'));
await p.evaluate(() => { void window.__dev.start(); });
await p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
log.push(`in round: table ${JSON.stringify(await box('.table'))} ladder ${JSON.stringify(await box('#ladder'))}`);
// a dev caption button
log.push(`dev caption buttons: ${await p.evaluate(() => { document.getElementById('menu').click(); const bs = [...document.querySelectorAll('#devCaptions button')]; const t = bs.map((x) => x.textContent).join(' / '); bs.find((x) => x.textContent === 'FRAME BALL')?.click(); document.getElementById('menu').click(); return t; })}`);
await new Promise((r) => setTimeout(r, 200));
log.push(`dev caption: "${await p.evaluate(() => document.querySelector('#bottom .hint').textContent)}" class ${await p.evaluate(() => document.querySelector('#bottom .hint').className)}`);
await p.screenshot({ path: `${out}/caption-dev.jpg`, type: 'jpeg', quality: 78 });
// watch the hint line during a forced-success round: every caption that appears
await new Promise((r) => setTimeout(r, 3200));
await p.evaluate(() => { window.__caps = []; let last = ''; setInterval(() => { const h = document.querySelector('#bottom .hint'); if (h && h.classList.contains('capB') && h.textContent !== last) { window.__caps.push(`${window.__dev.state().step}:${h.textContent}`); } last = h?.classList.contains('capB') ? h.textContent : ''; }, 50); });
for (let k = 0, tries = 0; k < 18 && tries < 40; k++, tries++) {
  const st = await p.evaluate(() => window.__dev.state());
  if (st.phase !== 'decide') { // step 1 comes from the break library and cannot be forced: a new round
    if (st.step >= 1) break;
    await new Promise((r) => setTimeout(r, 3500));
    await p.evaluate(() => { void window.__dev.start(); });
    await p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 100 });
    k--; continue;
  }
  await p.evaluate(() => window.__dev.force('success'));
  await new Promise((r) => setTimeout(r, 400));
  await p.evaluate(() => { void window.__dev.shoot(); });
  await p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 100 });
}
log.push(`captions seen in a forced 6-red clearance (step:text): ${await p.evaluate(() => window.__caps.join(', '))}`);
log.push(`end: ${JSON.stringify(await p.evaluate(() => window.__dev.state()))}`);
await b.close();
writeFileSync(`${out}/check.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
