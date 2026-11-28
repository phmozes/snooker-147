// 2026-11-28 (owner): the player's view cameras in the TEST BUILD (dist-test/ served by `npx vite preview`), no edits to
// the game: (1) clips of V1, V2, V3 on one pot and one miss (dev menu CAMERA forced, the miss forced as a plain miss),
// (2) the same round code replayed twice must show the same camera on every shot (__dev.camLog).
// Time is stepped frame by frame while filming (30 fps), so the clip is real speed. Nothing is posted to the PC: a test
// build never posts, and every /__dev/ request is blocked as well.
//   node scripts/cams-check.mjs <base url> <out dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { launch } from './shot.mjs';
const [base = 'http://localhost:5190', out = 'bench/results/2026-11-28/cams'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const FFMPEG = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const FPS = 30, CODE = process.env.CODE ?? 'reds15-v3-3191475780', STEP = +(process.env.STEP ?? 7);
const b = await launch();
const errs = [];
let blocked = 0;
const clockScript = () => {
  const realNow = performance.now.bind(performance), realRaf = window.requestAnimationFrame.bind(window);
  const realST = window.setTimeout.bind(window), realCT = window.clearTimeout.bind(window);
  let offset = 0, stepping = false, vt = 0, queue = [], timers = [], nextId = 1e9;
  performance.now = () => (stepping ? vt : realNow() + offset);
  window.requestAnimationFrame = (cb) => { if (stepping) { queue.push(cb); return queue.length; } return realRaf(() => cb(performance.now())); };
  window.setTimeout = (cb, ms = 0, ...a) => { if (!stepping) return realST(cb, ms, ...a); const id = nextId++; timers.push({ id, due: vt + (ms || 0), cb: () => cb(...a) }); return id; };
  window.clearTimeout = (id) => { if (id >= 1e9) timers = timers.filter((t) => t.id !== id); else realCT(id); };
  window.__clock = {
    stepOn: () => { if (!stepping) { vt = realNow() + offset; stepping = true; } },
    stepOff: () => {
      if (!stepping) return;
      offset = vt - realNow(); stepping = false;
      const q = queue; queue = []; q.forEach((cb) => realRaf(() => cb(performance.now())));
      const ts = timers; timers = []; ts.forEach((t) => realST(t.cb, Math.max(0, t.due - vt)));
    },
    step: (ms) => {
      vt += ms;
      for (let g = 0; g < 50; g++) {
        const due = timers.filter((t) => t.due <= vt).sort((a, c) => a.due - c.due);
        if (!due.length) break;
        timers = timers.filter((t) => !due.includes(t));
        for (const t of due) t.cb();
      }
      const q = queue; queue = []; q.forEach((cb) => cb(vt));
    },
  };
};
async function page(code) {
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.evaluateOnNewDocument(clockScript);
  await p.setRequestInterception(true);
  p.on('request', (r) => { if (r.url().includes('/__dev/')) { blocked++; return r.abort(); } return r.continue(); });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const lv = code.split('-')[0];
  await p.goto(`${base}/?level=${lv}&seed=${code}`, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.addStyleTag({ content: '#flag, #devVer, #replayTag { display: none !important; }' });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null', { timeout: 60000 });
  return p;
}
const idle = (p) => p.waitForFunction('(() => { const s = window.__dev.state(); return s.busy === null && (s.phase === "decide" || !!s.end); })()', { timeout: 300000, polling: 100 });

// (1) clips: one round of CODE per clip; steps before STEP are played fast (forced success), STEP is filmed
const clips = [];
for (const cam of ['V1', 'V2', 'V3']) for (const kind of ['pot', 'miss']) {
  const name = `${cam}-${kind}`;
  const p = await page(CODE);
  await p.evaluate((c) => { window.__dev.camera(c); window.__dev.setSlow(25); window.__dev.force('success'); void window.__dev.start(); }, cam);
  for (;;) {
    await idle(p);
    const st = await p.evaluate(() => window.__dev.state());
    if (st.end) throw new Error(`${name}: the round ended before step ${STEP}`);
    if (st.step + 1 === STEP) break;
    await p.evaluate(() => { window.__dev.force('success'); window.__dev.shoot(); });
    await new Promise((r) => setTimeout(r, 150));
  }
  await p.evaluate((k) => { window.__dev.force(k === 'miss' ? 'plainMiss' : 'success'); }, kind);
  await idle(p); // the forced kind is solved again
  await p.waitForFunction('window.__dev.solved()', { timeout: 300000, polling: 100 }); // no THINKING… in the clip
  const dir = `${out}/frames-${name}`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  await p.evaluate(() => { window.__dev.setSlow(1); window.__clock.stepOn(); window.__dev.shoot(); });
  let n = 0, after = -1, shootAt = null;
  for (; n < FPS * 10; n++) {
    await p.screenshot({ path: `${dir}/f${String(n).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 });
    await p.evaluate((ms) => window.__clock.step(ms), 1000 / FPS);
    const st = await p.evaluate(() => window.__dev.state());
    if (after < 0 && st.busy === null && (st.phase === 'decide' || st.end) && n > 10) { after = 12; shootAt = +(n / FPS).toFixed(2); }
    if (after >= 0 && after-- === 0) break;
  }
  const log = await p.evaluate(() => window.__dev.camLog());
  const shown = log[log.length - 1];
  const outcome = await p.evaluate(() => window.__dev.state().hist.split(',').pop());
  await p.evaluate(() => window.__clock.stepOff());
  const file = `${out}/${name}.mp4`;
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/f%04d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file]);
  // stills: the hold (0.15 s), the follow / rise half way (0.7 s), the end of the shot
  for (const [tag, f] of [['hold', 5], ['move', 21], ['end', Math.max(0, n - 13)]]) execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', `${dir}/f${String(f).padStart(4, '0')}.jpg`, '-q:v', '4', `${out}/${name}-${tag}.jpg`]);
  rmSync(dir, { recursive: true, force: true });
  const r = { name, cam, kind, outcome, shownCamera: shown, frames: n, seconds: +(n / FPS).toFixed(2), shootBackAt: shootAt, kb: +(statSync(file).size / 1000).toFixed(1) };
  console.log(JSON.stringify(r));
  clips.push(r);
  await p.close();
}

// (2) a replayed code shows the same cameras every time (AUTO camera, natural outcomes)
const replays = [];
for (const code of (process.env.REPLAY_CODES ?? 'reds6-v4-5000008,reds10-v3-5400012,reds15-v3-3191475780').split(',')) {
  const runs = [];
  for (let k = 0; k < 2; k++) {
    const p = await page(code);
    await p.evaluate((c) => { window.__dev.camera('AUTO'); window.__dev.setSlow(25); window.__dev.replay(c); }, code);
    await p.waitForFunction('!!window.__dev.state().end', { timeout: 600000, polling: 200 });
    runs.push(await p.evaluate(() => window.__dev.camLog().map((c) => `${c.step}:${c.cam}`).join(' ')));
    await p.close();
  }
  const r = { code, same: runs[0] === runs[1], shots: runs[0].split(' ').filter(Boolean).length, cams: runs[0] };
  console.log(JSON.stringify(r));
  replays.push(r);
}
writeFileSync(`${out}/cams-check.json`, JSON.stringify({ base, code: CODE, step: STEP, clips, replays, blockedDevRequests: blocked, errors: errs }, null, 1));
console.log('blocked /__dev/ requests:', blocked, 'page errors:', errs.length ? errs : 'none');
await b.close();
