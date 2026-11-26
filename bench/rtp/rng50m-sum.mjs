// Adds up bench/results/rtp50m/shard-*.json (from bench/rtp/rng50m.test.ts) and applies the pass rule fixed before
// the run: for every step of every level, |z| of measured vs formula RTP < 3. Prints the money path (RTP), the deep
// steps, and two independence checks. Run: node bench/rtp/rng50m-sum.mjs > bench/results/rtp-rng-50M.txt
import { readdirSync, readFileSync } from 'node:fs';
const dir = 'bench/results/rtp50m';
const files = readdirSync(dir).filter((f) => /^shard-\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const n = files[0].n, shards = files[0].shards, base0 = files[0].base0;
if (files.length !== shards) throw new Error(`have ${files.length} of ${shards} shards`);
const covered = files.reduce((a, f) => a + (f.to - f.from + 1), 0);
if (covered !== n) throw new Error(`shards cover ${covered} of ${n} rounds`);
const out = [];
const f2 = (x) => (x * 100).toFixed(3);
out.push(`RNG-only RTP, ${n.toLocaleString('en')} rounds per level, seeds ${base0 + 1}..${base0 + n} (${shards} shards), game code stepSucceeds.`);
out.push(`Note: streamValue mixes the seed as a 32-bit integer, so these seeds act as ${(base0 + 1) % 2 ** 32}..${(base0 + n) % 2 ** 32}`);
out.push(`(seed mod 2^32); no earlier RTP run used that range (earlier: 1..2M, 1e9+1..+2M, 3e9+1..+2M).`);
out.push(`Pass rule (fixed before the run, run once): every step |z| < 3, z = (measured - formula) / standard error.`);
let fails = [];
for (const id of Object.keys(files[0].levels)) {
  const L = files[0].levels[id].L, p = files[0].levels[id].p, m = files[0].levels[id].m;
  const sum = (key) => { const a = new Array(L + 1).fill(0); for (const f of files) f.levels[id][key].forEach((v, i) => (a[i] += v)); return a; };
  const reach = sum('reach'), ok = sum('ok'), both = sum('both');
  out.push('', `== ${id} (${L} steps) ==`);
  out.push('RTP per cash-out step  k: measured% / formula% (z) [rounds that reached k]');
  let prod = 1, worst = 0, cells = [];
  const rows = {};
  for (let k = 1; k <= L; k++) {
    prod *= p[k - 1];
    const formula = m[k - 1] * prod, measured = (m[k - 1] * reach[k]) / n;
    const se = m[k - 1] * Math.sqrt((prod * (1 - prod)) / n), z = (measured - formula) / se;
    rows[k] = { measured, formula, z, reached: reach[k] };
    worst = Math.max(worst, Math.abs(z));
    if (Math.abs(z) >= 3) fails.push(`${id} step ${k} z ${z.toFixed(2)}`);
    cells.push(`${k}: ${f2(measured)}/${f2(formula)} (${z >= 0 ? '+' : ''}${z.toFixed(2)}) [${reach[k]}]`);
  }
  for (let i = 0; i < cells.length; i += 3) out.push('  ' + cells.slice(i, i + 3).join('   '));
  const two = Math.round((2 * L) / 3);
  for (const [name, k] of [['two thirds', two], ['last', L]]) {
    const r = rows[k];
    out.push(`  ${name} step ${k}: measured ${f2(r.measured)}%, formula ${f2(r.formula)}%, z ${r.z.toFixed(2)}, reached by ${r.reached.toLocaleString('en')} rounds`);
  }
  const above = Object.values(rows).filter((r) => r.measured > r.formula).length;
  out.push(`  worst |z| ${worst.toFixed(2)}; steps measured above formula: ${above} of ${L}`);
  out.push('Independence A (all rounds, every step drawn): P(k+1 ok | k ok) vs p(k+1), z [rounds with k ok]');
  let wa = 0, wb = 0, ca = [], cb = [];
  for (let k = 1; k < L; k++) {
    const q = p[k], c = both[k] / ok[k], z = (c - q) / Math.sqrt((q * (1 - q)) / ok[k]);
    wa = Math.max(wa, Math.abs(z));
    ca.push(`${k}->${k + 1}: ${f2(c)}/${f2(q)} (${z.toFixed(2)})`);
    const c2 = reach[k + 1] / reach[k], z2 = (c2 - q) / Math.sqrt((q * (1 - q)) / reach[k]);
    wb = Math.max(wb, Math.abs(z2));
    cb.push(`${k}->${k + 1}: ${f2(c2)}/${f2(q)} (${z2.toFixed(2)})`);
  }
  for (let i = 0; i < ca.length; i += 4) out.push('  ' + ca.slice(i, i + 4).join('   '));
  out.push(`  worst |z| ${wa.toFixed(2)}`);
  out.push('Independence B (money path, steps 1..k all ok): P(k+1 ok | 1..k ok) vs p(k+1), z');
  for (let i = 0; i < cb.length; i += 4) out.push('  ' + cb.slice(i, i + 4).join('   '));
  out.push(`  worst |z| ${wb.toFixed(2)}`);
  out.push(`Single-step check: P(step k ok) over all rounds, worst |z| ${Math.max(...p.map((q, i) => Math.abs((ok[i + 1] / n - q) / Math.sqrt((q * (1 - q)) / n)))).toFixed(2)}`);
}
out.push('', fails.length ? `RESULT: FAIL (${fails.length}): ${fails.join('; ')}` : 'RESULT: PASS (every step |z| < 3)');
console.log(out.join('\n'));
