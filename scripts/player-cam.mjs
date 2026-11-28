// 2026-11-28: "player's view" camera options as short video clips (mockups/player-cam). The game is NOT changed: the
// recording browser gets edited copies of two modules (table3d.ts calls a camera hook before each render; gamePage.ts
// logs every shot it plays and exposes playShot). Time is stepped frame by frame (30 fps), so the clips are smooth
// even on a slow PC. ffmpeg comes from the Python package imageio-ffmpeg.
// node scripts/player-cam.mjs [baseUrl]    (dev server on 5181)
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { launch } from './shot.mjs';
const base = process.argv[2] ?? 'http://localhost:5181';
const out = 'mockups/player-cam';
const tmp = process.env.TMPDIR_PC ?? 'bench/results/player-cam-frames';
mkdirSync(out, { recursive: true });
const FFMPEG = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const FPS = 30, LEVEL = process.env.LEVEL ?? 'reds15';

// camera variants (metres / degrees). back = behind the cue ball along the shot line, h = above the cloth,
// ahead = the point looked at, metres in front of the cue ball on the line (at cloth height)
export const VARIANTS = {
  now: { label: 'Today (57°)' },
  V1: { label: 'V1 eye level', back: 0.50, h: 0.16, ahead: 1.2, fov: 50 },
  V2: { label: 'V2 over the shoulder', back: 1.05, h: 0.55, ahead: 0.9, fov: 52 },
  V3: { label: 'V3 eye level then rise', back: 0.50, h: 0.16, ahead: 1.2, fov: 50, riseAfter: 0.0, riseTime: 1.0 },
};

const b = await launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
// stepped clock: free running until window.__step is set, then performance.now / rAF only move when the script says
await p.evaluateOnNewDocument(() => {
  const realNow = performance.now.bind(performance), realRaf = window.requestAnimationFrame.bind(window);
  let offset = 0, stepping = false, vt = 0, queue = [];
  performance.now = () => (stepping ? vt : realNow() + offset);
  window.requestAnimationFrame = (cb) => { if (stepping) { queue.push(cb); return queue.length; } return realRaf((t) => cb(performance.now())); };
  window.__clock = {
    stepOn: () => { vt = realNow() + offset; stepping = true; },
    stepOff: () => { offset = vt - realNow(); stepping = false; const q = queue; queue = []; q.forEach((cb) => realRaf(() => cb(performance.now()))); },
    step: (ms) => { vt += ms; const q = queue; queue = []; q.forEach((cb) => cb(vt)); return q.length; },
    now: () => performance.now(),
  };
});
await p.setCacheEnabled(false);
await p.setRequestInterception(true);
p.on('request', async (r) => {
  const u = r.url();
  const edit = u.includes('/src/view/table3d.ts')
    ? (t) => t.replace('renderer.render(scene, camera);', 'if (window.__camHook) window.__camHook(camera, fit); renderer.render(scene, camera);')
    : u.includes('/src/game/gamePage.ts')
      ? (t) => t.replace(/function playShot\(balls, s, opts = \{\}\) \{/, (m) => `${m}\n  if (window.__shotLog) window.__shotLog.push({ balls: JSON.parse(JSON.stringify(balls)), s: JSON.parse(JSON.stringify(s)), code: round.roundCode, step: round.step, hist: round.history.length ? round.history[round.history.length - 1].outcome : null });`)
        + '\nwindow.__pc = { playShot, buildView, showBalls, table: () => table };\n'
      : null;
  if (!edit) return r.continue();
  const res = await fetch(u, { headers: r.headers() });
  const t = await res.text(), t2 = edit(t);
  if (!t2.includes('__camHook') && !t2.includes('__shotLog')) errs.push('edit did not apply: ' + u);
  r.respond({ status: 200, contentType: res.headers.get('content-type') ?? 'application/javascript', body: t2 });
});
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.goto(`${base}/?level=${LEVEL}${process.env.SEED ? `&seed=${process.env.SEED}` : ""}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.addStyleTag({ content: '#flag, #devTag, #devVer, #replayTag { display: none !important; }' });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null && window.__pc', { timeout: 60000 })
  .catch((e) => { console.log('stuck', errs.join(' | ')); throw e; });
if (errs.length) console.log('errors:', errs);

// 1) play real rounds (forced success so they run long), log every shot
await p.evaluate(() => { window.__shotLog = []; window.__dev.setSlow(25); });
const rounds = Number(process.env.ROUNDS ?? 2);
for (let k = 0; k < rounds; k++) {
  await p.evaluate(() => { window.__dev.force('success'); void window.__dev.start(); });
  for (let i = 0; i < 40; i++) {
    const ok = await p.waitForFunction('window.__dev.state().busy === null && (window.__dev.state().phase === "decide" || window.__dev.state().end)', { timeout: 300000, polling: 200 }).then(() => true).catch(() => false);
    const st = await p.evaluate(() => window.__dev.state());
    if (!ok || st.end || st.phase !== 'decide') break;
    await p.evaluate(() => { window.__dev.force('success'); window.__dev.shoot(); });
    await new Promise((r) => setTimeout(r, 300));
  }
  await p.evaluate(() => { window.__dev.force(null); });
  await new Promise((r) => setTimeout(r, 1500));
  const st = await p.evaluate(() => window.__dev.state());
  if (st.phase !== 'bet' && !st.end) console.log('round end state', JSON.stringify(st));
}
const log = await p.evaluate(() => window.__shotLog);
const T = await p.evaluate(() => { const t = window.__pc.table(); return { pockets: t.pockets.map((q) => ({ id: q.id, x: q.mouthMid.x, y: q.mouthMid.y })), hl: t.halfLength, r: t.ballRadius }; });
console.log('shots logged', log.length);

// 2) pick the 3 shots from the log (only planned pots with a target and a pocket)
const info = log.map((L, i) => {
  const s = L.s, cue = L.balls.find((x) => x.kind === 'cue'), tg = L.balls.find((x) => x.id === s.target);
  const pk = T.pockets.find((q) => q.id === s.pocket);
  if (!cue || !tg || !pk) return null;
  const dl = Math.hypot(s.dir.x, s.dir.y), d = { x: s.dir.x / dl, y: s.dir.y / dl };
  const tp = { x: pk.x - tg.pos.x, y: pk.y - tg.pos.y }, tl = Math.hypot(tp.x, tp.y);
  const cut = Math.acos(Math.max(-1, Math.min(1, (d.x * tp.x + d.y * tp.y) / tl))) * 180 / Math.PI;
  const dist = Math.hypot(tg.pos.x - cue.pos.x, tg.pos.y - cue.pos.y);
  return { i, code: L.code, step: L.step, target: s.target, kind: tg.kind, pocket: s.pocket, type: s.type, cut, dist, potLen: tl, corner: !pk.id.startsWith('middle'), alongY: Math.abs(d.y) };
}).filter(Boolean);
const isRed = (x) => x.kind === 'red';
const pick = (f, score) => info.filter(f).sort((a, b) => score(b) - score(a))[0];
const straight = pick((x) => isRed(x) && x.corner && x.cut < 4 && x.dist > 0.35 && x.dist < 1.1, (x) => -x.cut);
const thin = pick((x) => !isRed(x) && x.cut < 75 && x.dist > 0.3, (x) => x.cut);
console.log("colour cuts", info.filter((x) => !isRed(x)).map((x) => x.cut.toFixed(0)).join(" "));
const long = pick((x) => isRed(x) && x.dist + x.potLen > 2.0 && x.alongY > 0.85 && x !== straight, (x) => x.dist + x.potLen);
const SHOTS = [['straight', straight], ['thin', thin], ['long', long]];
for (const [k, x] of SHOTS) console.log(k, x ? JSON.stringify({ ...x, cut: +x.cut.toFixed(1), dist: +x.dist.toFixed(2), potLen: +x.potLen.toFixed(2) }) : 'NONE FOUND');
if (SHOTS.some(([, x]) => !x)) { await b.close(); process.exit(1); }

// 3) film every shot from every camera. First a new round to step 2, so the buttons below show a round in play
await p.evaluate(() => { window.__dev.force('success'); void window.__dev.start(); });
await p.waitForFunction('window.__dev.state().busy === null && window.__dev.state().phase === "decide"', { timeout: 300000, polling: 200 });
await p.evaluate(() => { window.__dev.force(null); });
await new Promise((r) => setTimeout(r, 2500));
await p.evaluate(() => { window.__dev.setSlow(1); });
const results = [];
for (const [key, x] of SHOTS) {
  const L = log[x.i];
  for (const [vk, V] of Object.entries(VARIANTS)) {
    const dir = `${tmp}/${key}-${vk}`;
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    await p.evaluate(({ L, V, vk }) => {
      const P = window.__pc, cue = L.balls.find((q) => q.kind === 'cue');
      const dl = Math.hypot(L.s.dir.x, L.s.dir.y), d = { x: L.s.dir.x / dl, y: L.s.dir.y / dl };
      P.buildView(L.balls); P.showBalls(L.balls);
      window.__clock.stepOn();
      const t0 = window.__clock.now();
      const pose = (v) => ({ pos: [cue.pos.x - d.x * v.back, cue.pos.y - d.y * v.back, v.h], at: [cue.pos.x + d.x * v.ahead, cue.pos.y + d.y * v.ahead, 0], fov: v.fov });
      const ss = (k) => k * k * (3 - 2 * k);
      window.__camHook = vk === 'now' ? null : (cam, fit) => {
        const P1 = pose(V);
        let A = { pos: P1.pos, at: P1.at, fov: P1.fov };
        if (V.riseTime) { // V3: after the tip reaches the cue ball (0.25 s), rise to the main camera
          const tau = (window.__clock.now() - t0) / 1000 - 0.25 - V.riseAfter;
          const k = ss(Math.max(0, Math.min(1, tau / V.riseTime)));
          const mix = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
          A = { pos: mix(P1.pos, fit.position), at: mix(P1.at, fit.lookAt), fov: P1.fov + (fit.fov - P1.fov) * k };
        }
        cam.fov = A.fov; cam.position.set(...A.pos); cam.lookAt(A.at[0], A.at[1], A.at[2]); cam.updateProjectionMatrix();
      };
      window.__playing = true;
      P.playShot(L.balls, L.s, { cue: true }).then((len) => { window.__playing = false; window.__len = len; });
    }, { L, V, vk });
    const MAXF = Math.round(FPS * Number(process.env.CLIP_S ?? 3));
    let n = 0;
    for (; n < MAXF; n++) {
      await p.screenshot({ path: `${dir}/f${String(n).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
      await p.evaluate((ms) => window.__clock.step(ms), 1000 / FPS);
    }
    // let the rest of the shot run out at full speed (not filmed), back to the normal camera
    await p.evaluate(() => { window.__camHook = null; window.__clock.stepOff(); window.__dev.setSlow(30); });
    await p.waitForFunction('window.__playing === false', { timeout: 120000, polling: 100 });
    await p.evaluate(() => window.__dev.setSlow(1));
    const file = `${out}/${key}-${vk}.mp4`;
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/f%04d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file]);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', `${dir}/f0012.jpg`, '-q:v', '5', `${out}/${key}-${vk}.jpg`]); // poster
    const kb = statSync(file).size / 1024;
    console.log(file, n, 'frames', kb.toFixed(0), 'KB');
    const ev = await p.evaluate((tg) => { const r = window.__dev.lastRec(); const e = r.events.find((q) => q.type === 'pot' && q.a === tg); return { pot: e ? e.t : null, len: window.__len }; }, x.target);
    console.log('  pot at', ev.pot, 's of the shot (+0.25 s cue), shot', ev.len);
    results.push({ shot: key, variant: vk, file, frames: n, kb: +kb.toFixed(1), potAt: ev.pot, shotLen: ev.len });
  }
}
writeFileSync(`${out}/results.json`, JSON.stringify({ level: LEVEL, fps: FPS, variants: VARIANTS, shots: SHOTS.map(([k, x]) => ({ key: k, ...x })), clips: results, errors: errs }, null, 1));
await b.close();
console.log('done', errs.length ? errs : '');
