// Task P.1 step 4: what the solver costs per step when both outcomes are solved, with the same code the workers run
// (src/game/solveJob.ts). Same rounds as natural.test.ts (seed*7+3). For every step:
//   one worker (old): success then failure in a row -> the wait is the sum
//   two workers (new): success alone, failure alone (each also does the colour pick on a colour step) -> the wait is
//   the slower of the two. Two workers are timed one after the other here, so this assumes two free CPU cores.
// It also checks the two-worker shots equal the one-worker shots. Run: N=60 LEVELS=reds6 OUT=x.json npx vitest run bench/presolve-cost.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, nextOutcome, nextTarget, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';
import { solvedProvider, type SolveAnswer, type SolveKind, type SolveRequest } from '../src/game/presolve';
import { solveJob } from '../src/game/solveJob';

const same = (a: unknown, b: unknown) => JSON.stringify(a, (k, v) => (k === 'computeMs' || k === 'ms' ? undefined : v)) === JSON.stringify(b, (k, v) => (k === 'computeMs' || k === 'ms' ? undefined : v));
const med = (x: number[]) => { const s = [...x].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };

it('solver cost per step: one worker vs two', () => {
  const table = buildTable();
  const n = Number(process.env.N ?? 60);
  const out: Record<string, unknown> = {};
  for (const level of (process.env.LEVELS ?? 'reds6').split(',') as LevelId[]) {
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const base = createPhysicsProvider(table, { [level]: lib });
    const bySteps: Record<number, { one: number[]; two: number[] }> = {};
    let mismatches = 0; let shots = 0;
    for (let seed = 1; seed <= n; seed++) {
      let r = start(setLevel(newRound(seed * 7 + 3), level), base, table);
      while (r.phase === 'decide') {
        const { step, outcome, failure } = nextOutcome(r);
        const req: SolveRequest = { id: 1, frame: r.frame!, target: nextTarget(r), failure, ctx: { roundCode: r.roundCode, step } };
        const run = (kinds: SolveKind[]) => {
          const got: Partial<Record<SolveKind, SolveAnswer>> = {};
          const t0 = performance.now();
          solveJob(table, req, kinds, () => performance.now(), (a) => { got[a.kind] = a; });
          return { got, ms: performance.now() - t0 };
        };
        const one = run(['success', 'failure']);
        const s = run(['success']); const f = run(['failure']);
        if (!same(one.got.success, s.got.success) || !same(one.got.failure, f.got.failure)) mismatches++;
        (bySteps[step] ??= { one: [], two: [] }).one.push(one.ms);
        bySteps[step].two.push(Math.max(s.ms, f.ms));
        shots++;
        const kind = outcome === 'success' ? 'success' : 'failure';
        const a = one.got[kind]!;
        r = shoot(r, solvedProvider(base, a.planned, { target: a.target, outcome }), table, r.frame!.phase === 'colour' ? (a.target as never) : undefined);
      }
    }
    const rows = Object.entries(bySteps).map(([st, v]) => ({ step: Number(st), n: v.one.length,
      oneMed: Math.round(med(v.one)), oneMax: Math.round(Math.max(...v.one)), twoMed: Math.round(med(v.two)), twoMax: Math.round(Math.max(...v.two)) }));
    const all = Object.values(bySteps);
    const overall = { oneMed: Math.round(med(all.flatMap((v) => v.one))), oneMax: Math.round(Math.max(...all.flatMap((v) => v.one))),
      twoMed: Math.round(med(all.flatMap((v) => v.two))), twoMax: Math.round(Math.max(...all.flatMap((v) => v.two))) };
    out[level] = { rounds: n, shots, mismatches, overall, rows };
    console.log(`${level}: ${shots} shots, mismatches ${mismatches}, one worker med ${overall.oneMed} max ${overall.oneMax} ms | two workers med ${overall.twoMed} max ${overall.twoMax} ms`);
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
}, 3_600_000);
