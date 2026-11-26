// Night 3 soak summary: node bench/soak-night3.mjs <dir> [<dir> ...]  -> one line per level (written to <first dir>/night3.txt);
// several dirs are added together (a shard continued with START_I in a second dir)
// Per level: rounds, stuck solver (over the simulated-shot cap or a crash; wall-time solves over 10 s shown apart, they depend on PC load), RE-RACK, ball off the
// table or overlapping (problems), fallback share (success shots that needed a flex fallback; failures that needed a
// D.2 fallback), shots over 3.5 s (all / not last resort), pace (median and 90% for reds and colours), and the real
// success rate per step against p (z = (rate - p) / sd; tolerance |z| <= 3, steps with fewer than 30 tries skipped).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['bench/results/soak-n3base'];
const dir = dirs[0];
const by = {};
for (const f of dirs.flatMap((d) => readdirSync(d).filter((x) => /^reds\d+-\d+\.json$/.test(x)).map((x) => `${d}/${x}`))) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const m = (by[j.level] ??= { rounds: 0, success: 0, shots: 0, reRacks: 0, problems: 0, over35: 0, slowSolves: 0, overCap: 0, maxSolveMs: 0,
    flexShots: 0, failShots: 0, failFallbacks: 0, crash: 0, steps: {}, red: [], colour: [], lrRed: [], lrColour: [], maxDuration: 0, flex: {} });
  for (const k of ['rounds', 'success', 'shots', 'reRacks', 'problems', 'over35', 'slowSolves', 'overCap', 'flexShots', 'failShots', 'failFallbacks']) m[k] += j[k] ?? 0;
  m.crash += j.ends?.crash ?? 0;
  m.maxSolveMs = Math.max(m.maxSolveMs, j.maxSolveMs ?? 0); m.maxDuration = Math.max(m.maxDuration, j.maxDuration);
  for (const [a, b] of Object.entries(j.flex ?? {})) m.flex[a] = (m.flex[a] ?? 0) + b;
  for (const [k, e] of Object.entries(j.steps ?? {})) { const t = (m.steps[k] ??= { n: 0, ok: 0, p: e.p }); t.n += e.n; t.ok += e.ok; }
  m.red.push(...(j.durs?.red ?? [])); m.colour.push(...(j.durs?.colour ?? []));
  m.lrRed.push(...(j.lastResort?.red ?? [])); m.lrColour.push(...(j.lastResort?.colour ?? []));
}
const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0');
const lines = [];
for (const l of ['reds6', 'reds10', 'reds15']) {
  const m = by[l]; if (!m) continue;
  let worst = 0, out3 = 0, checked = 0;
  for (const e of Object.values(m.steps)) {
    if (e.n < 30) continue;
    checked++;
    const z = (e.ok / e.n - e.p) / Math.sqrt((e.p * (1 - e.p)) / e.n);
    worst = Math.max(worst, Math.abs(z)); if (Math.abs(z) > 3) out3++;
  }
  const notLast = m.red.filter((d) => d > 3.5).length + m.colour.filter((d) => d > 3.5).length - m.lrRed.filter((d) => d > 3.5).length - m.lrColour.filter((d) => d > 3.5).length;
  lines.push(`${l}: ${m.rounds} rounds, ${m.shots} SHOOT shots | stuck ${m.overCap + m.crash} (over shot cap ${m.overCap}, crash ${m.crash}) | solves over 10 s wall time ${m.slowSolves}, slowest ${(m.maxSolveMs / 1000).toFixed(1)} s (PC fully loaded) | RE-RACK ${m.reRacks} | off table/overlap ${m.problems - m.reRacks - m.slowSolves - m.overCap - m.crash} | fallback: success ${pct(m.flexShots, m.success - m.reRacks)}% any flex step, last resort ${pct((m.flex.exhibition ?? 0) + (m.flex.rescue ?? 0), m.success - m.reRacks)}% (exhibition ${m.flex.exhibition ?? 0}, rescue ${m.flex.rescue ?? 0}), failure ${pct(m.failFallbacks, m.failShots)}% | over 3.5 s ${m.over35} (not last resort ${notLast}), longest ${m.maxDuration.toFixed(2)} s | pace red med ${q(m.red, 0.5)} p90 ${q(m.red, 0.9)}, colour med ${q(m.colour, 0.5)} p90 ${q(m.colour, 0.9)} | success vs p: ${checked} steps, worst |z| ${worst.toFixed(2)}, outside 3 sd ${out3}`);
}
writeFileSync(`${dir}/night3.txt`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
