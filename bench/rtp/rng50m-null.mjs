// How often would a PERFECT random generator fail the 50M pass rule (every step |z| < 3)? Simulates the money path as
// a chain of binomial draws: reach[k] ~ Binomial(reach[k-1], p(k)) (normal approximation, exact for these sizes),
// with the same p's and N as the real run. TRIALS runs (default 20,000). Uses ladders from bench/results/rtp50m.
import { readFileSync } from 'node:fs';
const f = JSON.parse(readFileSync('bench/results/rtp50m/shard-0.json', 'utf8'));
const N = f.n, TRIALS = Number(process.env.TRIALS ?? 20000);
let s = 12345; // small fixed PRNG (xorshift32) for the simulation only
const u = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s + 0.5) / 2 ** 32; };
const gauss = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
const per = {}; let any = 0, anyLow = 0;
for (let t = 0; t < TRIALS; t++) {
  let failAll = false, failLow = false;
  for (const [id, lv] of Object.entries(f.levels)) {
    let reach = N, prod = 1, fail = false;
    for (let k = 1; k <= lv.L; k++) {
      const p = lv.p[k - 1];
      reach = Math.round(reach * p + gauss() * Math.sqrt(reach * p * (1 - p)));
      prod *= p;
      const z = (reach / N - prod) / Math.sqrt((prod * (1 - prod)) / N);
      if (Math.abs(z) >= 3) { fail = true; if (z < 0) failLow = true; }
    }
    if (fail) { per[id] = (per[id] ?? 0) + 1; failAll = true; }
  }
  if (failAll) any++; if (failLow) anyLow++;
}
console.log(`Perfect RNG, ${TRIALS} simulated 50M runs: the rule fails in ${(100 * any / TRIALS).toFixed(1)}% of runs ` +
  `(per level: ${Object.entries(per).map(([k, v]) => `${k} ${(100 * v / TRIALS).toFixed(1)}%`).join(', ')}).`);
