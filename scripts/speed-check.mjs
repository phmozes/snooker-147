// Night 8 step 8 (report only): load time and data size on a throttled "slow 4G, mid-range phone" profile in headless
// Chrome (Lighthouse values: 150 ms round trip, 1.6 Mbit/s down, 750 kbit/s up, CPU 4x slower), and frame times during
// a break-off and during a pocket-camera cut.
// node scripts/speed-check.mjs load <url> <out.json>     (production build: vite preview of dist/)
// node scripts/speed-check.mjs frames <url> <out.json>   (test build dist-test/: same optimised code + the dev hooks)
import { writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const [mode, url, outFile] = process.argv.slice(2);
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const cdp = await p.target().createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const res = { mode, url, profile: 'slow 4G (150 ms, 1.6 Mbit/s down, 750 kbit/s up), CPU x4 slower, 390x844 @3x' };
const bytes = new Map();
cdp.on('Network.loadingFinished', (e) => bytes.set(e.requestId, { ...(bytes.get(e.requestId) ?? {}), size: e.encodedDataLength }));
cdp.on('Network.responseReceived', (e) => bytes.set(e.requestId, { ...(bytes.get(e.requestId) ?? {}), url: e.response.url, type: e.type }));
const t0 = Date.now();
await p.goto(url, { waitUntil: 'load', timeout: 600000 });
res.loadEventMs = Date.now() - t0;
// "ready": the START button can be pressed (the game drew its table and its bet row)
await p.waitForFunction(() => !!document.getElementById('bStart') && !document.getElementById('bStart').disabled, { timeout: 600000, polling: 100 });
res.startButtonMs = Date.now() - t0;
await p.waitForNetworkIdle({ idleTime: 1500, timeout: 600000 }).catch(() => {});
res.networkIdleMs = Date.now() - t0;
const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null }; });
Object.assign(res, nav);
const files = [...bytes.values()].filter((x) => x.url && x.size !== undefined);
res.totalKB = Math.round(files.reduce((a, x) => a + x.size, 0) / 1024);
res.byType = {}; for (const f of files) res.byType[f.type] = Math.round(((res.byType[f.type] ?? 0) * 1024 + f.size) / 1024);
res.files = files.map((f) => `${Math.round(f.size / 1024)} KB ${f.url.replace(url, '')}`).sort((a, c) => parseInt(c) - parseInt(a));

if (mode === 'load') { // the first START: the break library and the sounds come now
  const before = new Set(bytes.keys()); const t1 = Date.now();
  await p.click('#bStart');
  await p.waitForFunction(() => !!document.getElementById('bShoot') || !!document.getElementById('bStart'), { timeout: 600000, polling: 50 });
  await p.waitForFunction(() => !!document.getElementById('bShoot') || (document.getElementById('bStart') && !document.getElementById('bStart').disabled), { timeout: 600000, polling: 50 });
  res.firstStartToShootMs = Date.now() - t1;
  await p.waitForNetworkIdle({ idleTime: 1500, timeout: 600000 }).catch(() => {});
  const after = [...bytes.entries()].filter(([k, x]) => !before.has(k) && x.url && x.size !== undefined).map(([, x]) => x);
  res.firstStartKB = Math.round(after.reduce((a, x) => a + x.size, 0) / 1024);
  res.firstStartFiles = after.map((f) => `${Math.round(f.size / 1024)} KB ${f.url.replace(url, '')}`).sort((a, c) => parseInt(c) - parseInt(a));
}
if (mode === 'frames') {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const startRec = () => p.evaluate(() => { window.__ft = []; let last = performance.now(); window.__ftOn = true;
    const f = (t) => { if (!window.__ftOn) return; window.__ft.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const stopRec = () => p.evaluate(() => { window.__ftOn = false; const a = window.__ft.slice(1).sort((x, y) => x - y);
    const q = (k) => Math.round(a[Math.min(a.length - 1, Math.floor(k * a.length))] * 10) / 10;
    return { frames: a.length, p50: q(0.5), p95: q(0.95), max: Math.round(a[a.length - 1]), over33: a.filter((x) => x > 33.4).length, over50: a.filter((x) => x > 50).length }; });
  const idle = () => p.waitForFunction('window.__dev.state().busy === null', { timeout: 600000, polling: 200 });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 600000 });
  await p.evaluate(() => window.__dev.force('success'));
  await startRec(); await p.evaluate(() => { void window.__dev.start(); }); await idle();
  res.breakOff = await stopRec();
  await p.evaluate(() => { void window.__dev.shoot(); }); await idle(); // step 1 (no cut on step 1)
  await p.evaluate(() => window.__dev.pocketCam('random'));
  const cuts = [];
  for (let k = 0; k < 4 && cuts.length < 2; k++) {
    await startRec(); await p.evaluate(() => { void window.__dev.shoot(); }); await idle();
    const ft = await stopRec(); const cut = await p.evaluate(() => window.__dev.lastCut());
    if (cut) cuts.push({ ...ft, cut });
  }
  res.pocketCut = cuts;
}
await b.close();
writeFileSync(outFile, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
