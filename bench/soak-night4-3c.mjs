// Night 4, Part 3c: applies the pass rule written in docs/NIGHT-4.md BEFORE the run to the paired soak
// OFF (bench/results/soak-n4base) vs ON (bench/results/soak-n4pos). node bench/soak-night4-3c.mjs > bench/results/night4/pos411p-verdict.txt
import { readdirSync, readFileSync } from 'node:fs';
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function load(dir, level) {
  const m = { rounds: 0, success: 0, reRacks: 0, overCap: 0, crash: 0, flexShots: 0, notLast35: 0, tried: [], ms: [], problems: 0 };
  for (const f of readdirSync(dir).filter((x) => new RegExp(`^${level}-\\d+\\.json$`).test(x))) {
    const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
    for (const k of ['rounds', 'success', 'reRacks', 'overCap', 'flexShots']) m[k] += j[k] ?? 0;
    m.crash += j.ends?.crash ?? 0;
    const all = [...(j.durs?.red ?? []), ...(j.durs?.colour ?? [])], last = [...(j.lastResort?.red ?? []), ...(j.lastResort?.colour ?? [])];
    m.notLast35 += all.filter((d) => d > 3.5).length - last.filter((d) => d > 3.5).length;
  }
  for (const f of readdirSync(dir).filter((x) => new RegExp(`^${level}-\\d+-shots\\.jsonl$`).test(x))) {
    for (const l of readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean)) {
      const r = JSON.parse(l);
      if (r.outcome === 'success' && r.tried != null) { m.tried.push(r.tried); m.ms.push(r.ms); }
    }
  }
  m.flexPct = (100 * m.flexShots) / Math.max(1, m.success - m.reRacks);
  return m;
}
const out = ['Part 3c paired soak, OFF (4.10) vs ON (4.11p), same v2 rounds. Rule fixed before the run (docs/NIGHT-4.md).'];
let pass = true;
for (const level of ['reds6', 'reds10', 'reds15']) {
  const a = load('bench/results/soak-n4base', level), b = load('bench/results/soak-n4pos', level);
  const ta = q(a.tried, 0.5), tb = q(b.tried, 0.5);
  const checks = [
    ['stuck 0', `${a.overCap + a.crash} / ${b.overCap + b.crash}`, b.overCap + b.crash === 0],
    ['RE-RACK not higher', `${a.reRacks} / ${b.reRacks}`, b.reRacks <= a.reRacks],
    ['success fallback % <= OFF + 1', `${a.flexPct.toFixed(1)}% / ${b.flexPct.toFixed(1)}%`, b.flexPct <= a.flexPct + 1],
    ['over 3.5 s not last resort not higher', `${a.notLast35} / ${b.notLast35}`, b.notLast35 <= a.notLast35],
    ['THINKING (simulated shots per success solve, median) <= OFF x 1.10', `${ta} / ${tb}`, tb <= ta * 1.1],
  ];
  out.push(`== ${level}: rounds ${a.rounds} / ${b.rounds} (OFF / ON) ==`);
  for (const [name, val, ok] of checks) { out.push(`  ${ok ? 'pass' : 'FAIL'}  ${name}: ${val}`); if (!ok) pass = false; }
  out.push(`  (info) solve ms per success shot, median: ${q(a.ms, 0.5)} / ${q(b.ms, 0.5)}; 90% tried ${q(a.tried, 0.9)} / ${q(b.tried, 0.9)}`);
}
out.push(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
console.log(out.join('\n'));
