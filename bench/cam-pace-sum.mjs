// 2026-11-28 (owner, player cams round 2): sums bench/cam-pace.test.ts output. Per level: camera counts, extra seconds
// per shot (now vs plain), shot time mean / median / 90%, shots over 3.5 s and the ones the glide pushed over 3.5 s.
//   node bench/cam-pace-sum.mjs <dir>
import { readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? 'bench/results/2026-11-28/cams2';
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const out = [];
for (const lv of ['reds6', 'reds10', 'reds15']) {
  const rows = readFileSync(`${dir}/pace-${lv}.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const cams = {};
  for (const r of rows) cams[r.cam] = (cams[r.cam] ?? 0) + 1;
  const mean = (f) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const now = rows.map((r) => r.now), extra = rows.map((r) => r.now - r.plain);
  const over = rows.filter((r) => r.now > 3.5);
  const pushed = rows.filter((r) => r.today <= 3.5 && r.now > 3.5);
  const glided = rows.filter((r) => r.now > r.today + 1e-9);
  out.push(`${lv}: ${rows.length} shots; cams ${JSON.stringify(cams)}`,
    `  extra s/shot vs plain: mean ${mean((r) => r.now - r.plain).toFixed(2)}, median ${q(extra, 0.5).toFixed(2)}, 90% ${q(extra, 0.9).toFixed(2)} (pocket cut part ${mean((r) => r.today - r.plain).toFixed(2)}, glide part ${mean((r) => r.now - r.today).toFixed(2)})`,
    `  shot time s: mean ${mean((r) => r.now).toFixed(2)}, median ${q(now, 0.5).toFixed(2)}, 90% ${q(now, 0.9).toFixed(2)}, max ${Math.max(...now).toFixed(2)}`,
    `  glides: ${glided.length}, longest shot with a glide ${glided.length ? Math.max(...glided.map((r) => r.now)).toFixed(3) : '-'} s; V1/V2 shots with the glide skipped (over 3.1 s): ${rows.filter((r) => (r.cam === 'V1' || r.cam === 'V2') && r.now === r.today).length}`,
    `  over 3.5 s: ${over.length} (pocket cut ${over.filter((r) => r.cam === 'POCKET').length}, last ${over.filter((r) => r.last).length}, V1/V2 ${over.filter((r) => r.cam === 'V1' || r.cam === 'V2').length}, TODAY ${over.filter((r) => r.cam === 'TODAY').length})`,
    `  PUSHED over 3.5 s by the glide: ${pushed.length} ${JSON.stringify(pushed.map((r) => [r.seed, r.step, r.cam, r.today, r.now]))}`);
}
writeFileSync(`${dir}/pace-summary.txt`, out.join('\n') + '\n');
console.log(out.join('\n'));
