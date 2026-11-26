// Night 4, Part 5: phone layout pictures at 360x640, 390x844 and 412x915, each state (between rounds, during a round
// with SHOOT and CASH OUT, after a round), plus a check that nothing is cut off, overlaps or scrolls.
// node scripts/layout-shots.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = process.argv[2] ?? 'bench/results/night4/layout';
mkdirSync(out, { recursive: true });
const report = [];
const b = await launch();
for (const [w, h] of [[360, 640], [390, 844], [412, 915]]) {
  const p = await b.newPage();
  p.on('pageerror', (e) => report.push(`${w}x${h} pageerror ${e.message}`));
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.goto('http://localhost:5181/', { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
  // checks: every visible element of the screen inside the window; buttons >= 44 px; top bar items do not overlap
  const check = (state) => p.evaluate((state) => {
    const W = innerWidth, H = innerHeight, bad = [];
    if (document.documentElement.scrollHeight > H + 1 || document.documentElement.scrollWidth > W + 1) bad.push('page scrolls');
    for (const el of document.querySelectorAll('#screen button, #screen .balance, #screen .ladder, #screen .footer, #screen .table')) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || cs.display === 'none' || cs.visibility === 'hidden' || el.closest('#dev') || el.closest('#rules')) continue;
      if (r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5) bad.push(`cut off: ${el.id || el.className} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
      if (el.tagName === 'BUTTON' && !el.closest('.footer') && el.id !== 'flag' && (r.width < 39.5 || r.height < 39.5)) bad.push(`small button ${el.id || el.className || el.textContent} ${r.width}x${r.height}`);
      if (el.tagName === 'BUTTON' && !el.closest('.footer') && el.id !== 'flag' && !el.classList.contains('lvl') && (r.width < 43.5 || r.height < 43.5)) bad.push(`button under 44 px ${el.id || el.className} ${r.width}x${r.height}`);
    }
    const rect = (s) => document.querySelector(s).getBoundingClientRect();
    const c = rect('#centre'), l = rect('.top .left'), rr = rect('.top .right');
    if (c.width && (l.right > c.left || rr.left < c.right)) bad.push('top bar overlaps the centre slot');
    const mid = (c.left + c.right) / 2;
    if (c.width && Math.abs(mid - W / 2) > 1) bad.push(`centre slot off the centre line by ${(mid - W / 2).toFixed(1)} px`);
    const balls = [...document.querySelectorAll('#centre .lvl')].map((x) => Math.round(x.getBoundingClientRect().width));
    const t = rect('.table');
    return `${state}: ${bad.length ? 'PROBLEMS ' + bad.join('; ') : 'ok'} | level balls ${balls.join('/') || '-'} px, balance font ${getComputedStyle(document.getElementById('balance')).fontSize}, table ${Math.round(t.width)}x${Math.round(t.height)} at y ${Math.round(t.top)}`;
  }, state);
  report.push(`${w}x${h} ${await check('between rounds')}`);
  await p.screenshot({ path: `${out}/${w}x${h}-1-between.png` });
  await p.evaluate(() => { void window.__dev.start(); });
  await new Promise((r) => setTimeout(r, 400));
  report.push(`${w}x${h} ${await check('racking / break-off')}`);
  await p.screenshot({ path: `${out}/${w}x${h}-2-break.png` });
  await p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
  const st = await p.evaluate(() => window.__dev.state());
  report.push(`${w}x${h} ${await check(st.phase === 'decide' ? 'during a round (SHOOT / CASH OUT)' : 'after a failed step 1')}`);
  await p.screenshot({ path: `${out}/${w}x${h}-3-${st.phase === 'decide' ? 'round' : 'over'}.png` });
  // a long balance must not touch the centre slot
  if (st.phase === 'decide') await p.click('#bCash'); // between rounds again (the level balls are shown)
  await p.waitForFunction('window.__dev.state().busy === null && document.getElementById("bStart")', { timeout: 60000, polling: 200 });
  await new Promise((r) => setTimeout(r, 3000)); // the balance count-up has finished
  await p.evaluate(() => window.__dev.setBalance(1234567.89));
  await new Promise((r) => setTimeout(r, 300));
  report.push(`${w}x${h} ${await check('long balance 1,234,567.89')}`);
  await p.screenshot({ path: `${out}/${w}x${h}-4-long-balance.png` });
  await p.close();
}
await b.close();
writeFileSync(`${out}/check.txt`, report.join('\n') + '\n');
console.log(report.join('\n'));
