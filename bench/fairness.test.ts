// Task F.1 part 2 (owner 2026-11-25): does the position before a shot predict its outcome? It must not (RULES A.5).
// Real rounds (library break + real solver + physics), always SHOOT. For every shot from step 2 on, the position is
// measured BEFORE the shot from the balls only (never from the outcome or from the solved shot, which depends on it):
//   near: cue ball within NEAR_M of any cushion; open: an open pot exists (straight line, clear paths, the pocket can
//   take the ball); cut: the smallest cut of an open pot; dist: cue ball to the nearest target ball.
// Step 1 is left out: it plays itself (no CASH OUT before it) and its break is picked by its outcome (RULES B.2).
// A failure ends the round, so its shot is not solved here (a fast stand-in); that changes nothing that is measured.
// One line per shot is appended to <OUT>/<level>.jsonl: [step, p, fail, near, open, cut, dist]; resumable (SEED_FROM).
// Run (one level at a time, memory): LEVEL=reds6 N=5000 OUT=bench/results/fairness npx vitest run bench/fairness.test.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, nextTarget, setLevel, shoot, start, stepSucceeds, type LevelId, type Round, type ShotProvider } from '../src/core/round';
import type { FrameState } from '../src/core/rules';
import { cutAngle } from '../src/core/shotType';
import { entryOk, pathClear } from '../src/core/solver';
import { buildTable, type TableGeometry } from '../src/core/table/geometry';
import type { BallKind } from '../src/core/types';

export const NEAR_M = 0.25;

/** Position facts before a shot at `target` (balls only). */
export function positionFacts(frame: FrameState, target: BallKind, table: TableGeometry) {
  const r = table.ballRadius;
  const cue = frame.balls.find((b) => b.kind === 'cue')!.pos;
  const near = table.halfWidth - Math.abs(cue.x) <= NEAR_M || table.halfLength - Math.abs(cue.y) <= NEAR_M;
  let cut: number | null = null; let dist = Infinity;
  for (const ball of frame.balls.filter((b) => b.kind === target)) {
    dist = Math.min(dist, Math.hypot(ball.pos.x - cue.x, ball.pos.y - cue.y));
    for (const p of table.pockets) {
      const c = cutAngle(cue, ball.pos, p.mouthMid, r);
      if (c > CONFIG.solver.maxCutDeg || !entryOk(ball.pos, p)) continue;
      const toP = { x: p.mouthMid.x - ball.pos.x, y: p.mouthMid.y - ball.pos.y };
      const d = Math.hypot(toP.x, toP.y);
      const ghost = { x: ball.pos.x - (toP.x / d) * 2 * r, y: ball.pos.y - (toP.y / d) * 2 * r };
      if (!pathClear(cue, ghost, frame.balls, ['cue', ball.id], r) || !pathClear(ball.pos, p.mouthMid, frame.balls, ['cue', ball.id], r)) continue;
      if (cut === null || c < cut) cut = c;
    }
  }
  return { near, open: cut !== null, cut, dist };
}

it('fairness: position before a shot vs its outcome', () => {
  const table = buildTable();
  const level = (process.env.LEVEL ?? 'reds6') as LevelId;
  const n = Number(process.env.N ?? 20);
  const from = Number(process.env.SEED_FROM ?? 0); // see <OUT>/<level>.done
  const dir = process.env.OUT ?? 'bench/results/fairness';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = `${dir}/${level}.jsonl`;
  const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
  const real = createPhysicsProvider(table, { [level]: lib });
  // a failure ends the round: answer it with a plain miss (target hit, nothing potted) instead of solving it
  const provider: ShotProvider = { ...real, shot: (frame, target, outcome, ctx) => outcome === 'success' ? real.shot(frame, target, outcome, ctx)
    : { result: { firstHit: frame.balls.find((b) => b.kind === target)!.id, potted: [], after: frame.balls } } };
  for (let i = from; i < from + n; i++) {
    const seed = 7_000_000 + i; // never the bench (seed * 7 + 3) or soak (5,000,000+) seeds
    let r: Round = start(setLevel(newRound(seed), level), provider, table);
    const lines: string[] = [];
    while (r.phase === 'decide') {
      const k = r.step + 1;
      // the target is known before the outcome is used (the auto colour depends on the layout only, RULES B.3)
      const colour = r.frame!.phase === 'colour' ? real.autoColour!(r.frame!, { roundCode: r.roundCode, step: k }) : undefined;
      const target = nextTarget(r, colour);
      const f = positionFacts(r.frame!, target, table);
      const p = r.ladder[k - 1]!.p;
      const fail = stepSucceeds(r, k) ? 0 : 1;
      lines.push(JSON.stringify([k, +p.toFixed(5), fail, f.near ? 1 : 0, f.open ? 1 : 0, f.cut === null ? null : +f.cut.toFixed(1), +f.dist.toFixed(3)]));
      r = shoot(r, provider, table, colour);
    }
    appendFileSync(file, lines.join('\n') + (lines.length ? '\n' : ''));
    writeFileSync(`${dir}/${level}.done`, `${i + 1} ${CONFIG.solver.version}\n`); // rounds done: resume with SEED_FROM=<this>
  }
}, 86_400_000);
