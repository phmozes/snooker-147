// Task 5.2: the solver runs here, off the main thread, while the player decides (RULES D: the next shot is worked out
// for both outcomes before SHOOT is pressed). Task P.1: the page runs two of these, one per outcome (request.only);
// SHOOT waits for both answers (presolve.ts), so the wait never depends on the decided outcome. Without `only` it
// solves both, success first (the old single-worker order, kept for tests and benchmarks).
// The work is capped by a count of simulated shots (solver shotCaps), so every device finds exactly the same shots.

import { buildTable } from '../core/table/geometry';
import type { SolveAnswer, SolveRequest } from './presolve';
import { solveJob } from './solveJob';

const table = buildTable();
const post = (a: SolveAnswer) => (self as unknown as Worker).postMessage(a);

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const kinds = e.data.only ? [e.data.only] : (['success', 'failure'] as const);
  solveJob(table, e.data, kinds, () => performance.now(), post);
};
