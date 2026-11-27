// Owner 2026-11-27: live check of the miss sound (dev server). Forces each failure type, with and without the
// pocket-camera cut, and checks: exactly one 'miss' per failed shot, none on a success, the break-off or a cash out,
// and WHEN it starts against what is on screen (window.__soundLog, window.__dropLog):
//   plain miss / wrong ball first: vs the end of the playback (all balls stopped)
//   jaw rattle: after the target's last jaw sound, before (or at) the end of the playback
//   in-off: vs the drawn cue ball's centre going below the cloth
//   (the playback end is seen by polling every drawn frame, so it is found up to 2 frames late)
// node scripts/miss-sound-check.mjs [shots per case = 2] [url] [cases = plainMiss,wrongBallFirst,jawRattle,inOff]
import { launch } from './shot.mjs';

const N = Number(process.argv[2] ?? 2);
const url = process.argv[3] ?? 'http://localhost:5181/?level=reds15';
const b = await launch();
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('snooker147.mute', '0'); } catch { /* */ } });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
await p.mouse.click(195, 300); // the first tap switches sound on
await new Promise((r) => setTimeout(r, 1500));
const st = () => p.evaluate(() => window.__dev.state());
// the real time the game became idle again (the playback ended), polled every drawn frame
const idleAt = () => p.waitForFunction(() => window.__dev.state().busy === null && performance.now(), { timeout: 300000, polling: 'raf' }).then((h) => h.jsonValue());
const logs = () => p.evaluate(() => ({ s: window.__soundLog ?? [], d: window.__dropLog ?? [] }));
let ok = true;
const check = (what, v) => { console.log(v ? 'ok  ' : 'FAIL', what); ok &&= v; };
const misses = (a, z) => z.s.slice(a.s.length).filter((x) => x.name === 'miss');

async function newRound() {
  if ((await st()).balance < 50) await p.evaluate(() => window.__dev.balanceBack());
  const a = await logs();
  await p.evaluate(() => { void window.__dev.start(); });
  await new Promise((r) => setTimeout(r, 300));
  await idleAt();
  return a;
}
async function shot(force, cam, pre = 0) {
  let s = await st();
  if (s.phase !== 'decide') {
    const a = await newRound();
    check(`break-off (and step-1 wait): no miss sound (${misses(a, await logs()).length})`, misses(a, await logs()).length === 0);
    s = await st();
  }
  if (s.step === 0) { await p.evaluate(() => window.__dev.shoot()); await new Promise((r) => setTimeout(r, 300)); await idleAt(); }
  if ((await st()).phase !== 'decide') return shot(force, cam, pre);
  // a few forced successes first, so the target (and the position) differ from shot to shot
  for (let i = 0; i < pre && (await st()).phase === 'decide'; i++) {
    await p.evaluate(() => window.__dev.force('success'));
    await p.evaluate(() => { void window.__dev.shoot(); }); await new Promise((r) => setTimeout(r, 300)); await idleAt();
  }
  if ((await st()).phase !== 'decide') return shot(force, cam, 0);
  await p.evaluate((f) => window.__dev.force(f), force);
  if (cam) await p.evaluate(() => window.__dev.pocketCam('P1b'));
  const a = await logs();
  await p.evaluate(() => { void window.__dev.shoot(); });
  await new Promise((r) => setTimeout(r, 300));
  const end = await idleAt();
  await new Promise((r) => setTimeout(r, 400));
  const z = await logs();
  await p.evaluate(() => window.__dev.force(null));
  const cut = cam ? await p.evaluate(() => window.__dev.lastCut()) : 'no cut';
  // the label really played (a failure the solver cannot find falls back to a plain miss or a foul)
  const e = (await st()).end;
  const label = e ? JSON.parse(e).label ?? force : force;
  return { a, z, end, cut, label, rec: await p.evaluate(() => window.__dev.lastRec()) };
}

for (const cam of [false, true]) {
  for (const force of (process.argv[4] ?? 'plainMiss,wrongBallFirst,jawRattle,inOff').split(',')) {
    for (let k = 0, got = 0; k < 4 * N && got < N; k++) {
      const { a, z, end, cut, rec, label } = await shot(force, cam, k % 4);
      if (label === force) got++;
      const m = misses(a, z);
      const tag = `${label}${label !== force ? ` (asked ${force}, fell back)` : ''}${cam ? ' + pocket cam' : ''} (${cut})`;
      check(`${tag}: one miss sound (${m.length})`, m.length === 1);
      if (!m[0]) continue;
      const at = m[0].at;
      if (label === 'inOff') {
        const d = z.d.slice(a.d.length).at(-1);
        const g = d ? at - d.at : NaN;
        const pk = z.s.slice(a.s.length).find((x) => x.key === 'cue|p');
        check(`${tag}: starts with the cue ball's own pocket sound: ${pk ? (at - pk.at).toFixed(1) : 'no pocket sound'} ms`, !!pk && Math.abs(at - pk.at) <= 1);
        // the drawn drop: within about one frame (headless Chrome sometimes draws a slow frame, so 2 frames allowed)
        check(`${tag}: vs the drawn cue ball going below the cloth: ${g.toFixed(0)} ms (|gap| <= 34 ms)`, Math.abs(g) <= 34);
      } else if (label === 'jawRattle') {
        const target = rec.events.find((e) => e.type === 'jaw' && e.a !== 'cue')?.a;
        const jaws = z.s.slice(a.s.length).filter((x) => x.key === `${target}|c`);
        const lastJaw = jaws.at(-1)?.at ?? NaN;
        // a very soft rattle makes no jaw sound (volume 0): then only "before the playback end" can be checked here
        check(`${tag}: ${Number.isNaN(lastJaw) ? 'no rattle sound (too soft)' : `${(at - lastJaw).toFixed(0)} ms after ${target}'s last rattle sound`}, ${(end - at).toFixed(0)} ms before the playback end`,
          (Number.isNaN(lastJaw) || at > lastJaw) && at <= end + 20);
      } else {
        check(`${tag}: at the playback end (balls stopped): ${(at - end).toFixed(0)} ms (the end is detected up to 2 frames late: -34..+20 ms)`, at - end >= -34 && at - end <= 20);
      }
    }
  }
}
// a success: no miss
{
  const { a, z } = await shot('success', false);
  check(`success: no miss sound (${misses(a, z).length})`, misses(a, z).length === 0);
}
// a cash out: no miss
{
  if ((await st()).phase === 'decide' && (await st()).step >= 1) {
    const a = await logs();
    await p.click('#bCash'); await new Promise((r) => setTimeout(r, 1500));
    check(`cash out: no miss sound (${misses(a, await logs()).length})`, misses(a, await logs()).length === 0);
  }
}
// mute: no miss
{
  await p.evaluate(() => { const m = document.getElementById('mute'); m?.click(); });
  const { a, z } = await shot('plainMiss', false);
  check(`muted: no miss sound (${misses(a, z).length})`, misses(a, z).length === 0);
  await p.evaluate(() => { const m = document.getElementById('mute'); m?.click(); });
}
check(`no page errors (${errors.join(' | ') || 'none'})`, errors.length === 0);
await b.close();
console.log(ok ? 'MISS SOUND CHECK OK' : 'MISS SOUND CHECK FAILED');
process.exit(ok ? 0 : 1);
