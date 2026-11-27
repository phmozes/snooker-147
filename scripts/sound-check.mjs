// PLAN 9.1 / 9.2: live check of the game sounds (dev server; window.__soundLog lists every sound started, by name).
// Real clicks on the page: no sound before the first tap, tap on UI buttons only, one break sound on the opponent's
// break-off with no ball-ball sound for 1.5 s after it, the applause on CASH OUT, nothing while muted.
// node scripts/sound-check.mjs [url]
import { launch } from './shot.mjs';
const url = process.argv[2] ?? 'http://localhost:5181/';
const b = await launch();
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('snooker147.mute', '0'); } catch { /* */ } });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 300000, polling: 200 });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const log = () => p.evaluate(() => window.__soundLog ?? []);
const since = async (n) => (await log()).slice(n);
let ok = true;
const check = (what, v) => { console.log(v ? 'ok  ' : 'FAIL', what); ok &&= v; };
const names = (l) => l.map((x) => x.name).join(' ') || 'none';

check('no sound before the first tap', (await log()).length === 0);
await p.mouse.click(195, 300); // the first tap, on the table: switches sound on (no tap sound: not a button)
await pause(1500);
check(`tap on the table: no sound (${names(await log())})`, (await log()).length === 0);
for (let round = 1; round <= 6; round++) {
  let n = (await log()).length;
  await p.click('#bStart'); await pause(300);
  await p.waitForFunction('window.__dev.state().busy === "break"', { timeout: 120000, polling: 50 });
  await idle();
  const brk = await since(n);
  if (round === 1) {
    check(`START button: tap sound (${brk[0]?.name})`, brk[0]?.name === 'tap');
    const at = brk.find((x) => x.name === 'break');
    check('break-off: one break sound', brk.filter((x) => x.name === 'break').length === 1);
    const early = brk.filter((x) => at && x.name.startsWith('ball') && x.at >= at.at && x.at < at.at + 1500);
    check(`break-off: no ball-ball sound in the 1.5 s after it (${early.length})`, !!at && early.length === 0);
    console.log('     break-off sounds:', names(brk));
  }
  n = (await log()).length;
  await p.click('#bShoot'); await pause(300); await idle();
  const s1 = await since(n);
  if (round === 1) check(`SHOOT: tap sound, then step 1 (${names(s1)})`, s1[0]?.name === 'tap' && s1.some((x) => x.name === 'cue'));
  const st = await p.evaluate(() => window.__dev.state());
  if (st.phase === 'decide' && st.step >= 1) {
    n = (await log()).length;
    await p.click('#bCash'); await pause(800);
    const c = await since(n);
    check(`CASH OUT (round ${round}): tap + applause (${names(c)})`, c[0]?.name === 'tap' && c.some((x) => x.name === 'applause-1'));
    break;
  }
  console.log(`     round ${round}: step 1 ended the round (${st.phase}), no applause expected:`, (await since(n)).some((x) => x.name.startsWith('applause')) ? 'FAIL: applause played' : 'ok');
  await pause(3500); // the end message, then the bet area
}
await p.waitForSelector('#bStart:not([disabled])', { timeout: 30000 });
await p.click('#mute'); // mute on
const before = (await log()).length;
await p.click('#bStart'); await pause(300);
await p.waitForFunction('window.__dev.state().busy === "break"', { timeout: 120000, polling: 50 }); await idle();
check(`muted: START + whole break-off, no sound (${names(await since(before))})`, (await log()).length === before);
await p.click('#mute');
check(`no page errors (${errors.join(' | ') || 'none'})`, errors.length === 0);
await b.close();
console.log(ok ? 'SOUND CHECK OK' : 'SOUND CHECK FAILED');
process.exit(ok ? 0 : 1);
