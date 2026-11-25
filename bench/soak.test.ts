// Task 5.5 soak test: many real rounds (library break + real solver + physics), always SHOOT, per level and shard.
// Writes its results to files (no long console output). Run in the background, for example:
//   LEVEL=reds6 SHARD=0 SHARDS=3 TARGET=34000 UNTIL=<epoch ms> OUT=bench/results/soak npx vitest run bench/soak.test.ts
// Results: <OUT>/<level>-<shard>.json (rewritten every few rounds) and <OUT>/<level>-<shard>-failures.txt (one line
// per crash, invalid shot or rules violation: round code, step, what). Merge: node bench/soak-merge.mjs <OUT>.
// Round codes are `<level>-<seed>`; replay a problem with bench/replay-shot.test.ts.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { judgeShot } from '../src/core/rules';
import { newRound, setLevel, shoot, start, type LevelId, type Round } from '../src/core/round';
import { classifySuccess, playFacts } from '../src/core/shotType';
import { shotCaps } from '../src/core/solver';
import { buildTable } from '../src/core/table/geometry';

it('soak', () => {
  const table = buildTable();
  const level = (process.env.LEVEL ?? 'reds6') as LevelId;
  const shard = Number(process.env.SHARD ?? 0);
  const shards = Number(process.env.SHARDS ?? 1);
  const target = Number(process.env.TARGET ?? 1000); // success shots (after step 1) for this shard
  const until = Number(process.env.UNTIL ?? Infinity); // stop at this time (epoch ms)
  const out = process.env.OUT ?? 'bench/results/soak';
  mkdirSync(out, { recursive: true });
  const file = `${out}/${level}-${shard}`;
  writeFileSync(`${file}-failures.txt`, '');
  const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
  const provider = createPhysicsProvider(table, { [level]: lib });
  const cap = shotCaps().decision;
  const r = table.ballRadius;
  const ladderLen = setLevel(newRound(1), level).ladder.length;
  // fixed cash-out strategies: cash out after step k (k = ladder length: go for the clearance)
  const ks = [...new Set([1, 2, 3, 5, 8, 12, Math.ceil(ladderLen / 2), ladderLen].filter((k) => k <= ladderLen))].sort((a, b) => a - b);
  const pay: Record<number, number> = Object.fromEntries(ks.map((k) => [k, 0]));
  const s = {
    level, shard, shards, solver: CONFIG.solver.version, rounds: 0, shots: 0, success: 0, reRacks: 0, problems: 0,
    ends: {} as Record<string, number>, flex: {} as Record<string, number>, failureKinds: {} as Record<string, number>,
    types: {} as Record<string, number>, colours: {} as Record<string, number>, lengths: {} as Record<string, number>,
    over35: 0, maxDuration: 0, maxTried: 0, cap,
    // night 3: stuck solver, fallback share, per-step success against p, pace per kind
    slowSolves: 0, maxSolveMs: 0, overCap: 0, flexShots: 0, failShots: 0, failFallbacks: 0,
    steps: {} as Record<number, { n: number; ok: number; p: number }>, durs: { red: [] as number[], colour: [] as number[] },
    lastResort: { red: [] as number[], colour: [] as number[] }, strategies: ks, rtp: {} as Record<number, number>, startedAt: new Date().toISOString(),
    updatedAt: '', done: false,
  };
  const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };
  const problem = (code: string, step: number, what: string) => {
    s.problems++;
    appendFileSync(`${file}-failures.txt`, `${code} step ${step}: ${what}\n`);
  };
  const save = () => {
    s.rtp = Object.fromEntries(ks.map((k) => [k, Math.round((pay[k]! / Math.max(1, s.rounds)) * 10000) / 100]));
    s.updatedAt = new Date().toISOString();
    writeFileSync(`${file}.json`, JSON.stringify({ ...s, pay }, null, 1));
  };
  const STUCK_MS = Number(process.env.STUCK_MS ?? 10_000);
  const stepCount = (round: Round, k: number) => {
    const e = (s.steps[k] ??= { n: 0, ok: 0, p: round.ladder[k - 1]!.p });
    e.n++;
    const h = round.history[round.history.length - 1];
    if (h && h.step === k && (h.outcome === 'success' || h.outcome === 'reRack')) e.ok++;
  };
  let seen = 0;
  const maxRounds = Number(process.env.ROUNDS ?? Infinity); // stop after this many rounds (night 3: 3,000 per level)
  for (let i = 0; s.success < target && s.rounds < maxRounds && Date.now() < until; i++) {
    const seed = 5_000_000 + shard + i * shards; // never the bench seeds (seed * 7 + 3, small)
    let rd: Round = setLevel(newRound(seed), level);
    const code = `${level}-${seed}`;
    try {
      rd = start(rd, provider, table);
      stepCount(rd, 1);
      while (rd.phase === 'decide') {
        const before = rd.frame!;
        const t0 = performance.now();
        rd = shoot(rd, provider, table);
        const ms = performance.now() - t0;
        s.maxSolveMs = Math.max(s.maxSolveMs, Math.round(ms));
        s.shots++;
        let flexLevel: string | null = null;
        for (; seen < provider.log.length; seen++) { flexLevel = provider.log[seen]!.level; bump(s.flex, flexLevel); }
        const h = rd.history[rd.history.length - 1]!;
        stepCount(rd, h.step);
        if (ms > STUCK_MS) { s.slowSolves++; problem(code, h.step, `solver took ${Math.round(ms)} ms (stuck limit ${STUCK_MS})`); }
        if ((h.tried ?? 0) > cap) { s.overCap++; problem(code, h.step, `simulated ${h.tried} shots, cap ${cap}`); }
        s.maxTried = Math.max(s.maxTried, h.tried ?? 0);
        if (before.phase === 'colour') bump(s.colours, h.target);
        if (h.outcome === 'reRack') { s.reRacks++; s.success++; problem(code, h.step, `RE-RACK (target ${h.target})`); continue; }
        const shot = h.shot as { dir: { x: number; y: number }; speed: number; spin: number; duration: number; fallback?: string | null };
        if (h.outcome !== 'success') { s.failShots++; if (shot.fallback) s.failFallbacks++; bump(s.failureKinds, `${h.outcome}${shot.fallback ? `->${shot.fallback}` : ''}`); continue; }
        s.success++;
        if (flexLevel) s.flexShots++;
        // re-simulate the played shot: it must pot a legal ball, leave every ball on the cloth and apart
        const pf = playFacts(before.balls, shot, table);
        const v = judgeShot(before, h.target, { firstHit: firstHit(pf.events), potted: pf.potted, after: [] });
        if (v.result !== 'success') { problem(code, h.step, `success shot does not pot legally when replayed (${h.target})`); continue; }
        for (const b of pf.after) {
          const out = Math.abs(b.pos.x) > table.halfWidth - r + 1e-3 || Math.abs(b.pos.y) > table.halfLength - r + 1e-3;
          // a ball resting in a pocket's jaws is past the cushion line but still on the table
          const inJaws = table.pockets.some((p) => Math.hypot(p.mouthMid.x - b.pos.x, p.mouthMid.y - b.pos.y) < 0.15);
          if (out && !inJaws) problem(code, h.step, `${b.id} off the cloth (${b.pos.x.toFixed(3)}, ${b.pos.y.toFixed(3)})`);
        }
        for (let a = 0; a < pf.after.length; a++) for (let c = a + 1; c < pf.after.length; c++) {
          const A = pf.after[a]!.pos; const C = pf.after[c]!.pos;
          if (Math.hypot(A.x - C.x, A.y - C.y) < 2 * r - 1e-3) problem(code, h.step, `${pf.after[a]!.id} and ${pf.after[c]!.id} overlap`);
        }
        bump(s.types, classifySuccess({ state: before.balls, target: h.target, potted: pf.potted[0]!, aimedPocket: null, events: pf.events, table }));
        const d = shot.duration;
        bump(s.lengths, (Math.min(6, Math.floor(d / 0.25) * 0.25)).toFixed(2));
        if (d > 3.5) s.over35++;
        const kind = h.target === 'red' ? 'red' : 'colour';
        s.durs[kind].push(Math.round(d * 100) / 100);
        if (flexLevel === 'exhibition') s.lastResort[kind].push(Math.round(d * 100) / 100);
        s.maxDuration = Math.max(s.maxDuration, d);
      }
    } catch (e) {
      problem(code, rd.step + 1, `CRASH ${(e as Error).message}`);
      bump(s.ends, 'crash');
      s.rounds++;
      continue;
    }
    s.rounds++;
    bump(s.ends, rd.end!.type);
    // payout of each fixed strategy in multiples of the bet (outcomes never depend on the player's choices)
    const reached = rd.step; // successful steps (RE-RACK step included)
    for (const k of ks) {
      if (rd.end!.type === 'reRack' && reached <= k) pay[k]! += rd.ladder[reached - 1]!.multiplier;
      else if (reached >= k) pay[k]! += rd.ladder[k - 1]!.multiplier;
    }
    if (s.rounds % 10 === 0) save();
  }
  s.done = s.success >= target || s.rounds >= maxRounds;
  save();
}, 24 * 3_600_000);

function firstHit(events: ReturnType<typeof playFacts>['events']): string | null {
  const f = events.find((e) => e.type === 'ball');
  return f && f.type === 'ball' ? (f.a === 'cue' ? f.b : f.a) : null;
}
