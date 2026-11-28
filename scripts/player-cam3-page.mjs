// 2026-11-28: builds mockups/player-cam3/index.html and results.json from the runs of scripts/player-cam3.mjs
// node scripts/player-cam3-page.mjs <folder with results-*.json>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2], out = 'mockups/player-cam3';
const runs = readdirSync(dir).filter((f) => /^results-\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const clips = Object.fromEntries(runs.flatMap((r) => r.clips).map((c) => [c.name, c]));
const errors = runs.flatMap((r) => r.errors ?? []);
writeFileSync(`${out}/results.json`, JSON.stringify({ seed: runs[0]?.seed, level: runs[0]?.level, fps: 30, variants: runs[0]?.variants, clips: Object.values(clips).sort((a, b) => a.name.localeCompare(b.name)), errors }, null, 1));

const s = (x) => (x == null ? '?' : x.toFixed(2));
const cm = (m) => `${Math.round(m * 100)} cm`;
const PK = { topLeft: 'top left corner', topRight: 'top right corner', bottomLeft: 'bottom left corner', bottomRight: 'bottom right corner', middleLeft: 'left middle', middleRight: 'right middle' };
const camText = (c) => {
  if (c.cfg.v === 'now') return 'Today: 57°, whole table.';
  const k = c.cam, bits = [];
  if (k) {
    bits.push(`holds at <b>${cm(k.h)}</b> high, ${cm(k.back)} behind the cue ball`);
    if (k.notes?.length) bits.push(k.notes.join('; '));
    if (k.seeThrough) bits.push(`${k.seeThrough} ball(s) see-through while it holds`);
    const f = k.follow;
    if (f) bits.push(`follows the <b>${f.target}</b> to the <b>${PK[f.pocket] ?? f.pocket}</b> pocket: slides ${cm(f.slid)}, ends ${s(f.endDist)} m from the pocket, ${cm(f.endH)} high, <b>${f.endAngle}°</b> above the cloth, zoom ${f.fov}°${k.lifted ? ', lifted over the rail on the way' : ''}`);
  }
  if (c.cfg.v === 'V3' && c.maxAngle != null) bits.push(`steepest angle ${c.maxAngle.toFixed(1)}°`);
  return bits.join(' · ') + '.';
};
const res = (c) => (c.outcome === 'success' ? '<span class="ok">potted</span>' : `<span class="no">missed (${c.outcome})</span>`);
const fig = (name, label) => {
  const c = clips[name];
  if (!c) return `<figure><div class="missing">missing: ${name}</div></figure>`;
  const back = c.shootAt != null ? `SHOOT back at ${s(c.shootAt)} s` : 'round over (miss)';
  return `<figure><video src="${name}.mp4" poster="${name}.jpg" muted loop playsinline autoplay preload="auto"></video>
  <figcaption><b>${label}</b> · ${res(c)} · ${s(c.seconds)} s clip · balls stop at ${s(c.ballsStopAt)} s · ${back}<br>${camText(c)}</figcaption></figure>`;
};
const SIX = (p) => [fig(`${p}-now`, 'TODAY'), fig(`${p}-V3`, 'V3 (rise)'), '<div class="gap"></div>',
  fig(`${p}-V1F1`, 'V1 · F1 turn'), fig(`${p}-V1F2`, 'V1 · F2 turn and lift'), '<div class="gap"></div>',
  fig(`${p}-V2F1`, 'V2 · F1 turn'), fig(`${p}-V2F2`, 'V2 · F2 turn and lift')];
const sec = (id, title, what) => `
  <section data-shot="${id}">
    <h2>${title}</h2>
    <p class="what">${what}</p>
    <button type="button">Play all together</button>
    <div class="grid">${SIX(id).filter((x) => !x.includes('class="gap"')).join('\n')}</div>
  </section>`;
// extra seconds: SHOOT back (V with R2) minus SHOOT back (TODAY), per shot
const shots = ['cut', 'h1', 'h2', 'long'];
const diff = (v) => shots.map((p) => (clips[`${p}-${v}`]?.shootAt ?? NaN) - (clips[`${p}-now`]?.shootAt ?? NaN));
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const ext = Object.fromEntries(['V1F1', 'V1F2', 'V2F1', 'V2F2', 'V3'].map((v) => [v, diff(v)]));
const extRow = (v, label) => `<tr><td>${label}</td>${ext[v].map((x) => `<td>${isNaN(x) ? '?' : '+' + x.toFixed(2)}</td>`).join('')}<td><b>${isNaN(avg(ext[v])) ? '?' : '+' + avg(ext[v]).toFixed(2)}</b></td></tr>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Player's view camera 3</title>
<link rel="icon" href="data:,">
<style>
  :root { color-scheme: dark; --bg: #0f1513; --panel: #18211e; --text: #e8ece9; --dim: #9aa7a2; --yellow: #f2c94c; --ok: #7bd389; --no: #ef8a7a; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 1200px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .intro { color: var(--dim); margin: 0 0 18px; }
  .intro b, .what b, td b, li b { color: var(--text); }
  section { background: var(--panel); border-radius: 14px; padding: 12px; margin-bottom: 18px; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  .what { margin: 0 0 8px; color: var(--dim); }
  .ok { color: var(--ok); } .no { color: var(--no); }
  .grid { display: grid; gap: 10px; align-items: start; grid-template-columns: repeat(6, 1fr); }
  figure { margin: 0; min-width: 0; }
  video { width: 100%; height: auto; aspect-ratio: 390 / 844; display: block; border-radius: 8px; background: #000; }
  .missing { aspect-ratio: 390 / 844; display: grid; place-items: center; background: #300; border-radius: 8px; }
  figcaption { font-size: 12px; color: var(--dim); margin-top: 4px; overflow-wrap: anywhere; }
  figcaption b { color: var(--yellow); }
  button { background: var(--yellow); color: #111; border: 0; border-radius: 8px; padding: 6px 12px; font-weight: 700; cursor: pointer; margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #2a3531; vertical-align: top; }
  th { color: var(--dim); font-weight: 600; }
  .scroll { overflow-x: auto; }
  ul, ol { margin: 6px 0 0 18px; padding: 0; } li { margin-bottom: 6px; }
  .q { color: var(--yellow); font-weight: 700; }
  @media (max-width: 1000px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<main>
  <h1>Player's view camera, round 3: V1 and V2 follow the ball to the pocket</h1>
  <p class="intro">Video clips only, <b>the game is not changed</b>. Same round as before (<b>${runs[0]?.seed}</b>,
    15 reds), filmed inside the real round (real top bar and ladder), 390×844, 30 frames a second. A clip starts at
    the SHOOT press and ends 0.5 s after SHOOT comes back. Every V clip uses your choices: the hard-case fixes (over
    the cue, over the rail, see-through ball, full cue) and the <b>R2 0.4 s glide</b> back to 57°. Each shot shows
    6 clips: <b>TODAY</b>, <b>V3</b>, then <b>V1 F1</b>, <b>V1 F2</b>, <b>V2 F1</b>, <b>V2 F2</b>.</p>

  <section>
    <h2>The two follow options (V1 and V2 only)</h2>
    <ul>
      <li><b>F1 "turn"</b>: 0.1 s after the cue hits the cue ball, the camera turns in 0.8 s (a smooth start and stop)
        to look at the pocket the shot aims at. It may slide up to 80 cm to a spot on the line pocket → ball, behind the
        ball and at most 1.6 m from the pocket (25 cm to the side if that spot is in front of the ball, so the ball
        never rolls under the lens). It keeps its height (V1 16 cm, V2 55 cm, or more where a fix lifted it) and zooms
        in so the view is about 80 cm wide at the pocket.</li>
      <li><b>F2 "turn and lift"</b>: the same turn and slide, but it also rises to <b>30° above the cloth</b> (seen from
        the pocket) and comes to at most 1.5 m from the pocket, so you look down into the pocket and see the drop.</li>
      <li>Safe path (the H2/H3 rules): the move is an arc around the moving look-at point (never top-down, the
        steepest angle in any clip is the 57° of the main camera); it never slides further outside the cloth than the
        hold spot; outside the cloth it stays at least 10 cm above the rail; it never goes lower than its hold height.</li>
      <li>Then R2: when the balls stop, a 0.4 s glide back to 57°, and SHOOT waits for it.</li>
    </ul>
  </section>

  <section>
    <h2>Fair for a pot and a miss</h2>
    <ul>
      <li>The follow uses only the <b>planned shot</b>: which ball (target), which pocket it is played at (pocket), where
        that ball stands before the shot, and the pocket's mouth. It never reads the recorded roll of the balls, where
        they stop, or whether anything dropped.</li>
      <li>The timing is fixed from the hit (start 0.1 s, move 0.8 s), the same for every shot. A pot and a miss give the
        same camera move; only the balls themselves show the result, when they reach the pocket.</li>
      <li>The only thing that differs is when the camera goes back to 57°: when the balls stop. That is the same as today.</li>
    </ul>
  </section>
${sec('cut', 'Thin cut on the brown (step 33)', 'The shot of rounds 1 and 2 where the pot was off-screen in V1/V2.')}
${sec('miss', 'The same brown, a forced MISS (step 33, plain miss)', 'The round was played again with step 33 forced to a plain miss: the brown is aimed at a pocket with a small error and stays out. Same follow rules as the pot. The round ends here, so no SHOOT comes back.')}
${sec('h1', 'H1 · cue ball mid-table, yellow (step 31)', 'In round 2 the yellow was potted off-screen in V1 and V2.')}
${sec('h2', 'H2 · a ball right behind the cue ball (step 15)', 'The camera is raised over the cue and the red behind is see-through while it holds; then the follow.')}
${sec('long', 'The long red (step 27)', 'A long pot: the follow slides towards the far pocket and zooms in.')}

  <section>
    <h2>Extra seconds per shot</h2>
    <p class="what">Measured: when SHOOT came back in each V clip minus when it came back in the TODAY clip of the
      same shot (30 frames a second, so ±0.03 s).</p>
    <div class="scroll"><table>
      <tr><th>Camera</th><th>Brown cut</th><th>H1 yellow</th><th>H2 red</th><th>Long red</th><th>Average</th></tr>
      ${extRow('V1F1', 'V1 F1')}${extRow('V1F2', 'V1 F2')}${extRow('V2F1', 'V2 F1')}${extRow('V2F2', 'V2 F2')}${extRow('V3', 'V3 (mockup waits the glide; the game would not)')}
    </table></div>
    <ul>
      <li>The follow itself adds <b>nothing</b>: it happens while the balls roll. The extra is only the R2 glide
        (0.4 s), the same as without the follow.</li>
      <li>With PC + R2 (per 100 shots from step 2): 16.7 pocket cuts × 1.9 s, plus V1 and V2 (20.8 each) × 0.4 s, V3
        and TODAY 0 s = <b>about +0.49 s per shot</b> on average, with F1 or F2 the same.</li>
    </ul>
  </section>

  <section>
    <h2>Your questions (your decision)</h2>
    <ol>
      <li><span class="q">Follow for V1 and V2:</span> F1 (turn, stays low) or F2 (turn and lift to 30°)? Or F1 for one and F2 for the other?</li>
      <li><span class="q">Speed of the turn:</span> 0.8 s (as shown), faster, or slower?</li>
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
console.log('clips', Object.keys(clips).length, 'errors', errors.length, 'extra', JSON.stringify(ext));
