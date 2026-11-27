// Night 8 step 2: 6-red soak summary. node bench/night8/soak-sum.mjs <dir> [baseline dir = bench/results/night6/soak]
// RE-RACK per 100,000 shots with the exact upper 95% bound (Poisson); long shots three ways (A = the night-7 measure
// behind "65": success shots over 3.5 s, not exhibition / rescue; B = success shots over 3 s; C = any shot over 3 s),
// on the night-6 seeds (5,000,000 .. 5,000,999, same seeds = same outcomes, only the break library differs) and on all
// rounds; per-step success against p(step). Writes <dir>/step2.txt.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2], baseDir = process.argv[3] ?? 'bench/results/night6/soak';
const LEVEL = 'reds6';
// exact Poisson upper 95% bound (one-sided) for k events: smallest m with P(X <= k | m) <= 0.05
const upper = (k) => { let lo = 0, hi = 50 + 10 * k; for (let it = 0; it < 100; it++) { const m = (lo + hi) / 2; let p = 0, t = Math.exp(-m); for (let i = 0; i <= k; i++) { p += t; t *= m / (i + 1); } if (p > 0.05) lo = m; else hi = m; } return hi; };
function load(d) {
  const shots = [], json = [], fails = [];
  for (const f of readdirSync(d)) {
    if (f.startsWith(LEVEL + '-') && f.endsWith('-shots.jsonl')) for (const l of readFileSync(`${d}/${f}`, 'utf8').split('\n')) if (l.trim()) shots.push(JSON.parse(l));
    if (f.startsWith(LEVEL + '-') && /^reds6-\d+\.json$/.test(f)) json.push(JSON.parse(readFileSync(`${d}/${f}`, 'utf8')));
    if (f.startsWith(LEVEL + '-') && f.endsWith('-failures.txt')) for (const l of readFileSync(`${d}/${f}`, 'utf8').split('\n')) if (l.trim()) fails.push(`${f}: ${l}`);
  }
  return { shots, json, fails };
}
const seedOf = (code) => Number(code.split('-').pop());
const A = (r) => r.outcome === 'success' && r.d > 3.5 && r.flex !== 'exhibition' && r.flex !== 'rescue';
const B = (r) => r.outcome === 'success' && r.d > 3;
const C = (r) => r.d > 3;
const out = [];
function describe(name, d) {
  const { shots, json, fails } = load(d);
  const rounds = json.reduce((a, j) => a + j.rounds, 0), nShots = json.reduce((a, j) => a + j.shots, 0), rr = json.reduce((a, j) => a + j.reRacks, 0);
  const first = shots.filter((r) => seedOf(r.code) < 5_001_000);
  const firstRounds = new Set(first.map((r) => r.code)).size;
  out.push(`${name} (${d}): ${rounds} rounds, ${nShots} shots, solver ${json[0]?.solver}`);
  out.push(`  RE-RACK ${rr} in ${nShots} shots = ${(rr / nShots * 1e5).toFixed(1)} per 100,000 shots; upper 95% bound ${(upper(rr) / nShots * 1e5).toFixed(1)} per 100,000`);
  const rrFirst = shots.filter((r) => r.outcome === 'reRack' && seedOf(r.code) < 5_001_000).length;
  out.push(`  night-6 seeds (5,000,000-5,000,999: ${firstRounds} rounds with a SHOOT shot logged, ${first.length} shots): RE-RACK ${rrFirst}, long A ${first.filter(A).length}, B ${first.filter(B).length}, C ${first.filter(C).length}`);
  out.push(`  all rounds: long A ${shots.filter(A).length} (${(shots.filter(A).length / shots.length * 1000).toFixed(2)} per 1,000 shots), B ${shots.filter(B).length}, C ${shots.filter(C).length} (of ${shots.length} logged shots)`);
  const steps = {};
  for (const j of json) for (const [k, v] of Object.entries(j.steps)) { const e = (steps[k] ??= { n: 0, ok: 0, p: v.p }); e.n += v.n; e.ok += v.ok; }
  out.push('  per-step success (success or RE-RACK counts as success) against p(step):');
  for (const [k, e] of Object.entries(steps)) {
    const rate = e.ok / e.n, se = Math.sqrt(e.p * (1 - e.p) / e.n), z = (rate - e.p) / se;
    out.push(`    step ${String(k).padStart(2)}: ${String(e.ok).padStart(6)}/${String(e.n).padEnd(6)} = ${(rate * 100).toFixed(2)}%  p ${(e.p * 100).toFixed(2)}%  (${z >= 0 ? '+' : ''}${z.toFixed(2)} SE)${Math.abs(z) > 3 ? '  OUTSIDE 3 SE' : ''}`);
  }
  out.push(`  *failures.txt lines: ${fails.length}`, ...fails.map((l) => `    ${l}`));
  return { rr, nShots, firstA: first.filter(A).length };
}
const base = describe('BASELINE night 6 (v3)', baseDir);
out.push('');
const now = describe('NIGHT 8 (v4)', dir);
out.push('', 'PASS RULES (fixed before the run):',
  `  RE-RACK at most 1 per 100,000 shots: ${now.rr} in ${now.nShots} shots; ${now.rr / now.nShots * 1e5 <= 1 && upper(now.rr) / now.nShots * 1e5 <= 1 ? 'PASS (upper bound too)' : upper(now.rr) / now.nShots * 1e5 > 1 && now.rr / now.nShots * 1e5 <= 1 ? 'NOT SHOWN: the run is too short (the upper 95% bound is above 1 per 100,000)' : 'FAIL'}`,
  `  long shots fewer than night 7 (65, measure A on the night-6 seeds): ${now.firstA} vs ${base.firstA} -> ${now.firstA < 65 ? 'PASS' : 'FAIL'}`);
writeFileSync(`${dir}/step2.txt`, out.join('\n') + '\n');
console.log(out.join('\n'));
