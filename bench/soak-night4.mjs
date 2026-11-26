// Night 4 soak summary: node bench/soak-night4.mjs <dir> [cueLeadSeconds=0.25]  -> <dir>/night4.txt
// Uses the night-3 summary (stuck, RE-RACK, off table, fallback, success vs p) and the per-shot log (SHOTS=1):
//  - Part 3b: playback length with the faster end ON vs OFF per level (median, 90%, count over 3.5 s, longest)
//  - Part 4: pace with the cue ON (shot + cue lead) vs OFF, per level and per kind (median, 90%, longest)
//  - failure shots: share of each failure type per level, and their length (median, 90%, longest)
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2];
const lead = Number(process.argv[3] ?? 0.25);
const base = execFileSync('node', ['bench/soak-night3.mjs', dir], { encoding: 'utf8' });
const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const stats = (a) => `median ${f2(q(a, 0.5))} s, 90% ${f2(q(a, 0.9))} s, over 3.5 s ${a.filter((x) => x > 3.5).length}, longest ${f2(Math.max(...a))} s (${a.length} shots)`;
const by = {};
for (const f of readdirSync(dir).filter((x) => /-shots\.jsonl$/.test(x))) {
  const level = f.split('-')[0];
  const rows = readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  (by[level] ??= []).push(...rows);
}
const out = ['== night-3 style summary ==', base.trim(), ''];
for (const level of ['reds6', 'reds10', 'reds15']) {
  const rows = by[level]; if (!rows) continue;
  const played = rows.filter((r) => r.d !== undefined);
  const succ = played.filter((r) => r.outcome === 'success'), fail = played.filter((r) => r.outcome !== 'success');
  const lastResort = (r) => r.flex === 'exhibition' || r.flex === 'rescue';
  out.push(`== ${level}: ${rows.length} SHOOT shots (${succ.length} success, ${fail.length} failure, ${rows.length - played.length} RE-RACK) ==`);
  out.push(`Part 3b playback, all shots    OFF: ${stats(played.map((r) => r.d))}`);
  out.push(`                               ON : ${stats(played.map((r) => r.play))}`);
  out.push(`  success shots                OFF: ${stats(succ.map((r) => r.d))}`);
  out.push(`                               ON : ${stats(succ.map((r) => r.play))}`);
  out.push(`  success, not last resort     OFF over 3.5 s ${succ.filter((r) => !lastResort(r) && r.d > 3.5).length}, ON over 3.5 s ${succ.filter((r) => !lastResort(r) && r.play > 3.5).length}`);
  out.push(`  failure shots                OFF: ${stats(fail.map((r) => r.d))}`);
  out.push(`                               ON : ${stats(fail.map((r) => r.play))}`);
  out.push(`  shots sped up: ${played.filter((r) => r.play < r.d - 1e-6).length} of ${played.length}; result never visible (no speed-up): ${played.filter((r) => r.vis === null).length}`);
  for (const kind of ['red', 'colour']) {
    const k = played.filter((r) => (kind === 'red') === (r.target === 'red'));
    out.push(`Part 4 pace (${kind}), cue OFF: ${stats(k.map((r) => r.d))}`);
    out.push(`                 cue ON : ${stats(k.map((r) => r.d + lead))} (cue lead ${lead} s before the balls roll)`);
  }
  const labels = {};
  for (const r of fail) labels[r.outcome] = (labels[r.outcome] ?? 0) + 1;
  out.push(`Failure types: ${Object.entries(labels).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} (${((100 * v) / fail.length).toFixed(1)}%)`).join(', ')}`);
  for (const [k] of Object.entries(labels)) out.push(`  ${k} length: ${stats(fail.filter((r) => r.outcome === k).map((r) => r.d))}`);
  out.push(`Solve time (success shots, ms, PC under load): median ${q(succ.map((r) => r.ms), 0.5)}, 90% ${q(succ.map((r) => r.ms), 0.9)}, max ${Math.max(...succ.map((r) => r.ms))}`);
  out.push('');
}
writeFileSync(`${dir}/night4.txt`, out.join('\n'));
console.log(out.join('\n'));
