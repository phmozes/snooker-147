// Dev only (task P.1, owner 2026-11-25): the fields of one phone-cost line, one per step, step 1 included.
// Step 1 comes from the break-off library (no solve, no SHOOT press): its cost and timing fields are null, not 0.

import { outcomeDraw, type Round } from '../core/round';
import type { Solved, SolveKind } from './presolve';

export interface StepInfo {
  target: string; outcome: string; forced: boolean; auto: boolean; ahead: boolean;
  /** both solver answers; null for step 1 (from the library) */
  answers: Partial<Record<SolveKind, Solved>> | null;
  pressAfterMs: number | null; thinkingMs: number | null;
}

/** r: the round as it was when step k was decided (for step 1: right after start()). */
export function stepCost(r: Round, k: number, i: StepInfo): Record<string, unknown> {
  const d = outcomeDraw(r, k);
  const a = i.answers;
  const ms = (s: Solved | undefined) => (s ? Math.round(s.ms) : null);
  return { u: +d.u.toFixed(6), p: +d.p.toFixed(6), code: r.roundCode, step: k, target: i.target, outcome: i.outcome,
    forced: i.forced, auto: i.auto, ahead: i.ahead,
    successMs: a ? ms(a.success) : null, successTried: a?.success?.planned.tried ?? null,
    failureMs: a ? ms(a.failure) : null, failureTried: a?.failure?.planned.tried ?? null,
    pressAfterMs: i.pressAfterMs === null ? null : Math.round(i.pressAfterMs), thinkingMs: i.thinkingMs === null ? null : Math.round(i.thinkingMs) };
}

/** Version of the line the page sends. A line without it (or with a lower one) came from an older page that was
 *  not reloaded (owner 2026-11-25: the phone sent no step-1 line from a page older than the step-1 change). */
export const COST_LINE_VERSION = 2;
/** The body the page posts to /__dev/cost. */
export const costBody = (line: Record<string, unknown>, ua: string, solver: string) =>
  JSON.stringify({ ...line, line: COST_LINE_VERSION, ua, solver, presolve: 'P.2' });
