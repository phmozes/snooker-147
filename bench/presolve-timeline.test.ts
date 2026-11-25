// Task P.2: how often THINKING… shows for a fast player (SHOOT pressed PRESS s after it appears), P.1 vs P.2.
// Each solve is timed once per step (success worker alone, failure worker alone, the same code: solveJob.ts); then the
// same times are played through both schedules, so only the schedule differs:
//   P.1: step k+1 starts solving when shot k starts playing
//   P.2: step k+1 starts solving as soon as both answers of step k exist (from the success end of step k)
// The screen: re-rack wait, break-off and step 1 animations, then each shot plays for its length / playbackTimeScale.
// SHOOT plays once both answers exist; THINKING… shows when they are not there at the press.
// Run: N=60 LEVELS=reds6 OUT=x.json npx vitest run bench/presolve-timeline.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, nextOutcome, nextTarget, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';
import { solvedProvider, type SolveAnswer, type SolveKind, type SolveRequest } from '../src/game/presolve';
import { solveJob } from '../src/game/solveJob';

const PRESS = Number(process.env.PRESS ?? 0.4);
const pct = (x: number[], q: number) => { const s = [...x].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))]! : 0; };

interface Step { step: number; target: string; solve: number; sMs: number; fMs: number; anim: number; ends: boolean }

function schedule(intro: number, steps: Step[], ahead: boolean) {
  const waits: { step: number; target: string; wait: number; solve: number }[] = [];
  let req = 0; // when the step to play next started solving (step 2: at START, during the break-off)
  let avail = intro; // when SHOOT appears
  for (const s of steps) {
    const ready = req + s.solve;
    const press = avail + PRESS;
    const shotStart = Math.max(press, ready);
    waits.push({ step: s.step, target: s.target, wait: Math.max(0, ready - press), solve: s.solve });
    if (s.ends) break;
    avail = shotStart + s.anim;
    req = ahead ? ready : shotStart;
  }
  return waits;
}

it('THINKING for a fast player: P.1 vs P.2', () => {
  const table = buildTable();
  const n = Number(process.env.N ?? 60);
  const out: Record<string, unknown> = {};
  const scale = CONFIG.shot.playbackTimeScale;
  for (const level of (process.env.LEVELS ?? 'reds6').split(',') as LevelId[]) {
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const base = createPhysicsProvider(table, { [level]: lib });
    const res: Record<'p1' | 'p2', { step: number; target: string; wait: number; solve: number }[]> = { p1: [], p2: [] };
    for (let seed = 1; seed <= n; seed++) {
      let r = start(setLevel(newRound(seed * 7 + 3), level), base, table);
      const brk = r.breakShot as { shot: { duration: number } };
      const intro = CONFIG.ui.reRackSeconds + brk.shot.duration / scale + (r.history[0]!.shot as { duration: number }).duration / scale;
      const steps: Step[] = [];
      while (r.phase === 'decide') {
        const { step, outcome, failure } = nextOutcome(r);
        const req: SolveRequest = { id: 1, frame: r.frame!, target: nextTarget(r), failure, ctx: { roundCode: r.roundCode, step } };
        const timed = (k: SolveKind) => {
          let got: SolveAnswer | null = null;
          const t0 = performance.now();
          solveJob(table, req, [k], () => performance.now(), (a) => { got = a; });
          return { a: got! as SolveAnswer, ms: performance.now() - t0 };
        };
        const s = timed('success'); const f = timed('failure');
        const kind = outcome === 'success' ? 'success' : 'failure';
        const a = kind === 'success' ? s.a : f.a;
        r = shoot(r, solvedProvider(base, a.planned, { target: a.target, outcome }), table, r.frame!.phase === 'colour' ? (a.target as never) : undefined);
        const h = r.history[r.history.length - 1]!;
        const anim = h.outcome === 'reRack' ? 0 : (h.shot as { duration: number }).duration / scale;
        steps.push({ step, target: a.target, solve: Math.max(s.ms, f.ms) / 1000, sMs: s.ms, fMs: f.ms, anim, ends: r.phase !== 'decide' });
      }
      res.p1.push(...schedule(intro, steps, false));
      res.p2.push(...schedule(intro, steps, true));
    }
    const sum = (w: typeof res.p1) => {
      const t = w.filter((x) => x.wait > 0);
      return { shots: w.length, thinking: t.length, thinkingPct: +(100 * t.length / w.length).toFixed(1),
        waitMedianMs: Math.round(1000 * pct(t.map((x) => x.wait), 0.5)), waitMaxMs: Math.round(1000 * Math.max(0, ...t.map((x) => x.wait))),
        worst: t.sort((a, b) => b.wait - a.wait).slice(0, 5).map((x) => `step ${x.step} ${x.target}: wait ${Math.round(1000 * x.wait)} ms (solve ${Math.round(1000 * x.solve)} ms)`) };
    };
    out[level] = { press: PRESS, p1: sum(res.p1), p2: sum(res.p2) };
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
}, 3_600_000);
