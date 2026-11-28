// 2026-11-28: player's view camera, round 2 (mockups/player-cam2). The game is NOT changed: the recording browser gets
// edited copies of table3d.ts (a camera hook before each render, the cue plan and the ball meshes exposed) and
// gamePage.ts (playShot wrapped: logs every shot, films the asked steps, holds the end for the R2 glide). The real
// round is played (forced success) and the asked steps are filmed as they are really shot, so the HUD is the real one.
// Time (performance.now, requestAnimationFrame, setTimeout) is stepped frame by frame while filming, 30 fps.
//   node scripts/player-cam2.mjs find  [rounds]          -> logs shots of SEED + random rounds, prints hard cases
//   node scripts/player-cam2.mjs film  '<jobs json>'     -> jobs: [{ step, name, cfg }], one round of SEED
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, statSync, existsSync, readFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const base = process.env.BASE ?? 'http://localhost:5181';
const out = 'mockups/player-cam2';
const tmp = process.env.TMPDIR_PC;
mkdirSync(out, { recursive: true });
const FFMPEG = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const FPS = 30, LEVEL = process.env.LEVEL ?? 'reds15';
const [mode, arg] = process.argv.slice(2);

const b = await launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.evaluateOnNewDocument(() => {
  const realNow = performance.now.bind(performance), realRaf = window.requestAnimationFrame.bind(window);
  const realST = window.setTimeout.bind(window), realCT = window.clearTimeout.bind(window);
  let offset = 0, stepping = false, vt = 0, queue = [], timers = [], nextId = 1e9;
  performance.now = () => (stepping ? vt : realNow() + offset);
  window.requestAnimationFrame = (cb) => { if (stepping) { queue.push(cb); return queue.length; } return realRaf(() => cb(performance.now())); };
  window.setTimeout = (cb, ms = 0, ...a) => { if (!stepping) return realST(cb, ms, ...a); const id = nextId++; timers.push({ id, due: vt + (ms || 0), cb: () => cb(...a) }); return id; };
  window.clearTimeout = (id) => { if (id >= 1e9) timers = timers.filter((t) => t.id !== id); else realCT(id); };
  window.__clock = {
    stepping: () => stepping,
    stepOn: () => { if (!stepping) { vt = realNow() + offset; stepping = true; } },
    stepOff: () => {
      if (!stepping) return;
      offset = vt - realNow(); stepping = false;
      const q = queue; queue = []; q.forEach((cb) => realRaf(() => cb(performance.now())));
      const ts = timers; timers = []; ts.forEach((t) => realST(t.cb, Math.max(0, t.due - vt)));
    },
    step: (ms) => {
      vt += ms;
      for (let guard = 0; guard < 50; guard++) { // timers due by now (a timer may add another)
        const due = timers.filter((t) => t.due <= vt).sort((a, c) => a.due - c.due);
        if (!due.length) break;
        timers = timers.filter((t) => !due.includes(t));
        for (const t of due) t.cb();
      }
      const q = queue; queue = []; q.forEach((cb) => cb(vt));
    },
    now: () => performance.now(),
  };
});
await p.setCacheEnabled(false);
await p.setRequestInterception(true);
const T3 = (t) => t
  .replace('renderer.render(scene, camera);', 'if (window.__camHook) window.__camHook(camera, fit, { balls, heights, rs: r * ballScale, table }); renderer.render(scene, camera);')
  .replace(/function showCue\(C, plan, gap, alpha\) \{/, (m) => `${m}\n    if (window.__cueFullLen) plan = { ...plan, len: window.__cueFullLen };`)
  .replace(/return \{\s*axis(: axis)?,\s*el,\s*len\s*\};/, (m) => `window.__cuePlan = { el, len }; ${m}`); // the cue's angle of THIS shot
const GP = (t) => t
  .replace(/if \(!PC_LINK\) return;(\s*const body = costBody)/, 'return;$1') // no shot-cost lines to the PC from these runs
  .replace(/toast\(`forced: \$\{FORCE_TEXT\[forced\]\}`\)/, 'void 0') // no "forced" toast in the clips
  .replace(/function playShot\(balls, s, opts = \{\}\) \{/, 'function playShot0(balls, s, opts = {}) {')
  + `
function playShot(balls, s, opts = {}) {
  const step = round.step, job = (window.__jobs || {})[step];
  if (window.__shotLog) window.__shotLog.push({ balls: JSON.parse(JSON.stringify(balls)), s: JSON.parse(JSON.stringify(s)), code: round.roundCode, step });
  if (!job) return playShot0(balls, s, opts);
  window.__clock.stepOn();
  const cue = balls.find((q) => q.kind === 'cue');
  window.__film = { step, name: job.name, cfg: job.cfg, start: performance.now(), end: null, C: { ...cue.pos }, dir: { ...s.dir } };
  window.__cueFullLen = job.cfg.v !== 'now' && job.cfg.fullCue ? 1.47 : null;
  window.__camHook = window.__makeHook(window.__film);
  return playShot0(balls, s, { ...opts, cam: undefined }).then(async (len) => {
    window.__film.end = performance.now();
    draw3d();
    if (job.cfg.ret === 'R2' && job.cfg.v !== 'now') {
      const until = performance.now() + 400;
      await new Promise((res) => { const f = () => { draw3d(); if (performance.now() >= until) res(); else requestAnimationFrame(f); }; f(); });
    }
    window.__cueFullLen = null;
    return len;
  });
}
window.__pc = { table: () => table, draw3d };
`;
p.on('request', async (r) => {
  const u = r.url();
  const edit = u.includes('/src/view/table3d.ts') ? T3 : u.includes('/src/game/gamePage.ts') ? GP : null;
  if (!edit) return r.continue();
  const res = await fetch(u, { headers: r.headers() });
  const t = await res.text(), t2 = edit(t);
  if (u.includes('table3d') && !(t2.includes('__camHook') && t2.includes('window.__cuePlan = { el, len }') && t2.includes('__cueFullLen'))) errs.push('table3d edit did not apply');
  if (u.includes('gamePage') && !(t2.includes('playShot0(balls') && !/if \(!PC_LINK\) return;\s*const body/.test(t2) && !t2.includes('forced: ${FORCE_TEXT'))) errs.push('gamePage edit did not apply');
  r.respond({ status: 200, contentType: res.headers.get('content-type') ?? 'application/javascript', body: t2 });
});
// the camera hook (runs in the page). Poses are { pos:[x,y,z], at:[x,y,z], fov }.
await p.evaluateOnNewDocument(() => {
  const VAR = {
    V1: { back: 0.50, h: 0.16, ahead: 1.2, fov: 50 },
    V2: { back: 1.05, h: 0.55, ahead: 0.9, fov: 52 },
    V3: { back: 0.50, h: 0.16, ahead: 1.2, fov: 50, rise: 1.0 },
  };
  window.__VAR = VAR;
  const ss = (k) => k * k * (3 - 2 * k), cl = (k) => Math.max(0, Math.min(1, k));
  const lerp = (a, c, k) => a + (c - a) * k;
  const lin = (A, B, k) => ({ pos: A.pos.map((v, i) => lerp(v, B.pos[i], k)), at: A.at.map((v, i) => lerp(v, B.at[i], k)), fov: lerp(A.fov, B.fov, k) });
  // orbit blend: the look-at point moves in a straight line; the camera's angle above the cloth, its compass direction
  // and its distance from that point are blended separately, so the angle stays between the two ends (never steeper
  // than 57°, never straight down) and the camera never dives towards the cloth
  const sph = (P) => { const dx = P.pos[0] - P.at[0], dy = P.pos[1] - P.at[1], dz = P.pos[2] - P.at[2], D = Math.hypot(dx, dy, dz); return { D, el: Math.asin(dz / D), yaw: Math.atan2(dy, dx) }; };
  const orbit = (A, B, k) => {
    const a = sph(A), c = sph(B);
    let dy = c.yaw - a.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const at = A.at.map((v, i) => lerp(v, B.at[i], k)), D = lerp(a.D, c.D, k), el = lerp(a.el, c.el, k), yaw = a.yaw + dy * k;
    return { pos: [at[0] + D * Math.cos(el) * Math.cos(yaw), at[1] + D * Math.cos(el) * Math.sin(yaw), at[2] + D * Math.sin(el)], at, fov: lerp(A.fov, B.fov, k) };
  };
  const fitPose = (fit) => ({ pos: [...fit.position], at: [...fit.lookAt], fov: fit.fov });
  window.__makeHook = (F) => {
    const cfg = F.cfg;
    if (cfg.v === 'now') return null;
    const V = VAR[cfg.v], dl = Math.hypot(F.dir.x, F.dir.y), d = { x: F.dir.x / dl, y: F.dir.y / dl }, C = F.C;
    let hold = null, faded = [], retFrom = null, info = null;
    const holdPose = (env) => {
      const { rs, heights, table } = env;
      let back = V.back, h = V.h;
      const notes = [];
      const el = window.__cuePlan ? window.__cuePlan.el : 0;
      if (cfg.fix) {
        // (1) never under or inside the cue: at least 9 cm above the cue's centre line where the camera stands
        const cueZ = rs + back * Math.tan(el);
        if (h < cueZ + 0.09 - 0.005) { notes.push(`raised over the cue ${h.toFixed(2)} -> ${(cueZ + 0.09).toFixed(2)} m`); h = cueZ + 0.09; }
        // (2) behind a cushion: outside the cloth the camera stays at least 10 cm above the rail top
        const x = C.x - d.x * back, y = C.y - d.y * back;
        if (Math.abs(x) > table.halfWidth || Math.abs(y) > table.halfLength) {
          const need = heights.railZ + 0.10;
          if (h < need) { notes.push(`over the rail ${h.toFixed(2)} -> ${need.toFixed(2)} m`); h = need; }
        }
      }
      info = { back, h: +h.toFixed(3), cueElDeg: +(el * 180 / Math.PI).toFixed(1), notes };
      return { pos: [C.x - d.x * back, C.y - d.y * back, h], at: [C.x + d.x * V.ahead, C.y + d.y * V.ahead, 0], fov: V.fov };
    };
    const fade = (env, on) => {
      // (3) a ball between the camera and the cue ball (or round the camera) is drawn see-through while the camera holds
      if (!cfg.fix) return;
      if (!on) { for (const m of faded) { m.material.opacity = 1; m.material.transparent = false; m.material.depthWrite = true; m.material.needsUpdate = true; } faded = []; return; }
      const [cx, cy, cz] = hold.pos, rs = env.rs;
      for (const m of env.balls) {
        if (!m.visible || faded.includes(m)) continue;
        const bx = m.position.x, by = m.position.y;
        if (Math.hypot(bx - C.x, by - C.y) < rs * 0.5) continue; // the cue ball itself
        // distance from the ball to the segment camera -> cue ball centre (3D)
        const ex = C.x - cx, ey = C.y - cy, ez = rs - cz, L2 = ex * ex + ey * ey + ez * ez;
        const t = Math.max(0, Math.min(1, ((bx - cx) * ex + (by - cy) * ey + (rs - cz) * ez) / L2));
        const dist = Math.hypot(cx + ex * t - bx, cy + ey * t - by, cz + ez * t - rs);
        if ((dist < rs * 2.1 && t < 0.98) || Math.hypot(bx - cx, by - cy, rs - cz) < 0.10) { m.material.transparent = true; m.material.opacity = 0.22; m.material.depthWrite = false; m.material.needsUpdate = true; faded.push(m); }
      }
      if (faded.length && info) info.seeThrough = Math.max(info.seeThrough ?? 0, faded.length);
    };
    const hook = (cam, fit, env) => {
      if (!hold) hold = holdPose(env);
      const now = performance.now(), tau = (now - F.start) / 1000 - 0.25; // seconds since the tip hit the cue ball
      const FIT = fitPose(fit);
      let A = hold, fadeOn = true;
      if (V.rise) {
        const k = ss(cl(tau / V.rise));
        A = cfg.rise === 'old' ? lin(hold, FIT, k) : orbit(hold, FIT, k);
        if (k > 0.35) fadeOn = false;
      }
      if (F.end !== null) { // the balls have stopped: back to the main camera
        if (!retFrom) retFrom = A;
        if (cfg.ret === 'R2') { const k = ss(cl((now - F.end) / 400)); A = orbit(retFrom, FIT, k); fadeOn = k < 0.5; } else { A = FIT; fadeOn = false; }
      }
      fade(env, fadeOn);
      cam.fov = A.fov; cam.position.set(...A.pos); cam.lookAt(A.at[0], A.at[1], A.at[2]); cam.updateProjectionMatrix();
      window.__camInfo = info;
      // lowest camera angle while moving (for the report: never straight down)
      const dz = A.pos[2] - A.at[2], hor = Math.hypot(A.pos[0] - A.at[0], A.pos[1] - A.at[1]);
      const ang = Math.atan2(dz, hor) * 180 / Math.PI;
      window.__maxAngle = Math.max(window.__maxAngle ?? -90, ang);
    };
    return hook;
  };
});
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await p.goto(`${base}/?level=${LEVEL}${process.env.SEED ? `&seed=${process.env.SEED}` : ''}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.addStyleTag({ content: '#flag, #devTag, #devVer, #replayTag { display: none !important; }' });
await p.waitForFunction('window.__dev && window.__dev.state().busy === null && window.__pc', { timeout: 60000 })
  .catch((e) => { console.log('stuck', errs.join(' | ')); throw e; });
if (errs.length) { console.log('errors:', errs); process.exit(1); }

const jobs = mode === 'film' ? JSON.parse(existsSync(arg) ? readFileSync(arg, 'utf8') : arg) : [];
const lastStep = Math.max(0, ...jobs.map((j) => j.step));
await p.evaluate((J) => { window.__shotLog = []; window.__jobs = J; window.__dev.setSlow(25); }, Object.fromEntries(jobs.map((j) => [j.step, j])));
const results = [];

async function filmOne() {
  const F = await p.evaluate(() => ({ name: window.__film.name, step: window.__film.step, cfg: window.__film.cfg }));
  await p.evaluate(() => window.__dev.setSlow(1)); // (the clock is stepped now; setSlow 1 = real speed in the clip)
  const dir = `${tmp}/${F.name}`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  let n = 0, after = -1, shootAt = null, endAt = null;
  const MAXF = FPS * 9;
  for (; n < MAXF; n++) {
    await p.screenshot({ path: `${dir}/f${String(n).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
    await p.evaluate((ms) => window.__clock.step(ms), 1000 / FPS);
    const st = await p.evaluate(() => ({ s: window.__dev.state(), end: window.__film.end, start: window.__film.start, now: performance.now() }));
    if (st.end !== null && endAt === null) endAt = (st.end - st.start) / 1000;
    if (after < 0 && st.s.busy === null && st.s.phase === 'decide' && st.s.shootBtn) { after = 15; shootAt = (st.now - st.start) / 1000; }
    if (after >= 0 && after-- === 0) break;
  }
  const info = await p.evaluate(() => ({ cam: window.__camInfo ?? null, maxAngle: window.__maxAngle ?? null }));
  await p.evaluate(() => { window.__camHook = null; window.__maxAngle = undefined; window.__camInfo = undefined; window.__film = null; window.__clock.stepOff(); window.__dev.setSlow(25); });
  const file = `${out}/${F.name}.mp4`;
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/f%04d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file]);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', `${dir}/f0012.jpg`, '-q:v', '5', `${out}/${F.name}.jpg`]);
  const kb = statSync(file).size / 1000;
  const r = { ...F, frames: n, seconds: +(n / FPS).toFixed(2), kb: +kb.toFixed(1), ballsStopAt: endAt, shootAt, ...info };
  console.log(JSON.stringify(r));
  results.push(r);
}

// play the round: step 1 comes with START, then SHOOT each step (forced success); filmed steps are caught on the way
await p.evaluate(() => { window.__dev.force('success'); void window.__dev.start(); });
for (let i = 0; i < 60; i++) {
  // wait for the decide phase, filming any shot that starts on the way
  for (;;) {
    const s = await p.evaluate(() => ({ film: !!window.__film, st: window.__dev.state() }));
    if (s.film) { await filmOne(); continue; }
    if (s.st.busy === null && (s.st.phase === 'decide' || s.st.end)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const st = await p.evaluate(() => window.__dev.state());
  if (st.end || st.phase !== 'decide' || (mode === 'film' && st.step >= lastStep)) break;
  await p.evaluate(() => { window.__dev.force('success'); window.__dev.shoot(); });
  await new Promise((r) => setTimeout(r, 150));
}
const log = await p.evaluate(() => window.__shotLog);
if (mode === 'film') {
  writeFileSync(`${tmp}/results-${process.env.RUN ?? 'x'}.json`, JSON.stringify({ level: LEVEL, seed: process.env.SEED, fps: FPS, variants: await p.evaluate(() => window.__VAR), clips: results, errors: errs }, null, 1));
} else {
  writeFileSync(`${tmp}/shotlog-${process.env.SEED ?? 'x'}.json`, JSON.stringify(log));
  console.log('shots logged', log.length, 'code', log[0]?.code);
}
if (errs.length) console.log('page errors:', errs);
await b.close();
