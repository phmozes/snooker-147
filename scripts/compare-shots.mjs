// Night 8 step 7 (report only): the live game at 390x844 in the states of mockups D (between rounds), A (a red to play,
// SHOOT and CASH OUT) and C (a colour to play) for mockups/compare-mockups/. Needs the dev server on port 5181.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const out = 'mockups/compare-mockups';
mkdirSync(out, { recursive: true });
const log = [];
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto('http://localhost:5181/', { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
const settle = () => new Promise((r) => setTimeout(r, 2500));
const shot = async (name) => {
  // the developer-only marks are hidden (they are not in the real build)
  await p.evaluate(() => { for (const id of ['devTag', 'flag']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
    for (const e of document.querySelectorAll('#screen *')) if (e.children.length === 0 && /^solver \d/.test(e.textContent ?? '')) e.style.visibility = 'hidden'; });
  const st = await p.evaluate(() => window.__dev.state());
  const hint = await p.evaluate(() => document.querySelector('#bottom .hint')?.textContent ?? '');
  log.push(`${name}: ${JSON.stringify(st)} hint "${hint}"`);
  await p.screenshot({ path: `${out}/game-${name}.jpg`, type: 'jpeg', quality: 80 });
};
await settle();
await shot('D');
await p.evaluate(() => window.__dev.force('success'));
// step 1 comes from the break library (a snookered break fails whatever is forced): start again until it is potted
for (let t = 0; t < 10; t++) {
  await p.evaluate(() => { void window.__dev.start(); }); await idle();
  await p.evaluate(() => { void window.__dev.shoot(); }); await idle();
  if ((await p.evaluate(() => window.__dev.state())).phase === 'decide') break;
  await settle();
}
for (let k = 0; k < 3; k++) { await p.evaluate(() => { void window.__dev.shoot(); }); await idle(); } // after step 4: a red to play
await settle();
await shot('A');
await p.evaluate(() => { void window.__dev.shoot(); }); await idle(); // step 5 (a red): a colour to play
await settle();
await shot('C');
await b.close();
writeFileSync(`${out}/shots.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
