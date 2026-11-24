// Task 5.2: the solver runs here, off the main thread, while the player decides (RULES D: the next shot is worked out
// for both outcomes before SHOOT is pressed). Always the same order (success first, then the failure), so the time it
// takes never depends on the decided outcome. Each answer is posted as soon as it is ready.
// The work is capped by a count of simulated shots (solver shotCaps), so every device finds exactly the same shots.

import { createPhysicsProvider } from '../core/physicsProvider';
import { buildTable } from '../core/table/geometry';
import type { SolveRequest, SolveAnswer } from './presolve';

const table = buildTable();
const post = (a: SolveAnswer) => (self as unknown as Worker).postMessage(a);

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, frame, failure, ctx } = e.data;
  const provider = createPhysicsProvider(table, {}, () => performance.now());
  let t0 = performance.now();
  // RULES B.3: on a colour step the game picks the colour first (from the layout only), both outcomes use it
  const target = frame.phase === 'colour' ? provider.autoColour!(frame, ctx) : e.data.target;
  for (const kind of ['success', 'failure'] as const) {
    const before = provider.log.length;
    const planned = provider.shot(frame, target, kind === 'success' ? 'success' : failure, ctx);
    post({ id, kind, target, planned, ms: performance.now() - t0, log: provider.log.slice(before) });
    t0 = performance.now();
  }
};
