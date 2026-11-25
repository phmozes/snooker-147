// Task F.1 (owner 2026-11-25): the position never decides the outcome (RULES A.5: only the seed and the step).
// 1. The same seeds played with very different shot providers give the same outcomes, the same end step, and exactly
//    the outcomes computed from the seed alone. 2. Only round.ts reads the outcome stream; the solver side never sees it.
// 3. The owner's phone round reds15-102978669: the step 10 miss comes from the seed (real solver and the bad fake).
// The real solver against the seed on thousands of rounds: bench/fairness.test.ts (docs/FAIRNESS.md).
import { describe, expect, it } from 'vitest';
import reds15lib from '../public/breaks/reds15.json';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, streamValue, type FailureLabel, type LevelId, type Round, type ShotProvider } from '../src/core/round';
import type { FrameState, ShotResult } from '../src/core/rules';
import { buildTable } from '../src/core/table/geometry';
import type { BallKind, Colour } from '../src/core/types';

const table = buildTable();
// every source file as text (Vite raw import), keyed like '../src/core/round.ts'
const SOURCES = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const source = (f: string) => SOURCES[`../${f}`]!;

function result(frame: FrameState, target: BallKind, outcome: 'success' | FailureLabel, cueTo?: (f: FrameState) => { x: number; y: number }): ShotResult {
  const ball = frame.balls.find((b) => b.kind === target)!;
  const other = frame.balls.find((b) => b.kind !== target && b.kind !== 'cue');
  const keep = (potted: string[]) => frame.balls.filter((b) => !potted.includes(b.id))
    .map((b) => (b.kind === 'cue' && cueTo ? { ...b, pos: cueTo(frame) } : b));
  switch (outcome) {
    case 'success': return { firstHit: ball.id, potted: [ball.id], after: keep([ball.id]) };
    case 'inOff': return { firstHit: ball.id, potted: ['cue'], after: keep(['cue']) };
    case 'wrongBallFirst': return { firstHit: other ? other.id : null, potted: [], after: keep([]) };
    case 'snookered': return { firstHit: null, potted: [], after: keep([]) };
    default: return { firstHit: ball.id, potted: [], after: keep([]) };
  }
}
/** Plain fake: balls stay where they are. */
const plain: ShotProvider = {
  breakAndStep1: (_l, outcome, _p, frame) => ({ afterBreak: frame, step1: { result: result(frame, 'red', outcome) } }),
  shot: (frame, target, outcome) => ({ result: result(frame, target, outcome) }),
};
/** Bad-position fake: the cue ball is always left near a corner cushion, and the colour changes every step. */
const corner = (f: FrameState) => {
  const r = table.ballRadius;
  const spots = [1, -1].flatMap((sx) => [1, -1].map((sy) => ({ x: sx * (table.halfWidth - r - 0.01), y: sy * (table.halfLength - 0.3) })));
  return spots.find((s) => f.balls.every((b) => b.kind === 'cue' || Math.hypot(b.pos.x - s.x, b.pos.y - s.y) > 2 * r + 0.01)) ?? spots[0]!;
};
const COLOURS: Colour[] = ['blue', 'pink', 'black', 'green'];
const bad: ShotProvider = {
  breakAndStep1: (_l, outcome, _p, frame) => ({ afterBreak: frame, step1: { result: result(frame, 'red', outcome, corner) } }),
  shot: (frame, target, outcome) => ({ result: result(frame, target, outcome, corner) }),
  autoColour: (_f, ctx) => COLOURS[ctx.step % COLOURS.length]!,
};

const play = (seed: number, level: LevelId, provider: ShotProvider): Round => {
  let r = start(setLevel(newRound(seed), level), provider, table);
  while (r.phase === 'decide') r = shoot(r, provider, table);
  return r;
};
/** From the seed alone (not through round.ts's own check): success while u(k) < p(k), up to the first failure. */
const fromSeed = (seed: number, level: LevelId): boolean[] => {
  const ladder = setLevel(newRound(seed), level).ladder;
  const out: boolean[] = [];
  for (let k = 1; k <= ladder.length; k++) { const ok = streamValue(seed, 'outcome', k) < ladder[k - 1]!.p; out.push(ok); if (!ok) break; }
  return out;
};
const outcomes = (r: Round) => r.history.map((h) => h.outcome);

describe('F.1: the outcome depends on the seed and the step only', () => {
  it.each(CONFIG.levels.map((l) => l.id as LevelId))('%s: 200 seeds, plain fake vs bad-position fake vs the seed alone', (level) => {
    let failures = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const a = play(seed, level, plain);
      const b = play(seed, level, bad);
      expect(outcomes(b)).toEqual(outcomes(a)); // same outcomes and failure types
      expect(b.end).toEqual(a.end); // same end step (and payout)
      expect(outcomes(a).map((o) => o === 'success')).toEqual(fromSeed(seed, level));
      if (a.end?.type === 'failure') failures++;
    }
    expect(failures).toBeGreaterThan(150); // the seeds really cover failures at many steps
  });

  it('only round.ts reads the outcome stream; the solver side only gets types from round.ts', () => {
    const files = Object.keys(SOURCES).map((k) => k.slice(3));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      if (f === 'src/core/round.ts') continue;
      const src = source(f);
      expect(src.includes("'outcome'") && src.includes('streamValue'), f).toBe(false);
      expect(/\b(stepSucceeds|streamValue)\s*\(/.test(src), f).toBe(false);
      // only the game page may call nextOutcome (before SHOOT it uses the failure TYPE only, see the next test)
      if (f !== 'src/game/gamePage.ts') expect(/\bnextOutcome\s*\(/.test(src), f).toBe(false);
    }
    for (const f of ['src/core/solver.ts', 'src/core/solverFailure.ts', 'src/core/physicsProvider.ts', 'src/game/presolve.ts', 'src/game/solverWorker.ts']) {
      for (const m of source(f).matchAll(/^import (.*) from '.*\/round';$/gm)) expect(m[1]!.startsWith('type '), f).toBe(true);
    }
  });

  it('the game page asks the solver for both outcomes before SHOOT, giving it only the failure type', () => {
    const src = source('src/game/gamePage.ts');
    const pre = src.slice(src.indexOf('function presolveNext()'), src.indexOf('async function onStart()'));
    expect(pre).toContain('const { step, failure } = nextOutcome(round);');
    expect(pre).not.toMatch(/\.outcome\b/);
    expect(source('src/game/solverWorker.ts')).toContain("['success', 'failure']"); // both, success first
    expect(source('src/game/presolve.ts')).toContain('while (!both(c))'); // task P.1: SHOOT waits for both answers
  });
});

describe("F.1: the owner's phone round reds15-102978669", () => {
  const seed = 102978669;
  const level: LevelId = 'reds15';
  it('steps 1-12: outcome stream value vs p(step); the step 10 miss comes from the seed', () => {
    const ladder = setLevel(newRound(seed), level).ladder;
    const rows = ladder.slice(0, 12).map((s, i) => ({ step: i + 1, u: streamValue(seed, 'outcome', i + 1), p: s.p }));
    console.log(rows.map((x) => `step ${x.step}: u ${x.u.toFixed(4)} ${x.u < x.p ? '<' : '>='} p ${x.p.toFixed(4)}`).join('\n'));
    expect(fromSeed(seed, level)).toEqual([...Array(9).fill(true), false]); // steps 1-9 succeed, step 10 fails
  });
  it('the bad-position fake and the real solver (current version) both miss at step 10', () => {
    expect(play(seed, level, bad).end).toMatchObject({ type: 'failure', step: 10 });
    expect(CONFIG.breakLibrary.files[level]).toBe('breaks/reds15.json');
    const real = play(seed, level, createPhysicsProvider(table, { [level]: reds15lib as never }));
    expect(real.end).toMatchObject({ type: 'failure', step: 10 });
    expect(outcomes(real).slice(0, 9).every((o) => o === 'success')).toBe(true);
  }, 300_000);
});
