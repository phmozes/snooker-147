// Groups the soak's success shots over 3.5 s (SHOTLOG=1 runs of bench/soak.test.ts) by cause. Diagnosis only.
// Run: node bench/slow-shots.mjs bench/results/soak-n3slow > bench/results/slow-shots.txt
import { readdirSync, readFileSync } from 'node:fs';
const dir = process.argv[2] ?? 'bench/results/soak-n3slow';
const all = readdirSync(dir).filter((f) => f.endsWith('-slow.jsonl')).flatMap((f) => readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const shots = all.filter((s) => s.flex !== 'exhibition');
const lvl = (s) => s.code.split('-')[0];
const L = { reds6: 18, reds10: 26, reds15: 36 };
const third = (s) => { const t = s.step / L[lvl(s)]; return t <= 1 / 3 ? 'early' : t <= 2 / 3 ? 'middle' : 'late'; };
const speedB = (v) => (v < 2 ? 'slow <2' : v < 4 ? 'mid 2-4' : 'hard >=4');
const cushB = (c) => (c >= 3 ? '3+' : String(c));
const out = [`${all.length} success shots over 3.5 s, ${shots.length} not last resort (exhibition excluded). Per level: ` +
  Object.keys(L).map((l) => `${l} ${shots.filter((s) => lvl(s) === l).length}`).join(', ')];
const table = (name, key) => {
  const g = {};
  for (const s of shots) (g[key(s)] ??= []).push(s);
  out.push('', `-- by ${name}`);
  for (const [k, v] of Object.entries(g).sort((a, b) => b[1].length - a[1].length)) {
    const ex = v.slice().sort((a, b) => b.d - a.d)[Math.floor(v.length / 2)];
    out.push(`${k.padEnd(34)} ${String(v.length).padStart(4)}  median ${v.map((x) => x.d).sort((a, b) => a - b)[Math.floor(v.length / 2)].toFixed(2)} s  e.g. ${ex.code}:${ex.step} (${ex.target}, ${ex.type}, ${ex.d} s, ${ex.speed} m/s, ${ex.cueCushions} cue cushions, ${ex.flex ?? 'normal'})`);
  }
};
table('fallback level', (s) => s.flex ?? 'normal');
table('red or colour', (s) => (s.target === 'red' ? 'red' : 'colour'));
table('shot type', (s) => s.type);
table('step range (third of the ladder)', third);
table('cue speed', (s) => speedB(s.speed));
table('cue-ball cushions', (s) => cushB(s.cueCushions));
table('reds left before the shot', (s) => (s.reds === 0 ? '0 (colours in order)' : s.reds <= 2 ? '1-2' : '3+'));
table('fallback x type', (s) => `${s.flex ?? 'normal'} / ${s.type}`);
console.log(out.join('\n'));
