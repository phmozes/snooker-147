// Task F.1 part 2: summary of bench/results/fairness/<level>.jsonl ([step, p, fail, near, open, cut, dist], steps >= 2).
// Bad position (fixed before looking at the data): cue ball within 25 cm of a cushion, OR no open pot, OR the best
// open pot cut more than 40 deg, OR the cue ball more than 1.5 m from the nearest target ball. Good = none of these.
// For each group: shots, failures seen, failures expected from p(step) (sum of 1 - p). Chi-square goodness of fit of the
// failure counts against p(step) for the groups (df = number of groups, p known in advance: p-value = chi2 survival).
// Run: node bench/fairness-sum.mjs bench/results/fairness
import { existsSync, readFileSync } from 'node:fs';

const dir = process.argv[2] ?? 'bench/results/fairness';
const CUT = 40, DIST = 1.5;
const isBad = ([, , , near, open, cut, dist]) => near === 1 || open === 0 || cut > CUT || dist > DIST;
const BUCKETS = [[2, 5], [6, 10], [11, 20], [21, 99]];
// chi-square survival function for integer df (series for the regularized upper gamma)
function chi2p(x, df) {
  if (x <= 0) return 1;
  if (df % 2 === 0) { let t = 1, s = 1; for (let i = 1; i < df / 2; i++) { t *= x / 2 / i; s += t; } return Math.exp(-x / 2) * s; }
  // odd df: P = erfc(sqrt(x/2)) + exp(-x/2) * sum_{i=1}^{(df-1)/2} (x/2)^(i-1/2) / Gamma(i+1/2)
  const erfc = (z) => { const t = 1 / (1 + 0.5 * z); return t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); };
  let s = erfc(Math.sqrt(x / 2)); let g = Math.sqrt(Math.PI) / 2; let pw = Math.sqrt(x / 2);
  for (let i = 1; i <= (df - 1) / 2; i++) { s += Math.exp(-x / 2) * pw / g; pw *= x / 2; g *= i + 0.5; }
  return s;
}
const fit = (groups) => {
  let x2 = 0;
  for (const g of groups) if (g.n) { const e = g.e, e2 = g.n - g.e; x2 += (g.f - e) ** 2 / e + ((g.n - g.f) - e2) ** 2 / e2; }
  const df = groups.filter((g) => g.n).length;
  return { x2, df, p: chi2p(x2, df) };
};
const add = (g, row) => { g.n++; g.f += row[2]; g.e += 1 - row[1]; };
const cell = (g) => `${g.n} | ${g.f} vs ${g.e.toFixed(1)} (${g.n ? ((100 * g.f) / g.n).toFixed(1) : '-'}% vs ${g.n ? ((100 * g.e) / g.n).toFixed(1) : '-'}%)`;

console.log('| Level | rounds | Good: shots, failures seen vs expected | Bad: same | Bad share | chi2 p (good/bad) | p by step bucket |');
console.log('|---|---|---|---|---|---|---|');
for (const level of ['reds6', 'reds10', 'reds15']) {
  const f = `${dir}/${level}.jsonl`;
  if (!existsSync(f)) continue;
  const rows = readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const done = existsSync(`${dir}/${level}.done`) ? readFileSync(`${dir}/${level}.done`, 'utf8').trim() : '?';
  const G = { good: { n: 0, f: 0, e: 0 }, bad: { n: 0, f: 0, e: 0 } };
  const byBucket = BUCKETS.map(() => ({ good: { n: 0, f: 0, e: 0 }, bad: { n: 0, f: 0, e: 0 } }));
  for (const row of rows) {
    const k = isBad(row) ? 'bad' : 'good';
    add(G[k], row);
    const b = BUCKETS.findIndex(([lo, hi]) => row[0] >= lo && row[0] <= hi);
    add(byBucket[b][k], row);
  }
  const all = fit([G.good, G.bad]);
  const strat = fit(byBucket.flatMap((b) => [b.good, b.bad]));
  // each measure alone (bad vs good for that one measure)
  const single = { near: (r) => r[3] === 1, noOpen: (r) => r[4] === 0, cut40: (r) => r[5] > CUT, far: (r) => r[6] > DIST };
  const singles = Object.entries(single).map(([name, test]) => {
    const a = { n: 0, f: 0, e: 0 }, b = { n: 0, f: 0, e: 0 };
    for (const r of rows) add(test(r) ? b : a, r);
    return `${name} ${fit([a, b]).p.toFixed(2)}`;
  }).join(', ');
  console.log(`| ${level} | ${done.split(' ')[0]} | ${cell(G.good)} | ${cell(G.bad)} | ${((100 * G.bad.n) / rows.length).toFixed(0)}% | ${all.p.toFixed(2)} (chi2 ${all.x2.toFixed(1)}, df ${all.df}) | ${strat.p.toFixed(2)} (df ${strat.df}); alone: ${singles} |`);
}
