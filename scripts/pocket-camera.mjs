// 2026-11-27: pocket-camera options as still pictures (mockups/pocket-camera, PLAN 8.2 small task 1). The game is NOT
// changed: the screenshot browser gets edited copies of two modules (table3d.ts exposes its camera and scene,
// cueExamples.ts gets the frozen ball position). node scripts/pocket-camera.mjs [baseUrl]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './shot.mjs';
const base = process.argv[2] ?? 'http://localhost:5181';
const out = 'mockups/pocket-camera';
mkdirSync(out, { recursive: true });

// frozen position: the red being potted first, then 5 more reds (camera-angles mockup), colours on their spots
const REDS = '[[0.42, 1.05], [-0.30, 0.55], [-0.62, -0.75], [0.45, 0.35], [-0.20, 1.05], [0.30, -0.95]]';
const CUE = '{ x: 0.05, y: 0.62 }'; // cue ball where it stopped after hitting the red (same in every picture)
const POCKET = 'topRight'; // black-end corner, right side

const MOMENTS = [{ key: 'before', what: 'red 20 cm before the pocket' }, { key: 'jaws', what: 'red in the jaws' }];
const OPTIONS = ['P1', 'P2', 'P3'];

const b = await launch();
const results = [];
{ // one page, set up once; every picture only moves the camera and the red
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.setCacheEnabled(false);
  await p.setRequestInterception(true);
  p.on('request', async (r) => {
    const u = r.url();
    const edit = u.includes('/src/view/table3d.ts')
      // (the dev server sends the module already turned into JavaScript, one name per line in the return)
      ? (t) => t.replace(/(\n\s*)return \{(\s*)resize,/, '$1window.__t3 = { camera, renderer, scene, table, hideCue, balls: () => balls, rs: () => r * ballScale };$1return {$2resize,')
      : u.includes('/src/view/cueExamples.ts')
        ? (t) => t.replace(/const REDS[^=]*=\s*\[[\s\S]*?\]\s*\];/, `const REDS = ${REDS};`).replace(/cue:\s*\{\s*x:\s*0?\.42,\s*y:\s*-0?\.35\s*\}/, `cue: ${CUE}`)
        : null;
    if (!edit) return r.continue();
    const res = await fetch(u, { headers: r.headers() });
    const t = await res.text(), t2 = edit(t);
    if (t2 === t) errs.push('edit did not apply: ' + u);
    r.respond({ status: 200, contentType: res.headers.get('content-type') ?? 'application/javascript', body: t2 });
  });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.goto(`${base}/?level=reds6`, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.addStyleTag({ content: '#flag, #devTag, #devVer, #replayTag { display: none !important; }' });
  await p.waitForFunction('window.__dev && window.__dev.state().busy === null && window.__t3', { timeout: 60000 }).catch(async (e) => { console.log('stuck:', await p.evaluate(() => JSON.stringify({ dev: !!window.__dev, st: window.__dev?.state(), t3: !!window.__t3 })), errs.join(' | ')); throw e; });
  // mid-round (as the camera-angles mockup): step 1 played (forced success), CASH OUT and SHOOT on screen
  await p.evaluate(() => { window.__dev.force('success'); void window.__dev.start(); });
  await p.waitForFunction('window.__dev.state().busy === null && window.__dev.state().phase === "decide"', { timeout: 300000, polling: 200 });
  await p.evaluate(() => { window.__dev.force('success'); window.__dev.shoot(); });
  await new Promise((r) => setTimeout(r, 500));
  await p.waitForFunction('window.__dev.state().busy === null && window.__dev.state().phase === "decide" && window.__dev.state().cash', { timeout: 120000, polling: 200 });
  await p.evaluate(() => window.__dev.force(null));
  await new Promise((r) => setTimeout(r, 2500)); // messages and count-ups finished
  await p.evaluate(() => window.__dev.cueExample(0, 0.2));
  for (const o of OPTIONS) for (const m of MOMENTS) {
  const info = await p.evaluate(({ o, mk, pocket }) => {
    const T = window.__t3, THREE_V = T.camera.position.constructor; // THREE.Vector3 without importing three
    const V = (x, y, z) => new THREE_V(x, y, z);
    const pk = T.table.pockets.find((q) => q.id === pocket), rs = T.rs();
    const balls = T.balls(), red = balls[1], cue = balls[0];
    // the red's path: from where it was hit, straight to the pocket's drop circle
    const S = { x: 0.42, y: 1.05 }, E = pk.captureCentre, M = pk.mouthMid;
    const L = Math.hypot(E.x - S.x, E.y - S.y), u = { x: (E.x - S.x) / L, y: (E.y - S.y) / L };
    // distance along the path from the start to the jaws (the point of the path level with the mouth middle)
    const sM = (M.x - S.x) * u.x + (M.y - S.y) * u.y;
    const at = (s) => ({ x: S.x + u.x * s, y: S.y + u.y * s });
    const q = mk === 'before' ? at(sM - 0.20) : at(sM);
    red.position.set(q.x, q.y, rs);
    T.hideCue();
    const J = at(sM); // the jaws point on the path
    const C = { x: cue.position.x, y: cue.position.y };
    const cam = T.camera;
    if (o === 'P1') { // low behind the pocket, looking back along the path toward the cue ball
      const A = at(sM - 0.45); cam.fov = 55; cam.position.set(J.x + u.x * 0.30, J.y + u.y * 0.30, 0.30); cam.lookAt(V(A.x, A.y, 0));
    } else if (o === 'P2') { // high above the pocket, looking down at the jaws and the net
      cam.fov = 40; cam.position.set(J.x - u.x * 0.12, J.y - u.y * 0.12, 0.75); cam.lookAt(V(J.x + u.x * 0.02, J.y + u.y * 0.02, 0));
    } else { // from the side at cloth height: the pocket and the last 30 cm of the path
      // in a corner a camera square to the path would stand outside the table (behind the rail), so it stands a
      // little in front: 0.40 m to the side and 0.40 m back along the path, inside the cushions, about 45° off square
      let n = { x: -u.y, y: u.x };
      const mid = at(sM - 0.13), place = (k) => ({ x: mid.x + n.x * 0.40 * k - u.x * 0.40, y: mid.y + n.y * 0.40 * k - u.y * 0.40 });
      const ok = (q) => Math.abs(q.x) < T.table.halfWidth - 0.06 && Math.abs(q.y) < T.table.halfLength - 0.06;
      if (!ok(place(1))) n = { x: -n.x, y: -n.y };
      const P = place(1);
      if (!ok(P)) throw new Error('P3 camera outside the cushions');
      const A = at(sM - 0.05); cam.fov = 60; cam.position.set(P.x, P.y, 0.09); cam.lookAt(V(A.x, A.y, -0.12));
    }
    cam.updateProjectionMatrix();
    T.renderer.render(T.scene, cam);
    return { red: q, distToMouth: Math.round(Math.hypot(q.x - M.x, q.y - M.y) * 100), cam: cam.position.toArray().map((v) => +v.toFixed(3)) };
  }, { o, mk: m.key, pocket: POCKET });
  await new Promise((r) => setTimeout(r, 300));
  // whole UI on screen: top bar, ladder, CASH OUT / SHOOT and the canvas all inside the 390x844 window
  const ui = await p.evaluate(() => ['top', 'ladder', 'bShoot', 'bCash'].map((id) => { const e = document.getElementById(id); if (!e) return { id, missing: true };
    const r = e.getBoundingClientRect(); return { id, inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.height > 0 }; }));
  const name = `${o}-${m.key}.jpg`;
  await p.screenshot({ path: `${out}/${name}`, type: 'jpeg', quality: 78 });
  results.push({ option: o, moment: m.key, ...info, ui, errs });
  console.log(name, JSON.stringify(info), JSON.stringify(ui), errs.join(' | '));
  }
  await p.close();
}
await b.close();
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
