// Night 7: check the production build the way it will be hosted. Serve a folder that holds dist/ under a sub-path
// with a plain static server, then: node scripts/static-build-check.mjs <url of the sub-folder> [outDir]
// Plays one full round at phone size (390x844) with real button taps and fails on any console error, page error,
// failed request, or request outside the sub-folder (data: and blob: URLs are inside the page).
import { mkdirSync } from 'node:fs';
import { launch } from './shot.mjs';
const url = process.argv[2] ?? 'http://localhost:5190/some/sub/folder/';
const out = process.argv[3] ?? 'bench/results/night7/static-build';
mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage();
const errors = [], failed = [], outside = [], requests = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`); });
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
p.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.url()} HTTP ${r.status()}`); });
p.on('request', (r) => { const u = r.url(); requests.push(u); if (!u.startsWith(url) && !/^(data|blob):/.test(u)) outside.push(u); });
// workers make their own requests: watch them too
b.on('targetcreated', async (t) => { if (t.type() === 'worker') { const w = await t.worker(); w?.on('console', (m) => { if (m.type() === 'error') errors.push(`worker: ${m.text()}`); }); } });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.disabled; }, sel);
const checks = await p.evaluate(() => ({ dev: typeof window.__dev, game: typeof window.__game, flag: !!document.getElementById('flag'),
  devPanel: !!document.getElementById('dev'), menuShown: getComputedStyle(document.getElementById('menu')).visibility,
  devVer: !!document.getElementById('devVer'), footer: document.getElementById('footLeft').textContent, solverText: document.body.innerText.includes('solver') }));
await p.screenshot({ path: `${out}/1-start.png` });
// rounds until one gets past step 3 (so the solver worker runs too), at most 8 rounds
const steps = [];
let rounds = 0, longest = 0;
const t0 = Date.now();
while (rounds < 8 && longest < 4) {
  await p.waitForSelector('#bStart:not([disabled])', { timeout: 120000 });
  await p.tap('#bStart');
  rounds++;
  await sleep(800); // the end line of the last round goes away once the break starts
  let taps = 0;
  for (;;) {
    if (Date.now() - t0 > 1200000) { errors.push('rounds did not end in 20 min'); break; }
    if ((await p.$('.endline')) && !(await p.$('#bShoot'))) break;
    if (await has('#bShoot')) {
      const hint = await p.evaluate(() => document.querySelector('#bottom .hint')?.textContent ?? '');
      steps.push(`r${rounds}: ${hint}`);
      taps++;
      if (taps === 3) await p.screenshot({ path: `${out}/2-in-round.png` });
      await p.tap('#bShoot');
    }
    await sleep(300);
  }
  longest = Math.max(longest, taps);
  console.log(`round ${rounds}: ${taps} SHOOT taps, ${await p.evaluate(() => document.querySelector('.endline')?.textContent)}`);
}
await sleep(800);
const end = await p.evaluate(() => ({ end: document.querySelector('.endline')?.textContent, footer: document.getElementById('footLeft').textContent,
  balance: document.getElementById('balance').textContent }));
await p.screenshot({ path: `${out}/3-end.png` });
await b.close();
console.log('page:', JSON.stringify(checks));
console.log(`${rounds} rounds, longest ${longest} SHOOT taps; last end: ${end.end}; footer: ${end.footer}; balance ${end.balance}`);
console.log(`requests: ${requests.length} (${[...new Set(requests.map((u) => u.replace(url, './')))].join(', ')})`);
console.log(`errors: ${errors.length}${errors.length ? '\n  ' + errors.join('\n  ') : ''}`);
console.log(`failed requests: ${failed.length}${failed.length ? '\n  ' + failed.join('\n  ') : ''}`);
console.log(`requests leaving the folder: ${outside.length}${outside.length ? '\n  ' + outside.join('\n  ') : ''}`);
const ok = !errors.length && !failed.length && !outside.length && checks.dev === 'undefined' && checks.game === 'undefined' &&
  !checks.flag && !checks.devPanel && checks.menuShown === 'hidden' && !checks.solverText && checks.footer.includes('DEMO') && !!end.end;
console.log(ok ? 'ALL OK' : 'SOME FAILED');
