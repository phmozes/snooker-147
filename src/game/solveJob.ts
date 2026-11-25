// Task P.1: the work one solver worker does for one request, kept outside the worker file so tests can run it.
// `kinds` says which outcomes to solve: the page runs two workers, one with ['success'] and one with ['failure'];
// ['success', 'failure'] is the old single-worker order (kept for the test that both give the same shots).

import { createPhysicsProvider } from '../core/physicsProvider';
import type { TableGeometry } from '../core/table/geometry';
import type { SolveAnswer, SolveKind, SolveRequest } from './presolve';

export function solveJob(table: TableGeometry, req: SolveRequest, kinds: readonly SolveKind[], now: () => number,
  post: (a: SolveAnswer) => void) {
  const { id, frame, failure, ctx } = req;
  const provider = createPhysicsProvider(table, {}, now);
  let t0 = now();
  // RULES B.3: on a colour step the game picks the colour first (from the layout only), both outcomes use it
  const target = frame.phase === 'colour' ? provider.autoColour!(frame, ctx) : req.target;
  for (const kind of kinds) {
    const before = provider.log.length;
    const planned = provider.shot(frame, target, kind === 'success' ? 'success' : failure, ctx);
    post({ id, kind, target, planned, ms: now() - t0, log: provider.log.slice(before) });
    t0 = now();
  }
}
