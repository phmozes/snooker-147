// Task 5.2: asks the solver worker for the next shot (both outcomes) while the player decides, and hands the answer
// to the round state machine when SHOOT is pressed. A request that is no longer needed (cash out, new round) is
// dropped by restarting the worker, so the next one never waits behind it.

import type { FailureLabel, PlannedShot, ShotProvider } from '../core/round';
import type { FrameState } from '../core/rules';
import type { FallbackLogEntry } from '../core/solver';
import type { BallKind } from '../core/types';

export interface SolveRequest { id: number; frame: FrameState; target: BallKind; failure: FailureLabel; ctx: { roundCode: string; step: number } }
export interface SolveAnswer { id: number; kind: 'success' | 'failure'; target: BallKind; planned: PlannedShot; ms: number; log: FallbackLogEntry[] }
/** target: the ball the shot is at (on a colour step the colour the game picked, RULES B.3). */
export interface Solved { planned: PlannedShot; ms: number; target: BallKind }

export function createPresolver(onLog: (entries: FallbackLogEntry[]) => void, onAnswer: () => void = () => {}) {
  let worker: Worker | null = null;
  let nextId = 1;
  let current: { req: SolveRequest; answers: Partial<Record<'success' | 'failure', Solved>>; waiting: (() => void)[] } | null = null;

  function start() {
    worker = new Worker(new URL('./solverWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<SolveAnswer>) => {
      const a = e.data;
      if (!current || a.id !== current.req.id) return; // an old request
      current.answers[a.kind] = { planned: a.planned, ms: a.ms, target: a.target };
      if (a.log.length) onLog(a.log);
      for (const w of current.waiting.splice(0)) w();
      onAnswer();
    };
  }

  return {
    /** Start solving the next shot (both outcomes). */
    request(frame: FrameState, target: BallKind, failure: FailureLabel, ctx: SolveRequest['ctx']) {
      if (!worker) start();
      current = { req: { id: nextId++, frame, target, failure, ctx }, answers: {}, waiting: [] };
      worker!.postMessage(current.req);
    },
    /** Drop the current request (the worker is restarted only if it is still busy with it). */
    cancel() {
      if (current && !(current.answers.success && current.answers.failure)) { worker?.terminate(); worker = null; }
      current = null;
    },
    ready(kind: 'success' | 'failure') { return !!current?.answers[kind]; },
    /** The ball the next shot is at, once known (the success answer comes first). */
    target(): BallKind | null { return current?.answers.success?.target ?? null; },
    /** The answer for the decided outcome, as soon as it exists. */
    async get(kind: 'success' | 'failure', ctx: SolveRequest['ctx']): Promise<Solved> {
      const c = current;
      if (!c || c.req.ctx.roundCode !== ctx.roundCode || c.req.ctx.step !== ctx.step) throw new Error('no solve was requested for this shot');
      while (!c.answers[kind]) await new Promise<void>((res) => c.waiting.push(res));
      return c.answers[kind]!;
    },
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
