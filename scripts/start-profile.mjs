// Where does the time go at the first START? CPU profile (CPU 4x slower) from START until SHOOT shows, plus every
// main-thread task longer than 100 ms, on the test build (dist-test/, vite preview). Part 6 of the 2026-11-28 task.
// node scripts/start-profile.mjs <url> <out.json>
import { writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const [url, outFile] = process.argv.slice(2);
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const cdp = await p.target().createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto(url, { waitUntil: 'load', timeout: 600000 });
await p.waitForFunction(() => !!document.getElementById('bStart') && !document.getElementById('bStart').disabled, { timeout: 600000, polling: 100 });
await p.waitForNetworkIdle({ idleTime: 1500, timeout: 600000 }).catch(() => {});
await p.evaluate(() => { window.__long = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await cdp.send('Profiler.start');
await p.click('#bStart');
await p.waitForFunction(() => !!document.getElementById('bShoot') && !document.getElementById('bShoot').disabled, { timeout: 600000, polling: 50 });
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const dt = profile.timeDeltas; const idx = new Map(profile.nodes.map((n) => [n.id, n]));
const count = new Map(); for (const s of profile.samples) count.set(s, (count.get(s) ?? 0) + 1);
const avg = dt.reduce((a, x) => a + x, 0) / dt.length / 1000; // ms per sample
for (const [id, c] of count) { const n = idx.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) ?? 0) + c * avg); }
const top = [...self.entries()].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((a, c) => c[1] - a[1]).slice(0, 15).map(([k, v]) => `${Math.round(v)} ms ${k}`);
const res = { longTasks: await p.evaluate(() => window.__long), topSelf: top };
await b.close();
writeFileSync(outFile, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
