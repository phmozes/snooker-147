// Night 4, Part 1: frame time of the game with the old gray box vs the new club look, phone-sized window (390x844,
// device pixel ratio 2 like a phone) and 4x CPU throttling (Chrome DevTools). The same round (same seed) is played in
// both looks: the opponent's break-off and step 1; every animation frame's interval is recorded while balls move.
// Night 6: presses SHOOT for step 1 (the game no longer plays it by itself).
// node scripts/frame-time.mjs [rounds per look = 3] [out = bench/results/night4/frame-time.txt] [url = http://localhost:5181/]
import { writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const rounds = Number(process.argv[2] ?? 3);
const out = process.argv[3] ?? 'bench/results/night4/frame-time.txt';
const base = process.argv[4] ?? 'http://localhost:5181/'; // [url] of the dev server
const seeds = [101, 202, 303, 404, 505].slice(0, rounds);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const res = {};
const b = await launch();
// FT_AB=1 (night 6): the club look with the table markings vs without (?marks=0), interleaved, instead of grey vs club
const AB = !!process.env.FT_AB;
const LOOKS = AB ? ['club', 'club-nomarks'] : ['grey', 'club'];
for (const look of [...LOOKS, ...LOOKS]) { // twice each, interleaved, against drift
  for (const seed of seeds) {
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await p.evaluateOnNewDocument((l) => { try { localStorage.setItem('snooker147.look', l); localStorage.setItem('snooker147.cue', '1'); } catch {} }, look.replace('-nomarks', ''));
    await p.goto(`${base}?${look.endsWith('-nomarks') ? 'marks=0&' : ''}${process.env.FT_EXTRA ?? ""}level=reds15&seed=reds15-v2-${seed}`, { waitUntil: 'networkidle0', timeout: 120000 });
    await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 120000 });
    const cdp = await p.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await new Promise((r) => setTimeout(r, 1500));
    await p.evaluate(() => {
      const d = (window.__ft = []); let last = performance.now();
      const f = (t) => { const b = window.__dev.state().busy; if (b === 'break' || b === 'step1') d.push(t - last); last = t; if (!window.__ftDone) requestAnimationFrame(f); };
      requestAnimationFrame(f);
      void window.__dev.start();
    });
    await new Promise((r) => setTimeout(r, 1000));
    // night 6: since 2026-11-27 the game waits after the break-off; SHOOT plays step 1 (RULES B.2). The old script
    // waited for the round to go on by itself and hung. Now: wait for the break to end, press SHOOT, wait for step 1.
    await p.waitForFunction('window.__dev.state().busy === null && window.__dev.state().waiting', { timeout: 180000, polling: 250 });
    await p.evaluate(() => { void window.__dev.shoot(); });
    await new Promise((r) => setTimeout(r, 500));
    await p.waitForFunction('window.__dev.state().busy === null && window.__ft.length > 30', { timeout: 180000, polling: 250 });
    console.log(`${look} seed ${seed}: ${await p.evaluate(() => window.__ft.length)} frames`);
    const frames = await p.evaluate(() => { window.__ftDone = true; return window.__ft; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    (res[look] ??= []).push(...frames.slice(2));
    await p.close();
  }
}
await b.close();
const lines = ['Frame interval while the balls move (break-off + step 1), 390x844 at DPR 2, Chrome 4x CPU throttling, same seeds per look:'];
for (const look of LOOKS) {
  const a = res[look];
  lines.push(`${look}: ${a.length} frames, median ${q(a, 0.5).toFixed(1)} ms, 90% ${q(a, 0.9).toFixed(1)} ms, mean ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} ms, over 33 ms ${a.filter((x) => x > 33.4).length}`);
}
const m = (l) => res[l].reduce((x, y) => x + y, 0) / res[l].length;
lines.push(AB ? `markings cost (club with vs without, mean frame interval): ${(((m('club') / m('club-nomarks')) - 1) * 100).toFixed(1)}%`
  : `club vs grey (mean frame interval): ${(((m('club') / m('grey')) - 1) * 100).toFixed(1)}% (rule: at most +20%)`);
writeFileSync(out, lines.join('\n') + '\n');
console.log(lines.join('\n'));
