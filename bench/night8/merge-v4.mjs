// Night 8: merge the v4 chunks (bench/results/night8/v4chunk-*.json) into public/breaks-v4/reds6.json.
// redPottable: every accepted entry in attempt-index order, the first 200 (= what one process trying 0, 1, 2 ... keeps).
// snookered: the v3 list unchanged (a snookered break ends the round at step 1, so the later table never plays; the
// v4 rules would also drop 98-100% of them, bench/results/night7/reds6-lib.txt).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = 'bench/results/night8';
const chunks = readdirSync(dir).filter((f) => /^v4chunk-\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')))
  .sort((a, b) => a.from - b.from);
let at = 0; const all = []; const rej = {}; let secs = 0;
for (const c of chunks) {
  if (c.from !== at) throw new Error(`gap in the chunks at ${at}`);
  at = c.to; secs += c.seconds;
  c.indices.forEach((i, k) => all.push([i, c.entries[k]]));
  for (const [k, v] of Object.entries(c.rejected)) rej[k] = (rej[k] ?? 0) + v;
}
all.sort((a, b) => a[0] - b[0]);
const N = 200;
if (all.length < N) throw new Error(`only ${all.length} accepted in 0..${at}`);
const v3 = JSON.parse(readFileSync('public/breaks-v3/reds6.json', 'utf8'));
mkdirSync('public/breaks-v4', { recursive: true });
writeFileSync('public/breaks-v4/reds6.json', JSON.stringify({ level: 'reds6', reds: 6, version: 4,
  redPottable: all.slice(0, N).map((x) => x[1]), snookered: v3.snookered }));
const line = `reds6 v4: redPottable ${N} (attempt indices 0..${all[N - 1][0]}, i.e. ${all[N - 1][0] + 1} breaks tried; ${all.length} accepted in 0..${at - 1}); ` +
  `rejected by the v4 rules in 0..${at - 1}: red within 2 mm of the pink ${rej.redOnPink ?? 0}, a red no pocket can take ${rej.lockedRed ?? 0}; ` +
  `snookered 200 = the v3 list; CPU ${Math.round(secs)} s in ${chunks.length} chunks -> public/breaks-v4/reds6.json`;
writeFileSync(`${dir}/breaks-v4.txt`, line + '\n');
console.log(line);
