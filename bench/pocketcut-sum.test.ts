// 2026-11-27 automatic pocket-camera cuts (owner: 1 shot in 6, P(cut | success) = P(cut | failure) = 1/6, RULES B.6).
// The cut is our own visual-only draw, so its chances are COMPUTED: chance = (1/6) / P(cuttable | outcome). Only the
// cuttable share is measured:
//   - the failure MIX (kind + fallback, per level and step group) from a saved soak: MIX (default night6/soak, v3, 4.11p)
//   - how often each failure kind is cuttable (target ball reaches its pocket), and P(cuttable | success), from a short
//     soak with SHOTS=1 PAIRED=1 (DIR), seeds with seed % 2 == 0 (CALIBRATION half).
//   PART=calib npx vitest run bench/pocketcut-sum.test.ts  -> <DIR>/calib.txt (the cutChance numbers for the config)
//   PART=test  npx vitest run bench/pocketcut-sum.test.ts  -> <DIR>/test.txt  (the other half, odd seeds)
// Quick-check pass rule (owner, fixed before looking): per level, the success and the failure cut rate each within
// 3 standard errors of 1/6, and their difference within 3 standard errors of 0. SE under p = 1/6: sqrt(p(1-p)/n).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { parseRoundCode } from '../src/core/roundCode';
import { autoCutDraw, pickView, STEP_GROUPS, stepGroup } from '../src/view/pocketCam';

const DIR = process.env.DIR ?? 'bench/results/pocketcut-quick';
const MIX = process.env.MIX ?? 'bench/results/night6/soak';
const LEVELS = ['reds6', 'reds10', 'reds15'];
const P = CONFIG.pocketCut.rate;
type Row = { code: string; step: number; outcome: string; fallback: string | null; cc?: number; add?: number; w?: number };
type R2 = Row & { level: string; seed: number; rng: 1 | 2 | 3 };
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const kindOf = (r: Row) => `${r.outcome}${r.fallback ? `->${r.fallback}` : ''}`;
function load(dir: string, suffix: string): R2[] {
  const out: R2[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(suffix))) {
    for (const l of readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
      if (!l.trim()) continue;
      const r = JSON.parse(l) as Row;
      if (r.outcome === 'reRack' || r.step < 2) continue;
      const c = parseRoundCode(r.code)!;
      out.push({ ...r, level: c.levelId!, seed: c.seed, rng: c.rng as 1 | 2 | 3 });
    }
  }
  return out;
}

it('pocket cut summary', () => {
  const part = process.env.PART ?? 'calib';
  const half = (r: R2) => (r.seed % 2 === 0) === (part === 'calib');
  const shots = load(DIR, '-shots.jsonl').filter(half);
  const paired = load(DIR, '-paired.jsonl').filter(half);
  const ok = (r: Row) => r.outcome === 'success';
  const out: string[] = [];
  if (part === 'calib') {
    // cuttable share per failure kind: real failures + paired failures (pooled over the levels; also per level)
    const F = [...shots.filter((r) => !ok(r)), ...paired];
    const kinds = [...new Set(F.map(kindOf))].sort();
    const ccKind: Record<string, number> = {};
    out.push(`CALIBRATION (even seeds): ${shots.length} shots, ${paired.length} paired failures, from ${DIR}`, '',
      'cuttable share per failure kind (pooled over levels; per level in brackets)');
    for (const k of kinds) {
      const K = F.filter((r) => kindOf(r) === k), c = K.filter((r) => r.cc).length;
      ccKind[k] = c / K.length;
      const per = LEVELS.map((L) => { const KL = K.filter((r) => r.level === L); return `${L} ${KL.filter((r) => r.cc).length}/${KL.length}`; }).join(', ');
      out.push(`  ${k.padEnd(26)} ${String(c).padStart(5)}/${String(K.length).padEnd(5)} = ${pct(ccKind[k])}   (${per})`);
    }
    const mix = load(MIX, '-shots.jsonl').filter((r) => !ok(r));
    out.push('', `failure mix from ${MIX}: ${mix.length} failures (${LEVELS.map((L) => `${L} ${mix.filter((r) => r.level === L).length}`).join(', ')})`);
    const cfg: Record<string, { success: number; failure: number[] }> = {};
    for (const L of LEVELS) {
      const S = shots.filter((r) => r.level === L && ok(r)), cS = S.filter((r) => r.cc).length / S.length;
      const groups = STEP_GROUPS.map((g) => {
        const M = mix.filter((r) => r.level === L && stepGroup(r.step) === g.from);
        const miss = M.filter((r) => ccKind[kindOf(r)] === undefined).length;
        const ccF = M.reduce((x, r) => x + (ccKind[kindOf(r)] ?? 0), 0) / (M.length || 1);
        return { g, n: M.length, ccF, miss, chance: M.length ? P / ccF : NaN };
      });
      const all = mix.filter((r) => r.level === L), ccAll = all.reduce((x, r) => x + (ccKind[kindOf(r)] ?? 0), 0) / all.length;
      out.push('', `${L}: P(cuttable | success) = ${pct(cS)} (${S.length} successes) -> success chance ${(P / cS).toFixed(4)}`,
        `  P(cuttable | failure), all steps = ${pct(ccAll)} -> failure chance ${(P / ccAll).toFixed(4)}`);
      for (const x of groups) out.push(`  steps ${x.g.label.padEnd(6)} ${String(x.n).padStart(4)} failures in the mix, cuttable ${pct(x.ccF)} -> chance ${x.chance.toFixed(4)}` +
        `${x.chance > 1 ? '  (OVER 1: 1/6 NOT reachable here)' : ''}${x.miss ? ` (${x.miss} of an unmeasured kind, counted not cuttable)` : ''}`);
      // a group with too few failures in the mix (< 50) uses the level's all-steps value
      cfg[L] = { success: +(P / cS).toFixed(4), failure: groups.map((x) => +(x.n >= 50 ? x.chance : P / ccAll).toFixed(4)) };
    }
    out.push('', `config cutChance (failure = per step group ${STEP_GROUPS.map((g) => g.label).join(', ')}):`, JSON.stringify(cfg));
  } else {
    out.push(`TEST (odd seeds): ${shots.length} shots, ${paired.length} paired failures, from ${DIR}`,
      `config cutChance: ${JSON.stringify(CONFIG.pocketCut.cutChance)}`,
      'pass rule: per level, each rate within 3 SE of 1/6 and the difference within 3 SE of 0 (SE at p = 1/6)');
    const se = (n: number) => Math.sqrt(P * (1 - P) / n);
    const cut = (r: R2) => !!r.cc && autoCutDraw(r.level, r.step, r.outcome, r.seed, r.rng);
    let all = true, addAll = 0, nAll = 0, cutsAll = 0, p1b = 0;
    for (const L of LEVELS) {
      const R = shots.filter((r) => r.level === L), S = R.filter(ok), F = R.filter((r) => !ok(r));
      const rS = S.filter(cut).length / S.length, rF = F.filter(cut).length / F.length;
      const eS = se(S.length), eF = se(F.length), eD = Math.hypot(eS, eF);
      const pass = Math.abs(rS - P) <= 3 * eS && Math.abs(rF - P) <= 3 * eF && Math.abs(rS - rF) <= 3 * eD;
      all &&= pass;
      // paired failures (one per step reached, weighted by the step's failure chance): many more failure samples
      const PF = paired.filter((r) => r.level === L);
      const wSum = PF.reduce((x, r) => x + r.w!, 0), wCut = PF.reduce((x, r) => x + (cut(r) ? r.w! : 0), 0);
      const nEff = wSum ** 2 / PF.reduce((x, r) => x + r.w! ** 2, 0);
      const cuts = R.filter(cut), add = cuts.reduce((x, r) => x + (r.add ?? 0), 0);
      addAll += add; nAll += R.length; cutsAll += cuts.length;
      p1b += cuts.filter((r) => pickView(r.seed, r.step, r.rng) === 'P1b').length;
      out.push('', `${L}: ${R.length} shots: ${S.length} success, ${F.length} failure`,
        `  P(cut | success) = ${pct(rS)}  SE ${pct(eS)}  (${((rS - P) / eS).toFixed(2)} SE from 1/6)`,
        `  P(cut | failure) = ${pct(rF)}  SE ${pct(eF)}  (${((rF - P) / eF).toFixed(2)} SE from 1/6)`,
        `  difference ${((rS - rF) * 100).toFixed(2)} points, SE ${pct(eD)} (${((rS - rF) / eD).toFixed(2)} SE) -> ${pass ? 'PASS' : 'FAIL'}`,
        `  extra (not in the rule): paired failures ${PF.length}, weighted P(cut | failure) = ${pct(wCut / wSum)}, SE about ${pct(se(nEff))}`,
        `  cuts ${cuts.length} of ${R.length} shots, added time per shot ${(add / R.length).toFixed(3)} s, per cut ${(add / (cuts.length || 1)).toFixed(2)} s`);
    }
    out.push('', `ALL: ${nAll} shots, ${cutsAll} cuts (${pct(cutsAll / nAll)}), P1b ${pct(p1b / (cutsAll || 1))}, added time per shot ${(addAll / nAll).toFixed(3)} s`,
      `RESULT: ${all ? 'PASS at every level' : 'FAIL at some level'}`);
  }
  writeFileSync(`${DIR}/${part}.txt`, out.join('\n') + '\n');
  console.log(out.join('\n'));
}, 600000);
