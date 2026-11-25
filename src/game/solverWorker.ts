// Task 5.2: the solver runs here, off the main thread, while the player decides (RULES D: the next shot is worked out
// for both outcomes before SHOOT is pressed). Always the same order (success first, then the failure); SHOOT waits for
// both answers (presolve.ts), so the wait never depends on the decided outcome.
// The work is capped by a count of simulated shots (solver shotCaps), so every device finds exactly the same shots.

import { buildTable } from '../core/table/geometry';
import type { SolveAnswer, SolveRequest } from './presolve';
import { solveJob } from './solveJob';

const table = buildTable();
const post = (a: SolveAnswer) => (self as unknown as Worker).postMessage(a);

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  solveJob(table, e.data, ['success', 'failure'], () => performance.now(), post);
};
