// Merge the soak shards: node bench/soak-merge.mjs bench/results/soak  -> <dir>/summary.json and a short text summary
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? 'bench/results/soak';
const by = {};
for (const f of readdirSync(dir).filter((x) => /^reds\d+-\d+\.json$/.test(x))) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const m = (by[j.level] ??= { rounds: 0, shots: 0, success: 0, reRacks: 0, problems: 0, over35: 0, maxDuration: 0, maxTried: 0, shards: 0,
    ends: {}, flex: {}, failureKinds: {}, types: {}, colours: {}, lengths: {}, pay: {}, solver: j.solver, cap: j.cap });
  m.shards++;
  for (const k of ['rounds', 'shots', 'success', 'reRacks', 'problems', 'over35']) m[k] += j[k];
  m.maxDuration = Math.max(m.maxDuration, j.maxDuration); m.maxTried = Math.max(m.maxTried, j.maxTried);
  for (const k of ['ends', 'flex', 'failureKinds', 'types', 'colours', 'lengths', 'pay']) for (const [a, b] of Object.entries(j[k])) m[k][a] = (m[k][a] ?? 0) + b;
}
const lines = [];
for (const [l, m] of Object.entries(by)) {
  m.rtp = Object.fromEntries(Object.entries(m.pay).map(([k, v]) => [k, Math.round((v / m.rounds) * 1000) / 10]));
  const sh = (o, n) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round((v / n) * 10000) / 100]));
  m.typeShares = sh(m.types, m.success - m.reRacks);
  lines.push(`${l}: ${m.rounds} rounds, ${m.success} success shots, RE-RACK ${m.reRacks} (${(m.reRacks / m.success * 100000).toFixed(1)} per 100k; D.6 limit 1), problems ${m.problems}, over 3.5 s ${m.over35}, longest ${m.maxDuration.toFixed(2)} s, most simulated ${m.maxTried} (cap ${m.cap})`);
  lines.push(`  flex ${JSON.stringify(m.flex)} | failures ${JSON.stringify(m.failureKinds)}`);
  lines.push(`  types % ${JSON.stringify(m.typeShares)}`);
  lines.push(`  RTP % by cash-out step ${JSON.stringify(m.rtp)}`);
}
writeFileSync(`${dir}/summary.json`, JSON.stringify(by, null, 1));
writeFileSync(`${dir}/summary.txt`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
