// Night 4, Part 2.3: adds up bench/results/rtp200m/shard-*.json (bench/rtp/rng200m.test.ts, generator v2) and applies
// the pass rule fixed BEFORE the run (owner, night 4), run once:
//   PASS = every cash-out step |z| < 4 (measured RTP vs formula)
//      AND every "step k+1 ok given steps 1..k ok" |z| < 4
//      AND every single-step success rate |z| < 4.
// Also simulates how often a PERFECT generator fails this exact rule (TRIALS simulated runs with the same N and p's).
// Run: node bench/rtp/rng200m-sum.mjs > bench/results/rtp-rng-v2-200M.txt
import { readdirSync, readFileSync } from 'node:fs';
const dir = process.env.DIR ?? 'bench/results/rtp200m';
const LIMIT = 4;
const files = readdirSync(dir).filter((f) => /^shard-\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const n = files[0].n, shards = files[0].shards, base0 = files[0].base0;
if (files.length !== shards) throw new Error(`have ${files.length} of ${shards} shards`);
const covered = files.reduce((a, f) => a + (f.to - f.from + 1), 0);
if (covered !== n) throw new Error(`shards cover ${covered} of ${n} rounds`);
const out = [];
const f3 = (x) => (x * 100).toFixed(4);
const zs = (z) => `${z >= 0 ? '+' : ''}${z.toFixed(2)}`;
out.push(`Generator v2 (HMAC-SHA256), RNG-only, ${n.toLocaleString('en')} rounds per level, seeds ${base0 + 1}..${base0 + n} (${shards} shards), game code stepSucceeds.`);
out.push(`Pass rule (fixed before the run, run once): every cash-out step |z| < ${LIMIT}, every conditional step |z| < ${LIMIT}, every single step |z| < ${LIMIT}.`);
const fails = [];
for (const id of Object.keys(files[0].levels)) {
  const { L, p, m } = files[0].levels[id];
  const sum = (key) => { const a = new Array(L + 1).fill(0); for (const f of files) f.levels[id][key].forEach((v, i) => (a[i] += v)); return a; };
  const reach = sum('reach'), ok = sum('ok');
  out.push('', `== ${id} (${L} steps) ==`);
  out.push('step | cash-out RTP measured% / formula% / z / rounds that reached it | P(k ok | 1..k-1 ok) measured% / p% / z | P(k ok) single measured% / p% / z');
  let prod = 1; const w = { cash: 0, cond: 0, single: 0 }; const above = { cash: 0, cond: 0, single: 0 }; const cnt = { cash: 0, cond: 0, single: 0 };
  for (let k = 1; k <= L; k++) {
    const q = p[k - 1];
    prod *= q;
    const formula = m[k - 1] * prod, measured = (m[k - 1] * reach[k]) / n;
    const zc = (measured - formula) / (m[k - 1] * Math.sqrt((prod * (1 - prod)) / n));
    const prevReach = k === 1 ? n : reach[k - 1];
    const cond = reach[k] / prevReach, zk = (cond - q) / Math.sqrt((q * (1 - q)) / prevReach);
    const single = ok[k] / n, zsn = (single - q) / Math.sqrt((q * (1 - q)) / n);
    for (const [key, z, a, b] of [['cash', zc, measured, formula], ['cond', zk, cond, q], ['single', zsn, single, q]]) {
      w[key] = Math.max(w[key], Math.abs(z)); cnt[key]++; if (a > b) above[key]++;
      if (Math.abs(z) >= LIMIT) fails.push(`${id} step ${k} ${key} z ${z.toFixed(2)}`);
    }
    out.push(`${String(k).padStart(3)} | ${f3(measured)} / ${f3(formula)} / ${zs(zc)} / ${reach[k].toLocaleString('en')} | ${f3(cond)} / ${f3(q)} / ${zs(zk)} | ${f3(single)} / ${f3(q)} / ${zs(zsn)}`);
  }
  for (const key of ['cash', 'cond', 'single'])
    out.push(`  ${key === 'cash' ? 'cash-out RTP' : key === 'cond' ? 'conditional' : 'single step'}: worst |z| ${w[key].toFixed(2)}; above formula ${above[key]}, below ${cnt[key] - above[key]}`);
}
out.push('', fails.length ? `RESULT: FAIL (${fails.length} cells): ${fails.join('; ')}` : `RESULT: PASS (all three checks |z| < ${LIMIT} on every step of every level)`);

// ---- how often does a PERFECT generator fail this exact rule? Exact chain simulation with normal approximations:
// reach[k] ~ Bin(reach[k-1], p_k); ok[k] = reach[k] + Bin(n - reach[k-1], p_k) (rounds whose chain broke earlier).
const TRIALS = Number(process.env.TRIALS ?? 20000);
let s = 12345; // small fixed PRNG (xorshift32) for this simulation only
const u = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s + 0.5) / 2 ** 32; };
const gauss = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
const bin = (N, q) => Math.max(0, Math.min(N, Math.round(N * q + gauss() * Math.sqrt(N * q * (1 - q)))));
let any = 0; const per = {};
for (let t = 0; t < TRIALS; t++) {
  let failRun = false;
  for (const [id, lv] of Object.entries(files[0].levels)) {
    let prev = n, prod = 1, fail = false;
    for (let k = 1; k <= lv.L; k++) {
      const q = lv.p[k - 1];
      const r = bin(prev, q), okk = r + bin(n - prev, q);
      prod *= q;
      const zc = (r / n - prod) / Math.sqrt((prod * (1 - prod)) / n);
      const zk = (r / prev - q) / Math.sqrt((q * (1 - q)) / prev);
      const zsn = (okk / n - q) / Math.sqrt((q * (1 - q)) / n);
      if (Math.abs(zc) >= LIMIT || Math.abs(zk) >= LIMIT || Math.abs(zsn) >= LIMIT) fail = true;
      prev = r;
    }
    if (fail) { per[id] = (per[id] ?? 0) + 1; failRun = true; }
  }
  if (failRun) any++;
}
out.push(`Perfect generator, ${TRIALS.toLocaleString('en')} simulated runs of this exact rule: it fails in ${(100 * any / TRIALS).toFixed(2)}% of runs` +
  ` (per level: ${Object.keys(files[0].levels).map((k) => `${k} ${(100 * (per[k] ?? 0) / TRIALS).toFixed(2)}%`).join(', ')}).`);
console.log(out.join('\n'));
