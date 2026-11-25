// Task 5.2: asks the solver workers for the next shot (both outcomes) while the player decides, and hands the answer
// to the round state machine when SHOOT is pressed. Task P.1: two workers, one solves the success and one the failure,
// in parallel; each stays alive between shots. A request that is no longer needed (cash out, new round) is dropped
// by restarting only the worker still busy with it, so the next one never waits behind it.
// Task P.1 (fairness of the wait): SHOOT always waits until BOTH answers exist, whatever the decided outcome, so how
// long THINKING… shows never hints at a hit or a miss.

import type { FailureLabel, PlannedShot, ShotProvider } from '../core/round';
import type { FrameState } from '../core/rules';
import type { FallbackLogEntry } from '../core/solver';
import type { BallKind } from '../core/types';

export type SolveKind = 'success' | 'failure';
/** only: the outcome this worker solves (task P.1); without it the worker solves both, success first. */
export interface SolveRequest { only?: SolveKind; id: number; frame: FrameState; target: BallKind; failure: FailureLabel; ctx: { roundCode: string; step: number } }
export interface SolveAnswer { id: number; kind: SolveKind; target: BallKind; planned: PlannedShot; ms: number; log: FallbackLogEntry[] }
/** target: the ball the shot is at (on a colour step the colour the game picked, RULES B.3). */
export interface Solved { planned: PlannedShot; ms: number; target: BallKind }
/** What the presolver needs from a worker (a real Web Worker, or a fake one in tests). */
export interface SolverWorker { postMessage(req: SolveRequest): void; terminate(): void; onmessage: ((e: MessageEvent<SolveAnswer>) => void) | null }

const newWorker = (): SolverWorker => new Worker(new URL('./solverWorker.ts', import.meta.url), { type: 'module' });

export function createPresolver(onLog: (entries: FallbackLogEntry[]) => void, onAnswer: () => void = () => {},
  makeWorker: () => SolverWorker = newWorker) {
  const workers: Record<SolveKind, SolverWorker | null> = { success: null, failure: null };
  let nextId = 1;
  let current: { req: SolveRequest; answers: Partial<Record<SolveKind, Solved>>; waiting: (() => void)[] } | null = null;
  const both = (c: NonNullable<typeof current>) => !!(c.answers.success && c.answers.failure);

  function start(kind: SolveKind) {
    const w = makeWorker();
    w.onmessage = (e: MessageEvent<SolveAnswer>) => {
      const a = e.data;
      if (!current || a.id !== current.req.id) return; // an old request
      current.answers[a.kind] = { planned: a.planned, ms: a.ms, target: a.target };
      if (a.log.length) onLog(a.log);
      if (both(current)) for (const res of current.waiting.splice(0)) res();
      onAnswer();
    };
    workers[kind] = w;
    return w;
  }
  /** Restart every worker still busy with the current request. */
  function drop() {
    if (!current) return;
    for (const k of ['success', 'failure'] as const) if (!current.answers[k]) { workers[k]?.terminate(); workers[k] = null; }
    current = null;
  }

  return {
    /** Start solving the next shot (both outcomes, one worker each). */
    request(frame: FrameState, target: BallKind, failure: FailureLabel, ctx: SolveRequest['ctx']) {
      drop();
      const req: SolveRequest = { id: nextId++, frame, target, failure, ctx };
      current = { req, answers: {}, waiting: [] };
      for (const k of ['success', 'failure'] as const) (workers[k] ?? start(k)).postMessage({ ...req, only: k });
    },
    /** Drop the current request (only a worker still busy with it is restarted). */
    cancel() { drop(); },
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
    /** Developer panel (task P.1): the cost of both answers of the current request. */
    answers(): Partial<Record<SolveKind, Solved>> { return { ...(current?.answers ?? {}) }; },
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
