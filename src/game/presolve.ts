// Task 5.2: asks the solver workers for the next shot (both outcomes) while the player decides, and hands the answer
// to the round state machine when SHOOT is pressed. Task P.1: two workers, one solves the success and one the failure,
// in parallel; each stays alive between shots. A request that is no longer needed (cash out, new round) is dropped
// by restarting only the worker still busy with it, so the next one never waits behind it.
// Task P.1 (fairness of the wait): SHOOT always waits until BOTH answers exist, whatever the decided outcome, so how
// long THINKING… shows never hints at a hit or a miss.

import { pos411pOn } from '../core/solverMode';
import type { FailureLabel, PlannedShot, ShotProvider } from '../core/round';
import type { FrameState } from '../core/rules';
import type { FallbackLogEntry } from '../core/solver';
import type { BallKind, Colour } from '../core/types';

export type SolveKind = 'success' | 'failure';
/** only: the outcome this worker solves (task P.1); without it the worker solves both, success first. */
/** colour (task 5.4, replay by round code): on a colour step, the colour from the code instead of the automatic pick. */
export interface SolveRequest { only?: SolveKind; id: number; frame: FrameState; target: BallKind; failure: FailureLabel; ctx: { roundCode: string; step: number }; colour?: Colour; pos411p?: boolean }
export interface SolveAnswer { id: number; kind: SolveKind; target: BallKind; planned: PlannedShot; ms: number; log: FallbackLogEntry[] }
/** target: the ball the shot is at (on a colour step the colour the game picked, RULES B.3). */
export interface Solved { planned: PlannedShot; ms: number; target: BallKind }
/** What the presolver needs from a worker (a real Web Worker, or a fake one in tests). */
export interface SolverWorker { postMessage(req: SolveRequest): void; terminate(): void; onmessage: ((e: MessageEvent<SolveAnswer>) => void) | null }

const newWorker = (): SolverWorker => new Worker(new URL('./solverWorker.ts', import.meta.url), { type: 'module' });

type Job = { req: SolveRequest; key: string; answers: Partial<Record<SolveKind, Solved>>; waiting: (() => void)[] };
const keyOf = (r: Omit<SolveRequest, 'id'>) => JSON.stringify([r.ctx.roundCode, r.ctx.step, r.target, r.failure, r.colour ?? null, r.frame, !!r.pos411p]);

/**
 * onBoth (task P.2): called once both answers of the shot being decided exist, with its success answer. The page then
 * asks for the step after it with ahead(), from the frame that success leaves. That always happens, whatever the
 * decided outcome; if the step fails or the player cashes out, the step after is simply dropped.
 */
export function createPresolver(onLog: (entries: FallbackLogEntry[]) => void, onAnswer: () => void = () => {},
  makeWorker: () => SolverWorker = newWorker, onBoth: (req: SolveRequest, success: Solved) => void = () => {}) {
  const workers: Record<SolveKind, SolverWorker | null> = { success: null, failure: null };
  let nextId = 1;
  let current: Job | null = null; // the shot SHOOT plays next
  let next: Job | null = null; // task P.2: the shot after it, solved from the success end of `current`
  let promoted = false; // the current job was started ahead (developer cost line)
  const both = (c: Job) => !!(c.answers.success && c.answers.failure);
  const job = (frame: FrameState, target: BallKind, failure: FailureLabel, ctx: SolveRequest['ctx'], colour?: Colour): Job => {
    const req: SolveRequest = { id: nextId++, frame, target, failure, ctx, ...(colour ? { colour } : {}), ...(pos411pOn() ? { pos411p: true } : {}) }; // Part 3c switch reaches the workers
    return { req, key: keyOf(req), answers: {}, waiting: [] };
  };
  const post = (j: Job) => { for (const k of ['success', 'failure'] as const) (workers[k] ?? start(k)).postMessage({ ...j.req, only: k }); };

  function start(kind: SolveKind) {
    const w = makeWorker();
    w.onmessage = (e: MessageEvent<SolveAnswer>) => {
      const a = e.data;
      const j = current?.req.id === a.id ? current : next?.req.id === a.id ? next : null;
      if (!j) return; // an old request
      j.answers[a.kind] = { planned: a.planned, ms: a.ms, target: a.target };
      if (a.log.length) onLog(a.log);
      if (j === current && both(j)) {
        for (const res of j.waiting.splice(0)) res();
        onBoth(j.req, j.answers.success!);
      }
      if (j === current) onAnswer();
    };
    workers[kind] = w;
    return w;
  }
  /** Restart every worker still busy with a request that is dropped. */
  function drop(...jobs: (Job | null)[]) {
    for (const j of jobs) {
      if (!j) continue;
      for (const k of ['success', 'failure'] as const) if (!j.answers[k]) { workers[k]?.terminate(); workers[k] = null; }
    }
  }

  return {
    /** The next shot (both outcomes, one worker each). If it was already started ahead (task P.2), that is kept. */
    request(frame: FrameState, target: BallKind, failure: FailureLabel, ctx: SolveRequest['ctx'], colour?: Colour) {
      const j = job(frame, target, failure, ctx, colour);
      if (next && next.key === j.key) {
        drop(current);
        current = next; next = null; promoted = true;
        if (both(current)) onBoth(current.req, current.answers.success!);
        return;
      }
      drop(current, next);
      next = null; promoted = false;
      current = j;
      post(j);
    },
    /** Task P.2: start the shot after the current one (asked from onBoth, so both workers are free). */
    ahead(frame: FrameState, target: BallKind, failure: FailureLabel, ctx: SolveRequest['ctx'], colour?: Colour) {
      if (!current || !both(current)) return;
      drop(next);
      next = job(frame, target, failure, ctx, colour);
      post(next);
    },
    /** Drop every request (only a worker still busy with one is restarted). */
    cancel() { drop(current, next); current = null; next = null; promoted = false; },
    /** Both answers exist (SHOOT can play at once, whatever the outcome). */
    ready() { return !!current && both(current); },
    /** The ball the next shot is at, once known (both answers carry it). */
    target(): BallKind | null { return current?.answers.success?.target ?? current?.answers.failure?.target ?? null; },
    /** The answer for the decided outcome, given only once BOTH answers exist (the wait never depends on the outcome). */
    async get(kind: SolveKind, ctx: SolveRequest['ctx']): Promise<Solved> {
      const c = current;
      if (!c || c.req.ctx.roundCode !== ctx.roundCode || c.req.ctx.step !== ctx.step) throw new Error('no solve was requested for this shot');
      while (!both(c)) await new Promise<void>((res) => c.waiting.push(res));
      return c.answers[kind]!;
    },
    /** Developer panel (task P.1): the cost of both answers of the current request; ahead: it was started a step early. */
    answers(): Partial<Record<SolveKind, Solved>> & { ahead: boolean } { return { ...(current?.answers ?? {}), ahead: promoted }; },
  };
}

/** A ShotProvider for one SHOOT that answers with the shot already solved (it checks it is the shot asked for). */
export function solvedProvider(base: ShotProvider, planned: PlannedShot, expect: { target: BallKind; outcome: 'success' | FailureLabel }): ShotProvider {
  return {
    breakAndStep1: base.breakAndStep1,
    shot(_frame, target, outcome) {
      if (target !== expect.target || outcome !== expect.outcome) throw new Error('the solved shot is not the one asked for');
      return planned;
    },
  };
}
