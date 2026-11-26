// Night 4, Part 1: does what the player sees agree with the physics at every pocket? Plays the real game (dev server)
// with the developer test panel's actions (window.__dev: force Success / Rattle / In-off, SHOOT), slows the playback
// down around the moment that matters and takes a picture: a potted ball shortly after the physics drops it (it must be
// seen falling into the drawn hole), a rattle at the moment the ball touches the jaw (it must touch the drawn jaw).
// node scripts/pocket-check.mjs [outDir] [look=club|grey]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';

const out = process.argv[2] ?? 'bench/results/night4/pockets';
const look = process.argv[3] ?? 'club';
mkdirSync(out, { recursive: true });
const POCKETS = ['topLeft', 'topRight', 'middleLeft', 'middleRight', 'bottomLeft', 'bottomRight'];
const TYPES = { success: 'Success', jawRattle: 'Rattle', inOff: 'In-off' };
const done = {}; // `${type}:${pocket}` -> file
const log = [];

const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror:', e.message));
// a big portrait window, so the pocket close-ups have enough pixels (the game uses the whole window when portrait)
await p.setViewport({ width: 1080, height: 2340, deviceScaleFactor: 1 });
await p.evaluateOnNewDocument((l) => { try { localStorage.setItem('snooker147.look', l); } catch {} }, look);
await p.goto('http://localhost:5181/?level=reds15', { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const st = () => p.evaluate(() => window.__dev.state());
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });

for (let iter = 0; iter < 160 && Object.keys(done).length < 18; iter++) {
  let s = await st();
  if (s.phase !== 'decide') {
    if (s.balance < 50) await p.evaluate(() => window.__dev.balanceBack());
    await p.evaluate(() => window.__dev.setSlow(4)); // break-off and step 1 fast
    await p.evaluate(() => { void window.__dev.start(); });
    await new Promise((r) => setTimeout(r, 300));
    await idle();
    s = await st();
    if (s.phase !== 'decide') continue;
  }
  // the type still missing at most pockets
  const type = Object.keys(TYPES).sort((x, y) => POCKETS.filter((q) => done[`${x}:${q}`]).length - POCKETS.filter((q) => done[`${y}:${q}`]).length)[0];
  await p.evaluate((f) => window.__dev.force(f), type);
  const n0 = (await p.evaluate(() => window.__dev.lastRec()?.n)) ?? 0;
  await p.evaluate(() => window.__dev.setSlow(1));
  // the game freezes the playback at the moment: jaw = at the touch, pot = 0.12 s after the drop (ball seen falling)
  await p.evaluate((t) => window.__dev.pauseOn(t === 'jawRattle' ? 'jaw' : t === 'inOff' ? 'potCue' : 'pot', t === 'jawRattle' ? 0 : 0.12), type);
  await p.evaluate(() => { void window.__dev.shoot(); });
  await p.waitForFunction((n) => (window.__dev.lastRec()?.n ?? 0) > n, { timeout: 300000, polling: 50 }, n0);
  const pz = await p.evaluate(() => window.__dev.pause());
  if (pz) {
    await p.waitForFunction(() => window.__dev.pause()?.paused, { timeout: 120000, polling: 50 });
    await new Promise((r) => setTimeout(r, 300));
    const ev = pz.event, key = `${type}:${ev.pocket}`;
    if (!done[key]) {
      const file = `${out}/${ev.pocket}-${type}.png`;
      // a close-up of the pocket (the overlays hidden), plus the whole screen for context
      await p.evaluate(() => { for (const id of ['devTag', 'toast', 'flag', 'devVer']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
      const box = await p.evaluate((id) => window.__dev.pocketBox(id), ev.pocket);
      await p.screenshot({ path: file, clip: box });
      await p.screenshot({ path: file.replace('.png', '-screen.png') });
      await p.evaluate(() => { for (const id of ['devTag', 'toast', 'flag', 'devVer']) { const e = document.getElementById(id); if (e) e.style.visibility = ''; } });
      const simT = (await p.evaluate(() => window.__dev.pause()))?.at ?? NaN;
      done[key] = file;
      log.push(`${type} ${ev.pocket}: ${ev.type} of ${ev.a} at ${ev.t.toFixed(3)} s, playback frozen at ${simT.toFixed(3)} s, ${s.code} step ${s.step + 1}`);
      console.log(log[log.length - 1]);
    }
    await p.evaluate(() => window.__dev.setSlow(4));
    await p.evaluate(() => window.__dev.resume());
  } else await p.evaluate(() => window.__dev.setSlow(4));
  await idle();
  await p.evaluate(() => window.__dev.force(null));
}
const missing = POCKETS.flatMap((q) => Object.keys(TYPES).filter((t) => !done[`${t}:${q}`]).map((t) => `${t}:${q}`));
log.push(`covered ${Object.keys(done).length} of 18; missing: ${missing.join(' ') || 'none'}`);
writeFileSync(`${out}/log.txt`, log.join('\n') + '\n');
console.log(log[log.length - 1]);
await b.close();
