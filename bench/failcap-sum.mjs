// 2026-11-27: summary of a FAILCMP=1 soak (bench/soak.test.ts): failure shots with the old rule (failure.natural off)
// and the new one (on), on the same frames. usage: node bench/failcap-sum.mjs <dir>
import { readdirSync, readFileSync } from 'node:fs';
const dir = process.argv[2];
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const CAP = 3.0, NEAR = 0.35;
const rows = [];
for (const lv of ['reds6', 'reds10', 'reds15', 'all']) {
  const lines = readdirSync(dir).filter((f) => f.endsWith('-shots.jsonl') && (lv === 'all' || f.startsWith(lv + '-')))
    .flatMap((f) => readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  const fails = lines.filter((l) => l.fk);
  const rounds = new Set(fails.map((l) => l.code)).size; // one failure ends a round; only finished rounds have one
  const side = (k) => {
    const d = fails.map((l) => l[`${k}D`]).filter((x) => x != null);
    const io = fails.filter((l) => l.fk === 'inOff' && !l[`${k}Fb`] && l[`${k}In`] != null).map((l) => l[`${k}In`]);
    return { over: d.filter((x) => x > CAP).length, med: q(d, 0.5), p90: q(d, 0.9), max: Math.max(...d),
      ioMed: q(io, 0.5), ioP90: q(io, 0.9), ioNear: io.filter((x) => x <= NEAR).length, io: io.length,
      ioOver: fails.filter((l) => l.fk === 'inOff' && l[`${k}D`] > CAP).length };
  };
  const a = side('off'), b = side('on');
  const fbDiff = fails.filter((l) => l.offFb !== l.onFb).length;
  const moved = fails.filter((l) => l.offD !== l.onD).length;
  const per = (n) => (rounds ? ((1000 * n) / rounds).toFixed(1) : '-');
  rows.push(`| ${lv} | ${rounds} | ${a.over} (${per(a.over)}) -> ${b.over} (${per(b.over)}) | ${f2(a.med)} / ${f2(a.p90)} / ${f2(a.max)} -> ${f2(b.med)} / ${f2(b.p90)} / ${f2(b.max)}`
    + ` | ${a.io}: ${f2(a.ioMed)} / ${f2(a.ioP90)} m, near ${a.ioNear} -> ${f2(b.ioMed)} / ${f2(b.ioP90)} m, near ${b.ioNear}; over 3 s ${a.ioOver} -> ${b.ioOver} | ${moved} | ${fbDiff} |`);
}
console.log('| Level | Rounds (failures) | Failure shots over 3.0 s OFF -> ON (per 1,000 rounds) | Length median / 90% / longest s OFF -> ON | In-offs: pocket distance median / 90%, near (<= 0.35 m) OFF -> ON | Shot changed | Fallback differs |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
