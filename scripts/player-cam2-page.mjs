// 2026-11-28: builds mockups/player-cam2/index.html and results.json from the runs of scripts/player-cam2.mjs
// node scripts/player-cam2-page.mjs <folder with results-*.json>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2], out = 'mockups/player-cam2';
const runs = readdirSync(dir).filter((f) => /^results-\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const clips = Object.fromEntries(runs.flatMap((r) => r.clips).map((c) => [c.name, c]));
const errors = runs.flatMap((r) => r.errors ?? []);
writeFileSync(`${out}/results.json`, JSON.stringify({ seed: runs[0]?.seed, level: runs[0]?.level, fps: 30, variants: runs[0]?.variants, clips: Object.values(clips).sort((a, b) => a.name.localeCompare(b.name)), errors }, null, 1));

const s = (x) => (x == null ? '?' : x.toFixed(2));
const cm = (m) => `${Math.round(m * 100)} cm`;
const camText = (c) => {
  if (!c) return '';
  if (c.cfg.v === 'now') return 'Today: 57°, whole table.';
  const k = c.cam, bits = [];
  if (k) {
    bits.push(`height <b>${cm(k.h)}</b>, ${cm(k.back)} behind the cue ball`);
    if (k.notes?.length) bits.push(k.notes.join('; '));
    if (k.seeThrough) bits.push(`${k.seeThrough} ball(s) drawn see-through while the camera holds`);
    bits.push(`cue angle ${k.cueElDeg}°`);
  }
  if (c.cfg.v === 'V3' && c.maxAngle != null) bits.push(`steepest camera angle during the clip <b>${c.maxAngle.toFixed(1)}°</b>`);
  return bits.join(' · ') + '.';
};
const fig = (name, label) => {
  const c = clips[name];
  if (!c) return `<figure><div class="missing">missing: ${name}</div></figure>`;
  return `<figure><video src="${name}.mp4" poster="${name}.jpg" muted loop playsinline autoplay preload="auto"></video>
  <figcaption><b>${label}</b> · ${s(c.seconds)} s clip · balls stop / SHOOT back at ${s(c.shootAt)} s<br>${camText(c)}</figcaption></figure>`;
};
const sec = (id, title, what, cols, figs) => `
  <section data-shot="${id}">
    <h2>${title}</h2>
    <p class="what">${what}</p>
    <button type="button">Play all together</button>
    <div class="grid c${cols}">${figs.join('\n')}</div>
  </section>`;
const shootDiff = (a, b) => (clips[a] && clips[b] ? (clips[b].shootAt - clips[a].shootAt).toFixed(2) : '?');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Player's view camera 2</title>
<link rel="icon" href="data:,">
<style>
  :root { color-scheme: dark; --bg: #0f1513; --panel: #18211e; --text: #e8ece9; --dim: #9aa7a2; --yellow: #f2c94c; --ok: #7bd389; --no: #ef8a7a; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 1200px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .intro { color: var(--dim); margin: 0 0 18px; }
  .intro b, .what b, td b { color: var(--text); }
  section { background: var(--panel); border-radius: 14px; padding: 12px; margin-bottom: 18px; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  h3 { font-size: 14px; margin: 12px 0 4px; }
  .what { margin: 0 0 8px; color: var(--dim); }
  .ok { color: var(--ok); } .no { color: var(--no); }
  .grid { display: grid; gap: 10px; align-items: start; }
  .c2 { grid-template-columns: repeat(2, minmax(0, 260px)); } .c3 { grid-template-columns: repeat(3, 1fr); }
  .c4 { grid-template-columns: repeat(4, 1fr); } .c7 { grid-template-columns: repeat(4, 1fr); }
  figure { margin: 0; }
  video { width: 100%; height: auto; aspect-ratio: 390 / 844; display: block; border-radius: 8px; background: #000; }
  .missing { aspect-ratio: 390 / 844; display: grid; place-items: center; background: #300; border-radius: 8px; }
  figcaption { font-size: 12px; color: var(--dim); margin-top: 4px; }
  figcaption b { color: var(--yellow); }
  button { background: var(--yellow); color: #111; border: 0; border-radius: 8px; padding: 6px 12px; font-weight: 700; cursor: pointer; margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #2a3531; vertical-align: top; }
  th { color: var(--dim); font-weight: 600; }
  .scroll { overflow-x: auto; }
  ol, ul { margin: 6px 0 0 18px; padding: 0; } li { margin-bottom: 6px; }
  .q { color: var(--yellow); font-weight: 700; }
  @media (max-width: 700px) { .c3, .c4, .c7 { grid-template-columns: 1fr 1fr; } .c2 { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<main>
  <h1>Player's view camera, round 2: the random draw of 4 cameras</h1>
  <p class="intro">Video clips only, <b>the game is not changed</b>. Your choice: for each shot one camera is drawn at
    random, equal chance (1 in 4): <b>TODAY (57°), V1, V2, V3</b>. All clips come from the real game (developer
    version, same code as the test build), 390×844, 30 frames a second, in one recorded round
    (<b>${runs[0]?.seed}</b>, 15 reds). Each step is filmed <b>as it is really shot inside the round</b>, so the top
    bar, the ladder and the step count are the real ones of that shot. A clip starts at the SHOOT press (the cue's
    0.25 s stroke included) and ends 0.5 s after SHOOT comes back. In every V clip the camera goes back to 57°
    before SHOOT comes back.</p>

  <section>
    <h2>The fixed rules inside V1, V2 and V3 (used in every V clip below except the ones marked "as before")</h2>
    <ul>
      <li><b>Rise path (V3)</b>: the point the camera looks at moves in a straight line, and the camera's angle above the
        cloth, its direction round the table and its distance are blended separately. The angle only grows from 5° to
        57°, so the path never looks straight down (measured: highest angle in every fixed clip 57.0°).</li>
      <li><b>Over the cue</b>: the camera always stands at least 9 cm above the cue's centre line at its own spot. A
        cue raised over a ball or a cushion lifts the camera (H2, H3).</li>
      <li><b>Over the rail</b>: if the camera spot is outside the cloth, it stays at least 10 cm above the rail top.</li>
      <li><b>Balls in the way</b>: a ball between the camera and the cue ball (or within 10 cm of the camera) is drawn
        see-through (22%) while the camera holds, and solid again when the camera goes back to 57°.</li>
      <li><b>Full cue</b>: today the cue is shortened so that, from 57°, it never covers the object ball or its
        pocket. From behind the cue ball that rule is not needed, so the V cameras show the whole cue.</li>
      <li>All of these depend only on the layout and the planned cue direction, never on the outcome. No V camera ever
        falls back to TODAY.</li>
    </ul>
  </section>
${sec('rise', '1 · V3 rise fixed: the 3 shots of round 1',
    'The old V3 (straight blend of position and look-at point) passes through a close top-down view of the cloth about 0.5 s after the hit; the new one rises along an arc. Shot 1 = straight red into a corner (step 7), shot 2 = thin cut on the brown (step 33), shot 3 = long red (step 27).',
    3, [
      fig('s1-now', 'Shot 1 · TODAY'), fig('s1-V3old', 'Shot 1 · V3 as before'), fig('s1-V3new', 'Shot 1 · V3 fixed'),
      fig('s2-now', 'Shot 2 · TODAY'), fig('s2-V3old', 'Shot 2 · V3 as before'), fig('s2-V3new', 'Shot 2 · V3 fixed'),
      fig('s3-now', 'Shot 3 · TODAY'), fig('s3-V3old', 'Shot 3 · V3 as before'), fig('s3-V3new', 'Shot 3 · V3 fixed'),
    ])}
${sec('ret', '2 · Back to 57° after the shot, before SHOOT comes back',
    `R1 = instant cut back to 57° the moment the balls stop. R2 = a 0.4 s glide back, and SHOOT waits for it.
     Extra seconds per shot: <b>R1 0 s</b>; <b>R2 +0.4 s</b> on every V1 and V2 shot (measured: SHOOT came back
     ${shootDiff('s1-V1-R1', 's1-V1-R2')} s later for V1 and ${shootDiff('s2-V2-R1', 's2-V2-R2')} s later for V2; 0.4 s
     plus up to one frame). V3 is already at 57° when the balls stop (its rise ends 1.0 s after the hit), so R1 and R2
     look the same there and need <b>0 s</b> in the game. In this mockup the V3 R2 clip still waited the 0.4 s
     (SHOOT ${shootDiff('s3-V3new', 's3-V3-R2')} s later); the game would skip that wait when the camera is already at 57°.
     Only a shot whose balls stop less than 1.0 s after the hit would need the cut or the glide on V3.`,
    2, [
      fig('s1-V1-R1', 'V1 · R1 cut (shot 1)'), fig('s1-V1-R2', 'V1 · R2 glide (shot 1)'),
      fig('s2-V2-R1', 'V2 · R1 cut (shot 2)'), fig('s2-V2-R2', 'V2 · R2 glide (shot 2)'),
      fig('s3-V3new', 'V3 · R1 cut (shot 3)'), fig('s3-V3-R2', 'V3 · R2 glide (shot 3)'),
    ])}
${sec('h1', 'H1 · cue ball in the middle of the table, cue lying over the cloth (step 31, yellow)',
    'The cue ball is near the middle; 1.7 m of cloth behind it, so the whole cue lies over the cloth.',
    4, [fig('h1-now', 'TODAY'), fig('h1-V1', 'V1'), fig('h1-V2', 'V2'), fig('h1-V3', 'V3')])}
${sec('h2', 'H2 · a ball right behind the cue ball on the shot line (step 15, red5 10 cm behind)',
    'Top row: TODAY and the cameras as before (the camera stands behind the red, which hides the cue ball, and the cue, raised 23° over the red, runs past the lens). Bottom row: fixed (raised over the cue, the red drawn see-through).',
    4, [fig('h2-now', 'TODAY'), fig('h2-V1raw', 'V1 as before'), fig('h2-V2raw', 'V2 as before'), fig('h2-V3raw', 'V3 as before'),
      '<div></div>', fig('h2-V1', 'V1 fixed'), fig('h2-V2', 'V2 fixed'), fig('h2-V3', 'V3 fixed')])}
${sec('h3', 'H3 · cue ball 5 cm from a cushion (step 30, blue)',
    'The camera spot (50 cm or 1.05 m behind the cue ball) is outside the table. Top row: as before. Bottom row: fixed (raised over the raised cue and over the rail).',
    4, [fig('h3-now', 'TODAY'), fig('h3-V1raw', 'V1 as before'), fig('h3-V2raw', 'V2 as before'), fig('h3-V3raw', 'V3 as before'),
      '<div></div>', fig('h3-V1', 'V1 fixed'), fig('h3-V2', 'V2 fixed'), fig('h3-V3', 'V3 fixed')])}

  <section>
    <h2>3 · Pocket camera with the new draw (proposal, not built)</h2>
    <p class="what">Only one special camera per shot. The camera draw (1 in 4 each) is made from a visual-only seeded
      stream before the shot, so it says nothing about the outcome. Today's pocket cut: 1 in 6 of shots from step 2
      (never step 1 or the last ball), same for a pot and a miss; it adds about <b>1.9 s per cut</b> (NOW.md: +0.32 s
      per shot at 1 in 6). Rates per 100 shots from step 2:</p>
    <div class="scroll"><table>
      <tr><th>Option</th><th>How</th><th>Pocket cuts</th><th>TODAY (no cut)</th><th>V1 / V2 / V3</th><th>Extra s per shot, R1</th><th>Extra s per shot, R2</th></tr>
      <tr><td><b>PA</b></td><td>Pocket cut only on TODAY shots, with today's chances</td><td>4.2</td><td>20.8</td><td>25 / 25 / 25</td><td>0.08</td><td>0.28</td></tr>
      <tr><td><b>PB</b></td><td>Pocket cut only on TODAY shots, chances raised as far as the misses allow (x1.34: the miss chance of one step group then reaches 100%)</td><td>5.6</td><td>19.4</td><td>25 / 25 / 25</td><td>0.11</td><td>0.31</td></tr>
      <tr><td><b>PC</b></td><td>Pocket cut decided first, as today (1 in 6); only if there is no cut, the 4-camera draw</td><td>16.7</td><td>20.8</td><td>20.8 / 20.8 / 20.8</td><td>0.32</td><td>0.49</td></tr>
    </table></div>
    <ul>
      <li><b>Fairness</b>, P(camera | success) = P(camera | failure): PA and PB: the camera draw does not look at the
        outcome, and inside TODAY the pocket cut uses the calibrated chances that make pot and miss equal, so every
        camera has the same chance for a pot and a miss. PC: the pocket cut is equal for pot and miss (as today), so
        the rest, (1 - 1/6) / 4 for each camera, is equal too.</li>
      <li>Keeping 1 in 6 pocket cuts <b>only</b> on TODAY shots is not possible: it needs 4x the chances, and the miss
        chances (0.51-0.75 now) cannot go above 100%. The most is PB (5.6 per 100).</li>
      <li>PA is the simplest to check. PC keeps as many pocket cuts as today, but a V camera is then used only on
        shots without a pocket cut, so V is not "drawn first" any more (the rates still stay equal).</li>
      <li>Extra seconds: pocket cut 1.9 s per cut; R2 0.4 s per V1 or V2 shot; V3 about 0 (already at 57° when the
        balls stop). Step 1 and the last ball: no pocket cut in any option; the V draw is used there too.</li>
    </ul>
  </section>

  <section>
    <h2>Your questions (your decision)</h2>
    <ol>
      <li><span class="q">Return after the shot:</span> R1 (instant cut, 0 s) or R2 (0.4 s glide, +0.4 s on V1/V2 shots)?</li>
      <li><span class="q">Hard-case fixes:</span> OK as shown (raise over the cue and the rail, see-through ball, full cue)?</li>
      <li><span class="q">Pocket camera:</span> PA, PB or PC?</li>
    </ol>
  </section>
</main>
<script>
  for (const s of document.querySelectorAll('section[data-shot]')) {
    s.querySelector('button').addEventListener('click', () => {
      for (const v of s.querySelectorAll('video')) { v.currentTime = 0; v.play().catch(() => {}); }
    });
  }
</script>
</body>
</html>
`;
writeFileSync(`${out}/index.html`, html);
console.log('clips', Object.keys(clips).length, 'errors', errors.length);
